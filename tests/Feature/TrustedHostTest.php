<?php

use App\Events\TrustedHostsUpdated;
use App\Http\Controllers\TrustedHostController;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function trustUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

// --- trusting a site ---------------------------------------------------------

test('a guest cannot trust a site', function () {
    $this->putJson('/trusted-hosts/example.com')->assertUnauthorized();
});

test('trusting a site saves it on the account', function () {
    $user = trustUser();

    $this->actingAs($user)
        ->putJson('/trusted-hosts/instagram.com')
        ->assertOk()
        ->assertExactJson(['hosts' => ['instagram.com']]);

    expect($user->fresh()->trusted_link_hosts)->toBe(['instagram.com']);
});

test('a host is stored in lower case and only once', function () {
    $user = trustUser();

    $this->actingAs($user)->putJson('/trusted-hosts/Example.COM')->assertOk();
    $this->actingAs($user)->putJson('/trusted-hosts/example.com')->assertOk();
    $this->actingAs($user)->putJson('/trusted-hosts/example.com.')->assertOk();

    expect($user->fresh()->trusted_link_hosts)->toBe(['example.com']);
});

test('trusted sites keep the order they were added in', function () {
    $user = trustUser();

    foreach (['b.example', 'a.example', 'c.example'] as $host) {
        $this->actingAs($user)->putJson("/trusted-hosts/{$host}")->assertOk();
    }

    expect($user->fresh()->trusted_link_hosts)->toBe(['b.example', 'a.example', 'c.example']);
});

test('only real host names can be trusted', function (string $host) {
    $user = trustUser();

    $this->actingAs($user)->putJson('/trusted-hosts/'.rawurlencode($host))->assertStatus(422);

    expect($user->fresh()->trusted_link_hosts)->toBeNull();
})->with([
    'a scheme' => ['javascript:alert(1)'],
    'a space' => ['not a host'],
    'a leading hyphen' => ['-example.com'],
    'an empty label' => ['example..com'],
    'markup' => ['<script>'],
]);

test('addresses a browser can report are accepted', function (string $host) {
    $user = trustUser();

    $this->actingAs($user)->putJson('/trusted-hosts/'.rawurlencode($host))->assertOk();

    expect($user->fresh()->trusted_link_hosts)->toBe([$host]);
})->with([
    'a plain domain' => ['example.com'],
    'a subdomain' => ['m.facebook.com'],
    'an international name' => ['xn--bcher-kva.example'],
    'an IPv4 address' => ['192.168.1.20'],
    'an IPv6 address' => ['[::1]'],
]);

test('the list has a limit', function () {
    $hosts = array_map(fn ($i) => "site{$i}.example", range(1, TrustedHostController::MAX));
    $user = trustUser(['trusted_link_hosts' => $hosts]);

    $this->actingAs($user)->putJson('/trusted-hosts/one-more.example')->assertStatus(422);
    // A site already on the list is not "one more".
    $this->actingAs($user)->putJson('/trusted-hosts/site1.example')->assertOk();

    expect($user->fresh()->trusted_link_hosts)->toHaveCount(TrustedHostController::MAX);
});

// --- revoking ----------------------------------------------------------------

test('a site can be revoked on its own', function () {
    $user = trustUser(['trusted_link_hosts' => ['a.example', 'b.example']]);

    $this->actingAs($user)
        ->deleteJson('/trusted-hosts/a.example')
        ->assertOk()
        ->assertExactJson(['hosts' => ['b.example']]);

    expect($user->fresh()->trusted_link_hosts)->toBe(['b.example']);
});

test('revoking a site that was never trusted changes nothing', function () {
    $user = trustUser(['trusted_link_hosts' => ['a.example']]);

    $this->actingAs($user)->deleteJson('/trusted-hosts/other.example')->assertOk();

    expect($user->fresh()->trusted_link_hosts)->toBe(['a.example']);
});

test('every site can be revoked at once', function () {
    $user = trustUser(['trusted_link_hosts' => ['a.example', 'b.example']]);

    $this->actingAs($user)->deleteJson('/trusted-hosts')->assertOk()->assertExactJson(['hosts' => []]);

    expect($user->fresh()->trusted_link_hosts)->toBe([]);
});

// --- one account never touches another's list ---------------------------------

test('trusted sites belong to one account only', function () {
    $mine = trustUser(['trusted_link_hosts' => ['mine.example']]);
    $theirs = trustUser(['trusted_link_hosts' => ['theirs.example']]);

    $this->actingAs($mine)->putJson('/trusted-hosts/new.example')->assertOk();
    $this->actingAs($mine)->deleteJson('/trusted-hosts')->assertOk();

    expect($theirs->fresh()->trusted_link_hosts)->toBe(['theirs.example']);
});

// --- what the browser is given -----------------------------------------------

test('the page is given the signed-in list, and only theirs', function () {
    $mine = trustUser(['trusted_link_hosts' => ['mine.example']]);
    trustUser(['trusted_link_hosts' => ['theirs.example']]);

    $this->actingAs($mine)
        ->get(route('relations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.trusted_hosts', ['mine.example']));
});

test('an account with no trusted sites is given an empty list', function () {
    $this->actingAs(trustUser())
        ->get(route('relations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.trusted_hosts', []));
});

test('the list is not part of a user that is shown', function () {
    $user = trustUser(['trusted_link_hosts' => ['mine.example']]);

    expect($user->toArray())->not->toHaveKey('trusted_link_hosts');
});

// --- keeping other tabs in step ------------------------------------------------

test('trusting and revoking tell the same person\'s other tabs', function () {
    Event::fake([TrustedHostsUpdated::class]);
    $user = trustUser();

    $this->actingAs($user)->putJson('/trusted-hosts/example.com')->assertOk();
    Event::assertDispatched(
        TrustedHostsUpdated::class,
        fn ($event) => $event->userId === $user->id && $event->hosts === ['example.com'],
    );

    $this->actingAs($user)->deleteJson('/trusted-hosts/example.com')->assertOk();
    Event::assertDispatched(
        TrustedHostsUpdated::class,
        fn ($event) => $event->userId === $user->id && $event->hosts === [],
    );
});

test('trusting a site that is already trusted does not broadcast again', function () {
    $user = trustUser(['trusted_link_hosts' => ['example.com']]);
    Event::fake([TrustedHostsUpdated::class]);

    $this->actingAs($user)->putJson('/trusted-hosts/example.com')->assertOk();

    Event::assertNotDispatched(TrustedHostsUpdated::class);
});

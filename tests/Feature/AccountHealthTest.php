<?php

use App\Models\User;
use App\Models\UserWarning;
use App\Notifications\AccountHealthRestored;
use App\Notifications\AccountWarned;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function healthAdmin(): User
{
    return User::factory()->create(['role' => 'admin']);
}

function healthCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function healthWarn(User $user, User $admin, string $reason = 'Please be respectful in messages.', ?\Illuminate\Support\Carbon $expiresAt = null): UserWarning
{
    return UserWarning::create([
        'user_id' => $user->id,
        'admin_id' => $admin->id,
        'reason' => $reason,
        'expires_at' => $expiresAt ?? now()->addDays(UserWarning::LIFESPAN_DAYS),
    ]);
}

function healthSuspend(User $user): User
{
    $user->suspended_at = now();
    $user->save();

    return $user;
}

// ---------------------------------------------------------------- issuing a warning

test('an admin can warn a user, which notifies them and is logged', function () {
    Notification::fake();

    $admin = healthAdmin();
    $customer = healthCustomer(['name' => 'Amira']);

    $this->actingAs($admin)
        ->post(route('admin.users.warn', $customer), ['reason' => 'Please stop spamming other users.'])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('user_warnings', [
        'user_id' => $customer->id,
        'admin_id' => $admin->id,
        'reason' => 'Please stop spamming other users.',
    ]);

    $this->assertDatabaseHas('admin_logs', [
        'admin_id' => $admin->id,
        'action' => 'user.warned',
        'target_type' => 'User',
        'target_id' => $customer->id,
    ]);

    Notification::assertSentTo($customer, AccountWarned::class);
    expect($customer->fresh()->healthStatus())->toBe('warned');
});

test('warning requires a reason', function () {
    $admin = healthAdmin();
    $customer = healthCustomer();

    $this->actingAs($admin)
        ->post(route('admin.users.warn', $customer), ['reason' => ''])
        ->assertSessionHasErrors('reason');

    expect($customer->fresh()->healthStatus())->toBe('good');
});

test('admin accounts cannot be warned', function () {
    $admin = healthAdmin();
    $otherAdmin = healthAdmin();

    $this->actingAs($admin)
        ->post(route('admin.users.warn', $otherAdmin), ['reason' => 'Test'])
        ->assertForbidden();

    expect(UserWarning::count())->toBe(0);
});

test('customers and technicians cannot warn anyone', function () {
    $customer = healthCustomer();
    $target = healthCustomer();

    $this->actingAs($customer)
        ->post(route('admin.users.warn', $target), ['reason' => 'Test'])
        ->assertForbidden();
});

test('guests are sent to the login page', function () {
    $target = healthCustomer();

    $this->post(route('admin.users.warn', $target), ['reason' => 'Test'])
        ->assertRedirect(route('login'));
});

test('a user can be warned more than once', function () {
    $admin = healthAdmin();
    $customer = healthCustomer();

    $this->actingAs($admin)->post(route('admin.users.warn', $customer), ['reason' => 'First warning.']);
    $this->actingAs($admin)->post(route('admin.users.warn', $customer), ['reason' => 'Second warning.']);

    expect($customer->fresh()->activeWarnings()->count())->toBe(2);
});

// ---------------------------------------------------------------- account health status

test('a good-standing account has no active warnings', function () {
    $customer = healthCustomer();

    expect($customer->healthStatus())->toBe('good');
});

test('an active warning puts the account in warned status', function () {
    $customer = healthCustomer();
    healthWarn($customer, healthAdmin());

    expect($customer->fresh()->healthStatus())->toBe('warned');
});

test('a warning older than 90 days no longer counts toward the health status', function () {
    $customer = healthCustomer();
    healthWarn($customer, healthAdmin(), expiresAt: now()->subDay());

    expect($customer->fresh()->healthStatus())->toBe('good');
});

test('suspension always takes priority over a warning', function () {
    $customer = healthSuspend(healthCustomer());
    healthWarn($customer, healthAdmin());

    expect($customer->fresh()->healthStatus())->toBe('suspended');
});

test('the settings page shows the signed-in person their own account health', function () {
    $this->withoutVite();

    $admin = healthAdmin();
    $customer = healthCustomer();
    healthWarn($customer, $admin, 'Please stop spamming other users.');

    $this->actingAs($customer)
        ->get(route('relations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Settings/Index')
            ->where('health.status', 'warned')
            ->has('health.warnings', 1)
            ->where('health.warnings.0.reason', 'Please stop spamming other users.')
            ->where('health.warnings.0.active', true)
        );
});

test('a warned user still cannot see who warned them from their own page', function () {
    $this->withoutVite();

    $admin = healthAdmin();
    $customer = healthCustomer();
    healthWarn($customer, $admin);

    $this->actingAs($customer)
        ->get(route('relations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Settings/Index')
            ->missing('health.warnings.0.admin_id')
            ->missing('health.warnings.0.admin')
        );
});

// ---------------------------------------------------------------- expiry command

test('the daily command notifies a user once their last active warning ages out', function () {
    Notification::fake();

    $customer = healthCustomer();
    // Expired a couple of hours ago: within the last day, so the command
    // (which runs daily) is the one that would catch it.
    healthWarn($customer, healthAdmin(), expiresAt: now()->subHours(2));

    $this->artisan('accounts:refresh-health')->assertExitCode(0);

    Notification::assertSentTo($customer, AccountHealthRestored::class);
    expect($customer->fresh()->healthStatus())->toBe('good');
});

test('the daily command does not notify a user who still has another active warning', function () {
    Notification::fake();

    $admin = healthAdmin();
    $customer = healthCustomer();
    healthWarn($customer, $admin, 'Old warning', expiresAt: now()->subHours(2));
    healthWarn($customer, $admin, 'Recent warning', expiresAt: now()->addDays(UserWarning::LIFESPAN_DAYS));

    $this->artisan('accounts:refresh-health');

    Notification::assertNotSentTo($customer, AccountHealthRestored::class);
    expect($customer->fresh()->healthStatus())->toBe('warned');
});

test('the daily command does not notify a suspended user', function () {
    Notification::fake();

    $customer = healthSuspend(healthCustomer());
    healthWarn($customer, healthAdmin(), expiresAt: now()->subHours(2));

    $this->artisan('accounts:refresh-health');

    Notification::assertNotSentTo($customer, AccountHealthRestored::class);
});

test('the daily command leaves accounts with no expiring warnings alone', function () {
    Notification::fake();

    $customer = healthCustomer();
    healthWarn($customer, healthAdmin());

    $this->artisan('accounts:refresh-health');

    Notification::assertNothingSentTo($customer);
});

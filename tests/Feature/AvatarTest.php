<?php

use App\Models\Conversation;
use App\Models\Review;
use App\Models\SupportTicket;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(User::AVATAR_DISK));

function avatarUser(string $role = 'customer', array $attributes = []): User
{
    return User::factory()->create(['role' => $role, ...$attributes]);
}

function avatarTechnician(array $attributes = []): User
{
    $technician = avatarUser('technician', $attributes);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

/**
 * An upload backed by a real temporary file. The framework's fake files report
 * a type based on their name, so only a real file shows that the server looks
 * at what is actually inside.
 */
function avatarRealUpload(string $name, string $content): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'upl');
    file_put_contents($path, $content);

    return new UploadedFile($path, $name, null, null, true);
}

/** Give a user a stored picture, the way an upload would. */
function avatarGive(User $user, string $name = 'me.png'): string
{
    $path = UploadedFile::fake()->image($name, 120, 120)->store('avatars', User::AVATAR_DISK);

    $user->avatar_path = $path;
    $user->save();

    return $path;
}

// ---------------------------------------------------------------- uploading

test('a user can upload a picture', function () {
    $user = avatarUser();

    $this->actingAs($user)
        ->post(route('profile.avatar.store'), ['avatar' => UploadedFile::fake()->image('me.png', 200, 200)])
        ->assertSessionHasNoErrors();

    $user->refresh();

    expect($user->avatar_path)->toStartWith('avatars/')
        ->and($user->avatar_url)->toStartWith("/avatars/{$user->id}?v=");

    Storage::disk(User::AVATAR_DISK)->assertExists($user->avatar_path);
});

test('uploading a new picture replaces the old one and deletes its file', function () {
    $user = avatarUser();
    $old = avatarGive($user);
    $oldUrl = $user->fresh()->avatar_url;

    $this->actingAs($user)
        ->post(route('profile.avatar.store'), ['avatar' => UploadedFile::fake()->image('new.jpg', 200, 200)])
        ->assertSessionHasNoErrors();

    $user->refresh();

    expect($user->avatar_path)->not->toBe($old)
        // A new version in the URL is what makes browsers drop the cached old picture.
        ->and($user->avatar_url)->not->toBe($oldUrl);

    Storage::disk(User::AVATAR_DISK)->assertMissing($old);
    Storage::disk(User::AVATAR_DISK)->assertExists($user->avatar_path);
    expect(Storage::disk(User::AVATAR_DISK)->allFiles())->toHaveCount(1);
});

test('files that are not plain pictures are rejected and the current picture stays', function (string $name, string $content) {
    $user = avatarUser();
    $current = avatarGive($user);

    $this->actingAs($user)
        ->post(route('profile.avatar.store'), ['avatar' => avatarRealUpload($name, $content)])
        ->assertSessionHasErrors('avatar');

    expect($user->fresh()->avatar_path)->toBe($current)
        ->and(Storage::disk(User::AVATAR_DISK)->allFiles())->toHaveCount(1);
})->with([
    'a page renamed to .jpg' => ['me.jpg', '<html><script>alert(1)</script></html>'],
    'svg' => ['me.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    'a script' => ['me.php', '<?php echo 1;'],
]);

test('a picture over the size limit is rejected', function () {
    $user = avatarUser();

    $this->actingAs($user)
        ->post(route('profile.avatar.store'), [
            'avatar' => UploadedFile::fake()->create('big.jpg', User::AVATAR_MAX_KB + 1, 'image/jpeg'),
        ])
        ->assertSessionHasErrors('avatar');

    expect($user->fresh()->avatar_path)->toBeNull()
        ->and(Storage::disk(User::AVATAR_DISK)->allFiles())->toBe([]);
});

test('a picture is required', function () {
    $this->actingAs(avatarUser())
        ->post(route('profile.avatar.store'), [])
        ->assertSessionHasErrors('avatar');
});

test('guests cannot upload, remove or view pictures', function () {
    $user = avatarUser();
    avatarGive($user);

    $this->post(route('profile.avatar.store'), ['avatar' => UploadedFile::fake()->image('me.png')])
        ->assertRedirect(route('login'));
    $this->delete(route('profile.avatar.destroy'))->assertRedirect(route('login'));
    $this->get(route('avatars.show', $user))->assertRedirect(route('login'));
});

test('an upload cannot set anyone else\'s picture or a stored path', function () {
    $user = avatarUser();
    $other = avatarUser();

    $this->actingAs($user)
        ->post(route('profile.avatar.store'), [
            'avatar' => UploadedFile::fake()->image('me.png'),
            'user_id' => $other->id,
            'avatar_path' => 'avatars/somebody-elses.png',
        ])
        ->assertSessionHasNoErrors();

    expect($other->fresh()->avatar_path)->toBeNull()
        ->and($user->fresh()->avatar_path)->not->toBe('avatars/somebody-elses.png');
});

test('the profile form cannot smuggle in a picture path', function () {
    $user = avatarUser();

    $this->actingAs($user)
        ->patch('/profile', [
            'name' => 'Test User',
            'email' => $user->email,
            'avatar_path' => 'avatars/anything.png',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_path)->toBeNull();
});

// ---------------------------------------------------------------- removing

test('a user can remove their picture', function () {
    $user = avatarUser();
    $path = avatarGive($user);

    $this->actingAs($user)
        ->delete(route('profile.avatar.destroy'))
        ->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_path)->toBeNull()
        ->and($user->fresh()->avatar_url)->toBeNull();

    Storage::disk(User::AVATAR_DISK)->assertMissing($path);
});

test('removing a picture that does not exist is harmless', function () {
    $user = avatarUser();

    $this->actingAs($user)->delete(route('profile.avatar.destroy'))->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_path)->toBeNull();
});

test('deleting an account deletes its picture file', function () {
    $user = avatarUser();
    $path = avatarGive($user);

    $this->actingAs($user)
        ->delete('/profile', ['password' => 'password'])
        ->assertRedirect('/');

    Storage::disk(User::AVATAR_DISK)->assertMissing($path);
});

// ---------------------------------------------------------------- viewing

test('signed-in users can view each other\'s pictures', function () {
    $owner = avatarUser();
    avatarGive($owner);

    $response = $this->actingAs(avatarUser())
        ->get(route('avatars.show', $owner))
        ->assertOk();

    expect($response->headers->get('Content-Type'))->toStartWith('image/png')
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Cache-Control'))->toContain('private');
});

test('a user without a picture, or whose file is gone, is a 404', function () {
    $viewer = avatarUser();
    $without = avatarUser();
    $missingFile = avatarUser();
    $path = avatarGive($missingFile);
    Storage::disk(User::AVATAR_DISK)->delete($path);

    $this->actingAs($viewer)->get(route('avatars.show', $without))->assertNotFound();
    $this->actingAs($viewer)->get(route('avatars.show', $missingFile))->assertNotFound();
});

test('the shared user prop carries the picture URL but never the stored path', function () {
    $this->withoutVite();

    $user = avatarUser();
    avatarGive($user);

    $this->actingAs($user)
        ->get('/profile')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.avatar_url', $user->fresh()->avatar_url)
            ->missing('auth.user.avatar_path'));
});

test('a user with no picture has a null URL', function () {
    $this->withoutVite();

    $user = avatarUser();

    $this->actingAs($user)
        ->get('/profile')
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.avatar_url', null));
});

// ---------------------------------------------------------------- where it appears

test('the conversation pages carry both people\'s pictures', function () {
    $this->withoutVite();

    $customer = avatarUser();
    $technician = avatarTechnician();
    avatarGive($customer);
    avatarGive($technician, 'tech.png');

    $conversation = Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversation.customer.avatar_url', $customer->fresh()->avatar_url)
            ->where('conversation.technician.avatar_url', $technician->fresh()->avatar_url)
            ->missing('conversation.customer.avatar_path')
            ->missing('conversation.technician.avatar_path'));

    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.technician.avatar_url', $technician->fresh()->avatar_url));
});

test('search results and technician profiles carry pictures, including reviewers\'', function () {
    $this->withoutVite();

    $technician = avatarTechnician();
    $customer = avatarUser();
    avatarGive($technician, 'tech.png');
    avatarGive($customer);

    Review::create([
        'technician_id' => $technician->id,
        'customer_id' => $customer->id,
        'rating' => 5,
        'comment' => 'Great',
    ]);

    $viewer = avatarUser();

    $this->actingAs($viewer)
        ->get(route('technicians.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('technicians.data.0.avatar_url', $technician->fresh()->avatar_url)
            ->missing('technicians.data.0.avatar_path'));

    $this->actingAs($viewer)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('technician.avatar_url', $technician->fresh()->avatar_url)
            ->where('technician.reviews_received.0.customer.avatar_url', $customer->fresh()->avatar_url));
});

test('the admin pages carry pictures', function () {
    $this->withoutVite();

    $admin = avatarUser('admin');
    $member = avatarUser();
    avatarGive($member);

    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $member->id,
        'category' => 'question',
        'subject' => 'Hello',
        'status' => 'open',
        'last_activity_at' => now(),
    ]);
    $ticket->messages()->create(['user_id' => $member->id, 'from_staff' => false, 'body' => 'Help']);

    $this->actingAs($admin);

    $url = $member->fresh()->avatar_url;

    $this->get(route('admin.users.index', ['q' => $member->email]))
        ->assertInertia(fn (Assert $page) => $page->where('users.data.0.avatar_url', $url));

    $this->get(route('admin.support.index'))
        ->assertInertia(fn (Assert $page) => $page->where('tickets.data.0.user.avatar_url', $url));

    $this->get(route('admin.support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->where('ticket.user.avatar_url', $url)
            ->where('thread.0.avatar_url', $url));

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('recentUsers', fn ($users) => collect($users)->contains('avatar_url', $url)));
});

test('support staff stay anonymous to customers: no name and no picture', function () {
    $this->withoutVite();

    $admin = avatarUser('admin', ['name' => 'Sara Admin']);
    $member = avatarUser();
    avatarGive($admin, 'admin.png');
    avatarGive($member);

    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $member->id,
        'category' => 'question',
        'subject' => 'Hello',
        'status' => 'in_progress',
        'last_activity_at' => now(),
    ]);
    $ticket->messages()->create(['user_id' => $member->id, 'from_staff' => false, 'body' => 'Help']);
    $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'On it']);

    $this->actingAs($member)
        ->get(route('support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->where('thread.0.avatar_url', $member->fresh()->avatar_url)
            ->where('thread.1.author', 'Support team')
            ->where('thread.1.avatar_url', null));

    $this->actingAs($admin)
        ->get(route('admin.support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->where('thread.1.author', 'Sara Admin')
            ->where('thread.1.avatar_url', $admin->fresh()->avatar_url));
});

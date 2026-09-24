<?php

use App\Models\SupportMessage;
use App\Models\SupportMessageAttachment;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\SupportReply;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake(SupportMessage::ATTACHMENT_DISK);
    $this->withoutVite();
});

function saAdmin(): User
{
    return User::factory()->create(['role' => 'admin']);
}

function saUser(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function saPicture(string $name = 'leak.png', int $kb = 50, string $mime = 'image/png'): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, $mime);
}

/** A ticket that already carries one picture on its first message, as if sent earlier. */
function saTicketWithPicture(?User $owner = null): SupportTicket
{
    $owner ??= saUser();

    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $owner->id,
        'category' => 'bug',
        'subject' => 'Cannot upload',
        'status' => 'open',
        'last_activity_at' => now(),
    ]);

    saAttach($ticket->messages()->create(['user_id' => $owner->id, 'from_staff' => false, 'body' => 'See picture']), $ticket);

    return $ticket;
}

function saAttach(SupportMessage $message, SupportTicket $ticket, string $name = 'leak.png'): SupportMessageAttachment
{
    return $message->attachments()->create([
        'path' => saPicture($name)->store("support-attachments/{$ticket->id}", SupportMessage::ATTACHMENT_DISK),
        'name' => $name,
        'mime' => 'image/png',
        'size' => 51200,
    ]);
}

function saGuestPayload(array $overrides = []): array
{
    return [
        'name' => 'Guest Gina',
        'email' => 'gina@example.test',
        'category' => 'bug',
        'subject' => 'Cannot upload',
        'body' => 'The upload button does nothing.',
        ...$overrides,
    ];
}

// ------------------------------------------------------- signed in

test('a signed-in user can open a ticket with pictures', function () {
    $user = saUser();

    $this->actingAs($user)
        ->post(route('support.store'), [
            'category' => 'bug',
            'subject' => 'Cannot upload',
            'body' => 'Look at this',
            'attachments' => [saPicture('one.png'), saPicture('two.jpg', 20, 'image/jpeg')],
        ])
        ->assertSessionHasNoErrors();

    $message = SupportTicket::sole()->messages()->where('from_staff', false)->sole();

    expect($message->attachments)->toHaveCount(2)
        ->and($message->attachments->pluck('name')->all())->toBe(['one.png', 'two.jpg']);

    foreach ($message->attachments as $attachment) {
        Storage::disk(SupportMessage::ATTACHMENT_DISK)->assertExists($attachment->path);
    }
});

test('a reply can be only pictures, and still tells the admins', function () {
    Notification::fake();
    $owner = saUser();
    $admin = saAdmin();
    $ticket = saTicketWithPicture($owner);

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['attachments' => [saPicture('screen.png')]])
        ->assertSessionHasNoErrors();

    $reply = $ticket->messages()->latest('id')->first();

    expect($reply->body)->toBe('')
        ->and($reply->attachments)->toHaveCount(1);

    Notification::assertSentTo($admin, SupportReply::class, fn ($n) => $n->toArray($admin)['body'] === 'Sent a picture');
});

test('a reply needs text or a picture', function () {
    $owner = saUser();
    $ticket = saTicketWithPicture($owner);

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['body' => ''])
        ->assertSessionHasErrors('body');

    expect($ticket->messages()->count())->toBe(1);
});

test('only pictures within the limits are accepted', function (array $attachments, string $errorKey) {
    $owner = saUser();
    $ticket = saTicketWithPicture($owner);

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['body' => 'hi', 'attachments' => $attachments])
        ->assertSessionHasErrors($errorKey);

    expect($ticket->messages()->count())->toBe(1)
        ->and(SupportMessageAttachment::count())->toBe(1);
})->with([
    'a pdf' => fn () => [[UploadedFile::fake()->create('doc.pdf', 20, 'application/pdf')], 'attachments.0'],
    'an svg' => fn () => [[UploadedFile::fake()->create('logo.svg', 5, 'image/svg+xml')], 'attachments.0'],
    'a video' => fn () => [[UploadedFile::fake()->create('clip.mp4', 200, 'video/mp4')], 'attachments.0'],
    'too big' => fn () => [[saPicture('huge.png', SupportMessage::ATTACHMENT_MAX_KB + 1)], 'attachments.0'],
    'too many' => fn () => [
        collect(range(1, SupportMessage::ATTACHMENT_MAX_FILES + 1))->map(fn ($n) => saPicture("p{$n}.png", 10))->all(),
        'attachments',
    ],
]);

test('the owner sees the pictures in the thread and can open them', function () {
    $owner = saUser();
    $ticket = saTicketWithPicture($owner);
    $attachment = $ticket->messages()->first()->attachments()->first();

    $this->actingAs($owner)
        ->get(route('support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Support/Show')
            ->has('attachmentLimits')
            ->has('thread.0.attachments', 1)
            ->where('thread.0.attachments.0.name', 'leak.png')
            ->where('thread.0.attachments.0.url', route('support.attachment', [$ticket, $attachment], absolute: false)));

    $response = $this->actingAs($owner)->get(route('support.attachment', [$ticket, $attachment]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('image/png')
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

test('someone else cannot open a ticket picture', function () {
    $ticket = saTicketWithPicture();
    $attachment = $ticket->messages()->first()->attachments()->first();

    $this->actingAs(saUser())->get(route('support.attachment', [$ticket, $attachment]))->assertNotFound();
    $this->get(route('support.attachment', [$ticket, $attachment]))->assertRedirect(route('login'));
});

test('a picture cannot be reached through another ticket', function () {
    $owner = saUser();
    $first = saTicketWithPicture($owner);
    $second = saTicketWithPicture($owner);
    $picture = $first->messages()->first()->attachments()->first();

    $this->actingAs($owner)->get(route('support.attachment', [$second, $picture]))->assertNotFound();
});

// ------------------------------------------------------------ admin

test('an admin can read the pictures but cannot attach any', function () {
    $owner = saUser();
    $admin = saAdmin();
    $ticket = saTicketWithPicture($owner);
    $attachment = $ticket->messages()->first()->attachments()->first();

    $this->actingAs($admin)
        ->get(route('admin.support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->has('thread.0.attachments', 1)
            ->where('thread.0.attachments.0.url', route('admin.support.attachment', [$ticket, $attachment], absolute: false)));

    $this->actingAs($admin)->get(route('admin.support.attachment', [$ticket, $attachment]))->assertOk();
    $this->actingAs($owner)->get(route('admin.support.attachment', [$ticket, $attachment]))->assertForbidden();

    $this->actingAs($admin)
        ->post(route('admin.support.reply', $ticket), ['body' => 'Thanks', 'attachments' => [saPicture('staff.png')]])
        ->assertSessionHasNoErrors();

    expect(SupportMessageAttachment::count())->toBe(1)
        ->and($ticket->messages()->where('from_staff', true)->latest('id')->first()->attachments)->toHaveCount(0);
});

// ------------------------------------------------------------ guest

test('a guest can open a ticket with pictures and read them back with their link', function () {
    $this->post(route('support.guest.store'), saGuestPayload(['attachments' => [saPicture('guest.png')]]))
        ->assertSessionHasNoErrors();

    $ticket = SupportTicket::sole();
    $attachment = SupportMessageAttachment::sole();

    expect($ticket->isGuest())->toBeTrue()
        ->and($attachment->message->support_ticket_id)->toBe($ticket->id);

    $this->get(route('support.guest.show', ['ticket' => $ticket->id, 'token' => $ticket->guest_token]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Support/GuestShow')
            ->has('attachmentLimits')
            ->has('thread.0.attachments', 1)
            ->where('thread.0.attachments.0.url', route('support.guest.attachment', [
                'ticket' => $ticket->id,
                'token' => $ticket->guest_token,
                'attachment' => $attachment->id,
            ], absolute: false)));

    $this->get(route('support.guest.attachment', [$ticket, $ticket->guest_token, $attachment]))->assertOk();
});

test('a guest picture needs the right token', function () {
    $this->post(route('support.guest.store'), saGuestPayload(['attachments' => [saPicture()]]));

    $ticket = SupportTicket::sole();
    $attachment = SupportMessageAttachment::sole();

    $this->get(route('support.guest.attachment', [$ticket, 'not-the-token', $attachment]))->assertNotFound();
});

test('a guest can reply with a picture only', function () {
    Notification::fake();
    saAdmin();
    $this->post(route('support.guest.store'), saGuestPayload());

    $ticket = SupportTicket::sole();

    $this->post(route('support.guest.reply', ['ticket' => $ticket->id, 'token' => $ticket->guest_token]), [
        'attachments' => [saPicture('more.png')],
    ])->assertSessionHasNoErrors();

    $reply = $ticket->messages()->where('from_staff', false)->latest('id')->first();

    expect($reply->body)->toBe('')
        ->and($reply->attachments)->toHaveCount(1);
});

test('guest pictures are checked like everyone elses', function () {
    $this->post(route('support.guest.store'), saGuestPayload([
        'attachments' => [UploadedFile::fake()->create('evil.html', 5, 'text/html')],
    ]))->assertSessionHasErrors('attachments.0');

    expect(SupportTicket::count())->toBe(0);
});

test('deleting a user removes the pictures on their tickets', function () {
    $owner = saUser();
    $ticket = saTicketWithPicture($owner);
    $path = $ticket->messages()->first()->attachments()->first()->path;

    Storage::disk(SupportMessage::ATTACHMENT_DISK)->assertExists($path);

    $owner->delete();

    Storage::disk(SupportMessage::ATTACHMENT_DISK)->assertMissing($path);
});

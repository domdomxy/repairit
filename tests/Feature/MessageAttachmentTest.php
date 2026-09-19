<?php

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(Message::ATTACHMENT_DISK));

/**
 * @return array{0: User, 1: User, 2: Conversation} [customer, technician, conversation]
 */
function attachmentSetup(): array
{
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
    ]);

    return [$customer, $technician, $conversation];
}

/**
 * A message that already carries the given files, as if it had been sent earlier.
 *
 * @param  UploadedFile|array<int, UploadedFile>  $files
 */
function attachmentMessage(Conversation $conversation, User $sender, UploadedFile|array $files): Message
{
    $message = $conversation->messages()->create(['sender_id' => $sender->id]);

    foreach (Arr::wrap($files) as $file) {
        $message->attachments()->create([
            'path' => $file->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK),
            'name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
    }

    return $message->load('attachments');
}

test('a participant can send a file with a message', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'body' => 'Here is the quote',
            'attachments' => [UploadedFile::fake()->create('quote.pdf', 200, 'application/pdf')],
        ])
        ->assertSessionHasNoErrors();

    $message = Message::with('attachments')->firstOrFail();
    $attachment = $message->attachments->sole();

    expect($message->body)->toBe('Here is the quote')
        ->and($attachment->name)->toBe('quote.pdf')
        ->and($attachment->mime)->toBe('application/pdf')
        ->and($attachment->size)->toBe(200 * 1024)
        ->and($attachment->path)->toStartWith("message-attachments/{$conversation->id}/");

    Storage::disk(Message::ATTACHMENT_DISK)->assertExists($attachment->path);
});

test('several files can be sent in one message', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'body' => 'Photos of the leak',
            'attachments' => [
                UploadedFile::fake()->create('under-sink.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('pipe.png', 100, 'image/png'),
                UploadedFile::fake()->create('quote.pdf', 100, 'application/pdf'),
            ],
        ])
        ->assertSessionHasNoErrors();

    expect(Message::count())->toBe(1);

    $message = Message::with('attachments')->firstOrFail();

    // One message, three files, kept in the order they were chosen.
    expect($message->attachments->pluck('name')->all())->toBe(['under-sink.jpg', 'pipe.png', 'quote.pdf']);

    foreach ($message->attachments as $attachment) {
        Storage::disk(Message::ATTACHMENT_DISK)->assertExists($attachment->path);
    }

    expect(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toHaveCount(3);
});

test('the sender and the recipient both get every file of a message', function () {
    Event::fake([MessageSent::class]);

    [$customer, $technician, $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [
                UploadedFile::fake()->create('a.pdf', 10, 'application/pdf'),
                UploadedFile::fake()->create('b.pdf', 10, 'application/pdf'),
            ],
        ]);

    // What the live channel carries: both files, described without their stored paths.
    Event::assertDispatched(MessageSent::class, function (MessageSent $event) {
        $payload = $event->broadcastWith();

        return collect($payload['attachments'])->pluck('name')->all() === ['a.pdf', 'b.pdf']
            && ! array_key_exists('path', $payload['attachments'][0]->toArray());
    });
});

test('a file can be sent without any text', function () {
    [, $technician, $conversation] = attachmentSetup();

    $this->actingAs($technician)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create('photo.png', 20, 'image/png')],
        ])
        ->assertSessionHasNoErrors();

    $message = Message::with('attachments')->firstOrFail();

    expect($message->body)->toBeNull()
        ->and($message->attachments->sole()->name)->toBe('photo.png')
        ->and($conversation->fresh()->last_message_at)->not->toBeNull();
});

test('a message needs text or a file', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [])
        ->assertSessionHasErrors('body');

    expect(Message::count())->toBe(0);
});

test('file types that could run code are rejected', function (string $name, string $mime) {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create($name, 10, $mime)],
        ])
        ->assertSessionHasErrors('attachments.0');

    expect(Message::count())->toBe(0);
})->with([
    'executable' => ['setup.exe', 'application/x-msdownload'],
    'web page' => ['page.html', 'text/html'],
    'svg image' => ['logo.svg', 'image/svg+xml'],
    'php script' => ['shell.php', 'application/x-php'],
]);

test('a file is judged by what is inside it, not by its name', function () {
    [$customer, , $conversation] = attachmentSetup();

    // A web page with a harmless-looking name, as a real upload.
    $path = tempnam(sys_get_temp_dir(), 'upl');
    file_put_contents($path, '<html><script>alert(1)</script></html>');

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [new UploadedFile($path, 'invoice.pdf', null, null, true)],
        ])
        ->assertSessionHasErrors('attachments.0');

    expect(Message::count())->toBe(0)
        ->and(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('one bad file rejects the whole message and nothing is stored', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'body' => 'Two files',
            'attachments' => [
                UploadedFile::fake()->create('good.pdf', 10, 'application/pdf'),
                UploadedFile::fake()->create('setup.exe', 10, 'application/x-msdownload'),
            ],
        ])
        ->assertSessionHasErrors('attachments.1')
        ->assertSessionDoesntHaveErrors('attachments.0');

    expect(Message::count())->toBe(0)
        ->and(MessageAttachment::count())->toBe(0)
        ->and(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('a file over the size limit is rejected', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create('big.pdf', Message::ATTACHMENT_MAX_KB + 1, 'application/pdf')],
        ])
        ->assertSessionHasErrors('attachments.0');

    expect(Message::count())->toBe(0);
});

test('a message can carry only so many files', function () {
    [$customer, , $conversation] = attachmentSetup();

    $files = fn (int $count) => collect(range(1, $count))
        ->map(fn ($n) => UploadedFile::fake()->create("file-{$n}.pdf", 10, 'application/pdf'))
        ->all();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['attachments' => $files(Message::ATTACHMENT_MAX_FILES + 1)])
        ->assertSessionHasErrors('attachments');

    expect(Message::count())->toBe(0);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['attachments' => $files(Message::ATTACHMENT_MAX_FILES)])
        ->assertSessionHasNoErrors();

    expect(MessageAttachment::count())->toBe(Message::ATTACHMENT_MAX_FILES);
});

test('the files of one message have a combined size limit', function () {
    [$customer, , $conversation] = attachmentSetup();

    // Each file is within its own limit; together they are over the total.
    $each = Message::ATTACHMENT_MAX_KB;
    $count = (int) floor(Message::ATTACHMENT_MAX_TOTAL_KB / $each) + 1;

    expect($count)->toBeLessThanOrEqual(Message::ATTACHMENT_MAX_FILES);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => collect(range(1, $count))
                ->map(fn ($n) => UploadedFile::fake()->create("part-{$n}.pdf", $each, 'application/pdf'))
                ->all(),
        ])
        ->assertSessionHasErrors('attachments');

    expect(Message::count())->toBe(0)
        ->and(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('a file cannot be sent to a suspended user', function () {
    [$customer, $technician, $conversation] = attachmentSetup();

    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf')],
        ])
        ->assertForbidden();

    expect(Message::count())->toBe(0);
    expect(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('participants can open attachments: pictures inline, other files as downloads', function () {
    [$customer, $technician, $conversation] = attachmentSetup();

    $message = attachmentMessage($conversation, $customer, [
        UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'),
        UploadedFile::fake()->create('photo.png', 10, 'image/png'),
    ]);

    [$pdf, $png] = $message->attachments;

    $download = $this->actingAs($technician)
        ->get(route('messages.attachment', $pdf))
        ->assertOk();

    expect($download->headers->get('Content-Disposition'))->toStartWith('attachment')
        ->toContain('quote.pdf')
        ->and($download->headers->get('X-Content-Type-Options'))->toBe('nosniff');

    $inline = $this->actingAs($customer)
        ->get(route('messages.attachment', $png))
        ->assertOk();

    expect($inline->headers->get('Content-Disposition'))->toStartWith('inline')
        ->and($inline->headers->get('Content-Type'))->toStartWith('image/png');
});

test('only the two people in the conversation can open its attachments', function () {
    [$customer, , $conversation] = attachmentSetup();
    $attachment = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'))
        ->attachments->sole();

    $url = route('messages.attachment', $attachment);

    $this->get($url)->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create(['role' => 'customer']))
        ->get($url)
        ->assertForbidden();

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get($url)->assertForbidden();

    // Being in a different conversation with the same technician is not enough.
    $otherTechnician = User::factory()->create(['role' => 'technician']);
    Conversation::create(['customer_id' => $customer->id, 'technician_id' => $otherTechnician->id]);

    $this->actingAs($otherTechnician)->get($url)->assertForbidden();
});

test('a file whose row exists but whose data is gone is a 404, not a crash', function () {
    [$customer, , $conversation] = attachmentSetup();
    $attachment = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'))
        ->attachments->sole();

    Storage::disk(Message::ATTACHMENT_DISK)->delete($attachment->path);

    $this->actingAs($customer)->get(route('messages.attachment', $attachment))->assertNotFound();
});

test('the conversation page describes attachments without exposing the stored path', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, [
        UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'),
        UploadedFile::fake()->create('photo.png', 10, 'image/png'),
    ]);
    [$pdf, $png] = $message->attachments;

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Messages/Show')
            ->has('messages.0.attachments', 2)
            ->where('messages.0.attachments.0.name', 'quote.pdf')
            ->where('messages.0.attachments.0.is_image', false)
            ->where('messages.0.attachments.0.url', route('messages.attachment', $pdf, absolute: false))
            ->where('messages.0.attachments.1.name', 'photo.png')
            ->where('messages.0.attachments.1.is_image', true)
            ->where('messages.0.attachments.1.url', route('messages.attachment', $png, absolute: false))
            ->missing('messages.0.attachments.0.path')
            ->missing('messages.0.attachments.0.mime')
            ->where('attachments.max_kb', Message::ATTACHMENT_MAX_KB)
            ->where('attachments.max_files', Message::ATTACHMENT_MAX_FILES)
            ->where('attachments.max_total_kb', Message::ATTACHMENT_MAX_TOTAL_KB));
});

test('a message without files has an empty attachment list', function () {
    $this->withoutVite();

    [$customer, , $conversation] = attachmentSetup();
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hello']);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page->has('messages.0.attachments', 0));
});

test('deleting an account deletes the files from its conversations', function () {
    [$customer, , $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, [
        UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'),
        UploadedFile::fake()->create('photo.png', 10, 'image/png'),
    ]);

    foreach ($message->attachments as $attachment) {
        Storage::disk(Message::ATTACHMENT_DISK)->assertExists($attachment->path);
    }

    $customer->delete();

    foreach ($message->attachments as $attachment) {
        Storage::disk(Message::ATTACHMENT_DISK)->assertMissing($attachment->path);
    }

    expect(MessageAttachment::count())->toBe(0);
});

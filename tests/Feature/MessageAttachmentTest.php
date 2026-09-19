<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
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

function attachmentMessage(Conversation $conversation, User $sender, UploadedFile $file): Message
{
    $path = $file->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK);

    return $conversation->messages()->create([
        'sender_id' => $sender->id,
        'attachment_path' => $path,
        'attachment_name' => $file->getClientOriginalName(),
        'attachment_mime' => $file->getMimeType(),
        'attachment_size' => $file->getSize(),
    ]);
}

test('a participant can send a file with a message', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'body' => 'Here is the quote',
            'attachment' => UploadedFile::fake()->create('quote.pdf', 200, 'application/pdf'),
        ])
        ->assertSessionHasNoErrors();

    $message = Message::firstOrFail();

    expect($message->body)->toBe('Here is the quote')
        ->and($message->attachment_name)->toBe('quote.pdf')
        ->and($message->attachment_mime)->toBe('application/pdf')
        ->and($message->attachment_size)->toBe(200 * 1024)
        ->and($message->attachment_path)->toStartWith("message-attachments/{$conversation->id}/");

    Storage::disk(Message::ATTACHMENT_DISK)->assertExists($message->attachment_path);
});

test('a file can be sent without any text', function () {
    [, $technician, $conversation] = attachmentSetup();

    $this->actingAs($technician)
        ->post(route('messages.store', $conversation), [
            'attachment' => UploadedFile::fake()->create('photo.png', 20, 'image/png'),
        ])
        ->assertSessionHasNoErrors();

    $message = Message::firstOrFail();

    expect($message->body)->toBeNull()
        ->and($message->attachment_name)->toBe('photo.png')
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
            'attachment' => UploadedFile::fake()->create($name, 10, $mime),
        ])
        ->assertSessionHasErrors('attachment');

    expect(Message::count())->toBe(0);
})->with([
    'executable' => ['setup.exe', 'application/x-msdownload'],
    'web page' => ['page.html', 'text/html'],
    'svg image' => ['logo.svg', 'image/svg+xml'],
    'php script' => ['shell.php', 'application/x-php'],
]);

test('a file over the size limit is rejected', function () {
    [$customer, , $conversation] = attachmentSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachment' => UploadedFile::fake()->create('big.pdf', Message::ATTACHMENT_MAX_KB + 1, 'application/pdf'),
        ])
        ->assertSessionHasErrors('attachment');

    expect(Message::count())->toBe(0);
});

test('a file cannot be sent to a suspended user', function () {
    [$customer, $technician, $conversation] = attachmentSetup();

    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachment' => UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'),
        ])
        ->assertForbidden();

    expect(Message::count())->toBe(0);
    expect(Storage::disk(Message::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('participants can open attachments: pictures inline, other files as downloads', function () {
    [$customer, $technician, $conversation] = attachmentSetup();

    $pdf = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'));
    $png = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('photo.png', 10, 'image/png'));

    $download = $this->actingAs($technician)
        ->get(route('messages.attachment', [$conversation, $pdf]))
        ->assertOk();

    expect($download->headers->get('Content-Disposition'))->toStartWith('attachment')
        ->toContain('quote.pdf')
        ->and($download->headers->get('X-Content-Type-Options'))->toBe('nosniff');

    $inline = $this->actingAs($customer)
        ->get(route('messages.attachment', [$conversation, $png]))
        ->assertOk();

    expect($inline->headers->get('Content-Disposition'))->toStartWith('inline')
        ->and($inline->headers->get('Content-Type'))->toStartWith('image/png');
});

test('only the two people in the conversation can open its attachments', function () {
    [$customer, , $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'));

    $url = route('messages.attachment', [$conversation, $message]);

    $this->get($url)->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create(['role' => 'customer']))
        ->get($url)
        ->assertForbidden();

    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->get($url)->assertForbidden();
});

test('an attachment cannot be opened through a different conversation', function () {
    [$customer, , $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'));

    $otherTechnician = User::factory()->create(['role' => 'technician']);
    $otherConversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $otherTechnician->id,
    ]);

    $this->actingAs($customer)
        ->get(route('messages.attachment', [$otherConversation, $message]))
        ->assertNotFound();
});

test('the conversation page describes attachments without exposing the stored path', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'));

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Messages/Show')
            ->where('messages.0.attachment.name', 'quote.pdf')
            ->where('messages.0.attachment.is_image', false)
            ->where('messages.0.attachment.url', route('messages.attachment', [$conversation, $message], absolute: false))
            ->missing('messages.0.attachment_path')
            ->where('attachments.max_kb', Message::ATTACHMENT_MAX_KB));
});

test('deleting an account deletes the files from its conversations', function () {
    [$customer, , $conversation] = attachmentSetup();
    $message = attachmentMessage($conversation, $customer, UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf'));

    Storage::disk(Message::ATTACHMENT_DISK)->assertExists($message->attachment_path);

    $customer->delete();

    Storage::disk(Message::ATTACHMENT_DISK)->assertMissing($message->attachment_path);
});

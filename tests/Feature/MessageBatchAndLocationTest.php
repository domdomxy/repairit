<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake(Message::ATTACHMENT_DISK));

/**
 * @return array{0: User, 1: User, 2: Conversation} [customer, technician, conversation]
 */
function batchSetup(): array
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

test('several files chosen together share a batch id', function () {
    [$customer, , $conversation] = batchSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [
                UploadedFile::fake()->create('one.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('two.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('three.jpg', 100, 'image/jpeg'),
            ],
        ])
        ->assertSessionHasNoErrors();

    $messages = Message::orderBy('id')->get();

    expect($messages)->toHaveCount(3)
        ->and($messages->pluck('batch_id')->unique())->toHaveCount(1)
        ->and($messages->first()->batch_id)->not->toBeNull();
});

test('a single file sent on its own gets no batch id', function () {
    [$customer, , $conversation] = batchSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create('one.jpg', 100, 'image/jpeg')],
        ])
        ->assertSessionHasNoErrors();

    expect(Message::sole()->batch_id)->toBeNull();
});

test('two separate sends never share a batch id', function () {
    [$customer, , $conversation] = batchSetup();

    $this->actingAs($customer)->post(route('messages.store', $conversation), [
        'attachments' => [
            UploadedFile::fake()->create('a1.jpg', 50, 'image/jpeg'),
            UploadedFile::fake()->create('a2.jpg', 50, 'image/jpeg'),
        ],
    ])->assertSessionHasNoErrors();

    $this->actingAs($customer)->post(route('messages.store', $conversation), [
        'attachments' => [
            UploadedFile::fake()->create('b1.jpg', 50, 'image/jpeg'),
            UploadedFile::fake()->create('b2.jpg', 50, 'image/jpeg'),
        ],
    ])->assertSessionHasNoErrors();

    $batches = Message::orderBy('id')->pluck('batch_id');

    expect($batches->unique())->toHaveCount(2)
        ->and($batches->get(0))->toBe($batches->get(1))
        ->and($batches->get(2))->toBe($batches->get(3))
        ->and($batches->get(0))->not->toBe($batches->get(2));
});

test('a video can be attached and is served inline', function () {
    [$customer, $technician, $conversation] = batchSetup();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), [
            'attachments' => [UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4')],
        ])
        ->assertSessionHasNoErrors();

    $attachment = Message::with('attachments')->sole()->attachments->sole();

    expect($attachment->is_video)->toBeTrue()
        ->and($attachment->is_image)->toBeFalse();

    $response = $this->actingAs($technician)->get(route('messages.attachment', $attachment))->assertOk();

    expect($response->headers->get('Content-Disposition'))->toStartWith('inline')
        ->and($response->headers->get('Content-Type'))->toStartWith('video/mp4');
});

test('a participant can share their location', function () {
    [$customer, , $conversation] = batchSetup();

    $this->actingAs($customer)
        ->post(route('messages.location.store', $conversation), [
            'lat' => 37.7749,
            'lng' => -122.4194,
        ])
        ->assertSessionHasNoErrors();

    $message = Message::sole();

    expect((float) $message->location_lat)->toBe(37.7749)
        ->and((float) $message->location_lng)->toBe(-122.4194)
        ->and($message->sharedLocation())->toMatchArray([
            'lat' => 37.7749,
            'lng' => -122.4194,
        ])
        ->and($message->sharedLocation()['maps_url'])->toContain('37.7749')
        ->and($conversation->fresh()->last_message_at)->not->toBeNull();
});

test('a shared location needs real coordinates', function () {
    [$customer, , $conversation] = batchSetup();

    $this->actingAs($customer)
        ->post(route('messages.location.store', $conversation), ['lat' => 200, 'lng' => 0])
        ->assertSessionHasErrors('lat');

    expect(Message::count())->toBe(0);
});

test('a location cannot be sent to a suspended user, nor by someone outside the conversation', function () {
    [$customer, $technician, $conversation] = batchSetup();
    $stranger = User::factory()->create(['role' => 'customer']);

    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($customer)
        ->post(route('messages.location.store', $conversation), ['lat' => 1, 'lng' => 1])
        ->assertForbidden();

    $this->actingAs($stranger)
        ->post(route('messages.location.store', $conversation), ['lat' => 1, 'lng' => 1])
        ->assertForbidden();

    expect(Message::count())->toBe(0);
});

test('a shared location cannot be edited', function () {
    [$customer, , $conversation] = batchSetup();

    $message = $conversation->messages()->create([
        'sender_id' => $customer->id,
        'location_lat' => 1.23,
        'location_lng' => 4.56,
    ]);

    $this->actingAs($customer)
        ->patch(route('messages.update', $message), ['body' => 'nope'])
        ->assertForbidden();
});

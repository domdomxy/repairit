<?php

use App\Models\Offer;
use App\Models\RequestMedia;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutVite();
    Storage::fake(Offer::MEDIA_DISK);
});

function rmCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

/** A request of the customer with the given number of pictures already saved. */
function rmRequest(User $customer, int $pictures = 0): ServiceRequest
{
    $serviceRequest = $customer->serviceRequests()->create([
        'description' => 'The screen cracked when I dropped it.',
    ]);

    for ($i = 1; $i <= $pictures; $i++) {
        $path = UploadedFile::fake()->image("p{$i}.jpg", 100, 100)->store("request-media/{$customer->id}", Offer::MEDIA_DISK);

        $serviceRequest->media()->create(['path' => $path, 'name' => "p{$i}.jpg", 'mime' => 'image/jpeg', 'size' => 100]);
    }

    return $serviceRequest->fresh();
}

test('a request can be posted with pictures and a video', function () {
    $customer = rmCustomer();

    $this->actingAs($customer)
        ->post(route('requests.store'), [
            'description' => 'Dropped it.',
            'media' => [
                UploadedFile::fake()->image('screen.jpg', 300, 300),
                UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4'),
            ],
        ])
        ->assertSessionHasNoErrors();

    $serviceRequest = ServiceRequest::sole();

    expect($serviceRequest->media)->toHaveCount(2)
        ->and($serviceRequest->media->pluck('type')->all())->toBe(['image', 'video']);

    foreach ($serviceRequest->media as $media) {
        expect($media->path)->toStartWith("request-media/{$customer->id}/");
        Storage::disk(Offer::MEDIA_DISK)->assertExists($media->path);
    }
});

test('a request does not need media', function () {
    $this->actingAs(rmCustomer())
        ->post(route('requests.store'), ['description' => 'Drip.'])
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::count())->toBe(1)->and(RequestMedia::count())->toBe(0);
});

test('files that are not pictures or videos, or are too many, are refused', function () {
    $this->actingAs(rmCustomer());

    $this->post(route('requests.store'), [
        'description' => 'Drip.',
        'media' => [UploadedFile::fake()->create('quote.pdf', 100, 'application/pdf')],
    ])->assertSessionHasErrors('media.0');

    $tooMany = collect(range(1, Offer::MEDIA_MAX_FILES + 1))
        ->map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg", 100, 100))
        ->all();

    $this->post(route('requests.store'), ['description' => 'Drip.', 'media' => $tooMany])
        ->assertSessionHasErrors('media');

    expect(ServiceRequest::count())->toBe(0);
});

test('the owner can remove pictures and add new ones when editing', function () {
    $customer = rmCustomer();
    $serviceRequest = rmRequest($customer, pictures: 2);
    [$removed, $kept] = $serviceRequest->media->all();

    $this->actingAs($customer)
        ->put(route('requests.update', $serviceRequest), [
            'description' => 'Updated.',
            'remove_media' => [$removed->id],
            'media' => [UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4')],
        ])
        ->assertSessionHasNoErrors();

    $media = $serviceRequest->fresh()->media;

    expect($media)->toHaveCount(2)
        ->and($media->pluck('id')->all())->toContain($kept->id)->not->toContain($removed->id);

    Storage::disk(Offer::MEDIA_DISK)->assertMissing($removed->path);
    Storage::disk(Offer::MEDIA_DISK)->assertExists($kept->path);
});

test('files kept count against the maximum when editing', function () {
    $customer = rmCustomer();
    $serviceRequest = rmRequest($customer, pictures: Offer::MEDIA_MAX_FILES);

    $this->actingAs($customer)
        ->put(route('requests.update', $serviceRequest), [
            'description' => 'Updated.',
            'media' => [UploadedFile::fake()->image('extra.jpg', 100, 100)],
        ])
        ->assertSessionHasErrors('media');
});

test('signed-in people can open the files of a request, guests cannot', function () {
    $customer = rmCustomer();
    $media = rmRequest($customer, pictures: 1)->media->first();

    $this->get(route('requests.media', $media))->assertRedirect(route('login'));

    $this->actingAs(rmCustomer())
        ->get(route('requests.media', $media))
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

test('the files of a suspended customer are hidden from everyone but them', function () {
    $customer = rmCustomer(['suspended_at' => now()]);
    $media = rmRequest($customer, pictures: 1)->media->first();

    $this->actingAs(rmCustomer())->get(route('requests.media', $media))->assertNotFound();
    $this->actingAs($customer)->get(route('requests.media', $media))->assertOk();
});

test('the cards carry the media, and only its public fields', function () {
    $customer = rmCustomer();
    rmRequest($customer, pictures: 1);

    $card = $this->actingAs(rmCustomer())
        ->get(route('feed.index'))
        ->viewData('page')['props']['feed']['data'][0];

    expect($card['media'])->toHaveCount(1)
        ->and($card['media'][0])->toHaveKeys(['id', 'name', 'size', 'type', 'url'])
        ->not->toHaveKeys(['path', 'mime']);
});

test('deleting a request deletes its files', function () {
    $customer = rmCustomer();
    $serviceRequest = rmRequest($customer, pictures: 2);
    $paths = $serviceRequest->media->pluck('path');

    $this->actingAs($customer)->delete(route('requests.destroy', $serviceRequest));

    expect(RequestMedia::count())->toBe(0);
    $paths->each(fn ($path) => Storage::disk(Offer::MEDIA_DISK)->assertMissing($path));
});

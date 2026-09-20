<?php

use App\Models\Offer;
use App\Models\OfferMedia;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(Offer::MEDIA_DISK));

function offerCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function offerTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function offerVideo(string $name = 'clip.mp4'): UploadedFile
{
    return UploadedFile::fake()->create($name, 500, 'video/mp4');
}

/**
 * An upload backed by a real temporary file. The framework's fake files report
 * a type based on their name, so only a real file shows that the server looks
 * at what is actually inside.
 */
function offerRealUpload(string $name, string $content): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'upl');
    file_put_contents($path, $content);

    return new UploadedFile($path, $name, null, null, true);
}

/** An offer with some stored pictures, the way an upload would leave it. */
function offerMake(User $technician, array $attributes = [], int $pictures = 0): Offer
{
    $offer = Offer::create([
        'technician_id' => $technician->id,
        'title' => 'Boiler service',
        ...$attributes,
    ]);

    for ($i = 1; $i <= $pictures; $i++) {
        $path = UploadedFile::fake()->image("p{$i}.jpg", 200, 200)
            ->store("offer-media/{$technician->id}", Offer::MEDIA_DISK);

        $offer->media()->create([
            'path' => $path,
            'name' => "p{$i}.jpg",
            'mime' => 'image/jpeg',
            'size' => 1000,
        ]);
    }

    return $offer;
}

// ---------------------------------------------------------------- adding

test('a technician can add an offer with a picture and a video', function () {
    $technician = offerTechnician();

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), [
            'title' => 'Boiler service',
            'description' => 'Full check and clean.',
            'price' => 'From 50 TND',
            'media' => [UploadedFile::fake()->image('boiler.jpg', 300, 300), offerVideo()],
        ])
        ->assertSessionHasNoErrors();

    $offer = Offer::firstOrFail();

    expect($offer->technician_id)->toBe($technician->id)
        ->and($offer->title)->toBe('Boiler service')
        ->and($offer->price)->toBe('From 50 TND')
        ->and($offer->media)->toHaveCount(2)
        ->and($offer->media->pluck('type')->all())->toBe(['image', 'video']);

    foreach ($offer->media as $media) {
        expect($media->path)->toStartWith("offer-media/{$technician->id}/");
        Storage::disk(Offer::MEDIA_DISK)->assertExists($media->path);
    }
});

test('an offer needs a title but not media', function () {
    $technician = offerTechnician();

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => ''])
        ->assertSessionHasErrors('title');

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => 'Quick fix'])
        ->assertSessionHasNoErrors();

    expect(Offer::count())->toBe(1)->and(OfferMedia::count())->toBe(0);
});

test('only technicians can manage offers', function () {
    $this->get(route('technician.offers.index'))->assertRedirect(route('login'));

    $customer = offerCustomer();

    $this->actingAs($customer)->get(route('technician.offers.index'))->assertForbidden();
    $this->actingAs($customer)->post(route('technician.offers.store'), ['title' => 'Nope'])->assertForbidden();

    expect(Offer::count())->toBe(0);
});

test('files are checked by their content, not their name', function () {
    $technician = offerTechnician();

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), [
            'title' => 'Sneaky',
            'media' => [offerRealUpload('clip.mp4', '<html><script>alert(1)</script></html>')],
        ])
        ->assertSessionHasErrors('media.0');

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), [
            'title' => 'Document',
            'media' => [UploadedFile::fake()->create('quote.pdf', 100, 'application/pdf')],
        ])
        ->assertSessionHasErrors('media.0');

    expect(Offer::count())->toBe(0);
});

test('a picture over the size limit is rejected', function () {
    $technician = offerTechnician();
    $tooBig = Offer::limits()['image_max_kb'] + 1;

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), [
            'title' => 'Big',
            'media' => [UploadedFile::fake()->create('big.jpg', $tooBig, 'image/jpeg')],
        ])
        ->assertSessionHasErrors('media.0');

    expect(Offer::count())->toBe(0);
});

test('an offer can carry only so many files', function () {
    $technician = offerTechnician();
    $files = collect(range(1, Offer::MEDIA_MAX_FILES + 1))
        ->map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg", 100, 100))
        ->all();

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => 'Too many', 'media' => $files])
        ->assertSessionHasErrors('media');

    expect(Offer::count())->toBe(0);
});

test('a technician can only have a limited number of offers', function () {
    $technician = offerTechnician();

    for ($i = 0; $i < Offer::MAX_PER_TECHNICIAN; $i++) {
        offerMake($technician, ['title' => "Offer {$i}"]);
    }

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => 'One more'])
        ->assertSessionHasErrors('title');

    expect(Offer::count())->toBe(Offer::MAX_PER_TECHNICIAN);
});

// ---------------------------------------------------------------- editing

test('editing an offer can change its text, remove files and add new ones', function () {
    $technician = offerTechnician();
    $offer = offerMake($technician, pictures: 2);
    [$removed, $kept] = $offer->media->all();

    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), [
            'title' => 'Boiler service and safety check',
            'description' => 'Now with a safety check.',
            'price' => '60 TND',
            'remove_media' => [$removed->id],
            'media' => [offerVideo()],
        ])
        ->assertSessionHasNoErrors();

    $offer->refresh();

    expect($offer->title)->toBe('Boiler service and safety check')
        ->and($offer->price)->toBe('60 TND')
        ->and($offer->media)->toHaveCount(2)
        ->and($offer->media->pluck('id')->all())->toContain($kept->id)->not->toContain($removed->id);

    Storage::disk(Offer::MEDIA_DISK)->assertMissing($removed->path);
    Storage::disk(Offer::MEDIA_DISK)->assertExists($kept->path);
});

test('the file limit counts the files an offer already has', function () {
    $technician = offerTechnician();
    $offer = offerMake($technician, pictures: Offer::MEDIA_MAX_FILES);

    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), [
            'title' => $offer->title,
            'media' => [UploadedFile::fake()->image('extra.jpg', 100, 100)],
        ])
        ->assertSessionHasErrors('media');

    // Making room first (by removing one) lets the new file in.
    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), [
            'title' => $offer->title,
            'remove_media' => [$offer->media->first()->id],
            'media' => [UploadedFile::fake()->image('extra.jpg', 100, 100)],
        ])
        ->assertSessionHasNoErrors();

    expect($offer->media()->count())->toBe(Offer::MEDIA_MAX_FILES);
});

test('only files of the offer itself can be removed through it', function () {
    $technician = offerTechnician();
    $offer = offerMake($technician);
    $other = offerMake($technician, ['title' => 'Other'], pictures: 1);

    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), [
            'title' => $offer->title,
            'remove_media' => [$other->media->first()->id],
        ])
        ->assertSessionHasNoErrors();

    expect($other->media()->count())->toBe(1);
    Storage::disk(Offer::MEDIA_DISK)->assertExists($other->media->first()->path);
});

test('a technician cannot change or delete someone else\'s offer', function () {
    $owner = offerTechnician();
    $intruder = offerTechnician();
    $offer = offerMake($owner, pictures: 1);

    $this->actingAs($intruder)
        ->put(route('technician.offers.update', $offer), ['title' => 'Hijacked'])
        ->assertForbidden();

    $this->actingAs($intruder)
        ->delete(route('technician.offers.destroy', $offer))
        ->assertForbidden();

    expect($offer->fresh()->title)->toBe('Boiler service')
        ->and($offer->media()->count())->toBe(1);
});

// ---------------------------------------------------------------- deleting

test('deleting an offer removes its files', function () {
    $technician = offerTechnician();
    $offer = offerMake($technician, pictures: 2);
    $paths = $offer->media->pluck('path');

    $this->actingAs($technician)
        ->delete(route('technician.offers.destroy', $offer))
        ->assertSessionHasNoErrors();

    expect(Offer::count())->toBe(0)->and(OfferMedia::count())->toBe(0);
    $paths->each(fn ($path) => Storage::disk(Offer::MEDIA_DISK)->assertMissing($path));
});

test('deleting a technician\'s account removes their offer files', function () {
    $technician = offerTechnician();
    $offer = offerMake($technician, pictures: 2);
    $paths = $offer->media->pluck('path');

    $technician->delete();

    expect(Offer::count())->toBe(0);
    $paths->each(fn ($path) => Storage::disk(Offer::MEDIA_DISK)->assertMissing($path));
});

// ---------------------------------------------------------------- where it appears

test('the management page lists only the technician\'s own offers', function () {
    $this->withoutVite();

    $technician = offerTechnician();
    offerMake($technician, pictures: 1);
    offerMake(offerTechnician(), ['title' => 'Someone else']);

    $this->actingAs($technician)
        ->get(route('technician.offers.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Technicians/Offers')
            ->has('offers', 1)
            ->where('offers.0.title', 'Boiler service')
            ->where('limits.max_files', Offer::MEDIA_MAX_FILES));
});

test('a public profile shows the offers and never a storage path', function () {
    $this->withoutVite();

    $technician = offerTechnician();
    $offer = offerMake($technician, ['price' => '50 TND'], pictures: 2);

    $this->actingAs(offerCustomer())
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technician.offers', 1)
            ->where('technician.offers.0.title', 'Boiler service')
            ->where('technician.offers.0.price', '50 TND')
            ->has('technician.offers.0.media', 2)
            ->where('technician.offers.0.media.0.type', 'image')
            ->where('technician.offers.0.media.0.url', route('offers.media', $offer->media->first(), absolute: false))
            ->missing('technician.offers.0.media.0.path')
            ->missing('technician.offers.0.media.0.mime'));
});

test('only the technician sees the offer form options on their own profile', function () {
    $this->withoutVite();

    $technician = offerTechnician();

    $this->actingAs($technician)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('offerForm.limits.max_offers', Offer::MAX_PER_TECHNICIAN)
            ->has('offerForm.categories'));

    $this->actingAs(offerCustomer())
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page->where('offerForm', null));
});

// ---------------------------------------------------------------- serving files

test('any signed-in user can load an offer file', function () {
    $technician = offerTechnician();
    $media = offerMake($technician, pictures: 1)->media->first();

    $this->actingAs(offerCustomer())
        ->get($media->url)
        ->assertOk()
        ->assertHeader('Content-Type', 'image/jpeg')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

test('files can be fetched in parts, which video players rely on', function () {
    $media = offerMake(offerTechnician(), pictures: 1)->media->first();

    $this->actingAs(offerCustomer())
        ->get($media->url, ['Range' => 'bytes=0-9'])
        ->assertStatus(206);
});

test('offer files are not served to guests, for a missing file, or for a suspended technician', function () {
    $technician = offerTechnician();
    $media = offerMake($technician, pictures: 1)->media->first();

    $this->get($media->url)->assertRedirect(route('login'));

    $viewer = offerCustomer();

    Storage::disk(Offer::MEDIA_DISK)->delete($media->path);
    $this->actingAs($viewer)->get($media->url)->assertNotFound();

    $other = offerMake($technician, ['title' => 'Other'], pictures: 1)->media->first();
    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($viewer)->get($other->url)->assertNotFound();
});

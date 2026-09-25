<?php

namespace App\Http\Controllers;

use App\Models\Offer;
use App\Models\OfferMedia;
use App\Models\Category;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class TechnicianOfferController extends Controller
{
    /** The technician's own offers, with the forms to add and edit them. */
    public function index(Request $request): Response
    {
        $offers = $request->user()
            ->offers()
            ->with(['media', 'categories', 'technician.technicianProfile'])
            ->latest()
            ->latest('id')
            ->get()
            // The same card the feed lists: the technician behind it and when it was posted come with it.
            ->map(fn (Offer $offer) => OfferController::card($offer))
            ->all();

        return Inertia::render('Technicians/Offers', [
            'offers' => $offers,
        ] + self::formProps());
    }

    /**
     * What the add/edit offer form needs: the categories an offer can be tagged
     * with, and the limits and extensions it lets through. Shared by the offers
     * page and the technician's own public profile.
     *
     * @return array<string, mixed>
     */
    public static function formProps(): array
    {
        return [
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'limits' => Offer::limits() + [
                'max_offers' => Offer::MAX_PER_TECHNICIAN,
                'image_extensions' => Offer::IMAGE_EXTENSIONS,
                'video_extensions' => Offer::VIDEO_EXTENSIONS,
            ],
        ];
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->offers()->count() >= Offer::MAX_PER_TECHNICIAN) {
            throw ValidationException::withMessages([
                'title' => 'You can have up to '.Offer::MAX_PER_TECHNICIAN.' offers. Delete one to add another.',
            ]);
        }

        $validated = $this->validateOffer($request);
        $stored = [];

        // Everything is stored before the rows are written, and removed again
        // if writing fails, so a failed save never leaves files behind.
        try {
            DB::transaction(function () use ($request, $user, $validated, &$stored) {
                $offer = $user->offers()->create(Arr::only($validated, ['title', 'description', 'price']));
                $offer->categories()->sync($validated['categories'] ?? []);

                $this->attachFiles($offer, $request->file('media', []), $stored);
            });
        } catch (Throwable $e) {
            Storage::disk(Offer::MEDIA_DISK)->delete($stored);

            throw $e;
        }

        return back()->with('success', 'Your offer has been added.');
    }

    public function update(Request $request, Offer $offer): RedirectResponse
    {
        abort_unless($offer->technician_id === $request->user()->id, 403);

        // Only files that really belong to this offer can be removed.
        $removing = $offer->media()
            ->whereIn('id', array_filter(Arr::wrap($request->input('remove_media', [])), 'is_numeric'))
            ->get();

        $validated = $this->validateOffer($request, keptFiles: $offer->media()->count() - $removing->count());
        $stored = [];

        try {
            DB::transaction(function () use ($request, $offer, $validated, $removing, &$stored) {
                $offer->update(Arr::only($validated, ['title', 'description', 'price']));
                $offer->categories()->sync($validated['categories'] ?? []);

                $this->attachFiles($offer, $request->file('media', []), $stored);

                OfferMedia::whereKey($removing->modelKeys())->delete();
            });
        } catch (Throwable $e) {
            Storage::disk(Offer::MEDIA_DISK)->delete($stored);

            throw $e;
        }

        // Only now, once the rows are gone, are the old files deleted.
        Storage::disk(Offer::MEDIA_DISK)->delete($removing->pluck('path')->all());

        return back()->with('success', 'Your offer has been saved.');
    }

    public function destroy(Request $request, Offer $offer): RedirectResponse
    {
        abort_unless($offer->technician_id === $request->user()->id, 403);

        $paths = $offer->media()->pluck('path')->all();

        // The media rows go with the offer (database cascade); the files don't.
        $offer->delete();

        Storage::disk(Offer::MEDIA_DISK)->delete($paths);

        return back()->with('success', 'The offer has been deleted.');
    }

    /**
     * Stream a picture or video to any signed-in user.
     *
     * Files live on the private disk, so this route is the only way to reach
     * them. It answers with a file response rather than a plain stream because
     * that one supports range requests, which browsers need to play and seek
     * in a video (Safari won't play one without them). The content type comes
     * from the type checked at upload, and "nosniff" stops the browser from
     * second-guessing it.
     */
    public function media(OfferMedia $media): BinaryFileResponse
    {
        abort_if($media->offer->technician->isHidden(), 404);

        $disk = Storage::disk(Offer::MEDIA_DISK);
        abort_unless($disk->exists($media->path), 404);

        return response()->file($disk->path($media->path), [
            'Content-Type' => $media->mime,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * @param  int  $keptFiles  Files the offer keeps, which count against the per-offer maximum.
     * @return array<string, mixed>
     */
    private function validateOffer(Request $request, int $keptFiles = 0): array
    {
        $limits = Offer::limits();

        return $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['nullable', 'string', 'max:60'],
            // One or more tags. An empty form sends none at all, which clears them.
            'categories' => ['nullable', 'array'],
            'categories.*' => ['integer', 'distinct', Rule::exists('categories', 'id')],
            'media' => [
                'nullable',
                'array',
                'max:'.max($limits['max_files'] - $keptFiles, 0),
                // Keeps one save from carrying an enormous upload.
                function (string $attribute, mixed $value, Closure $fail) use ($limits) {
                    $bytes = collect($value)
                        ->filter(fn ($file) => $file instanceof UploadedFile)
                        ->sum(fn (UploadedFile $file) => $file->getSize());

                    if ($bytes > $limits['max_total_kb'] * 1024) {
                        $fail('The files together may not be larger than '.$this->megabytes($limits['max_total_kb']).'.');
                    }
                },
            ],
            'media.*' => [
                'bail',
                'file',
                // Checked against the file's real content type, not just its name.
                'mimetypes:'.implode(',', array_keys(Offer::MEDIA_MIMES)),
                function (string $attribute, mixed $value, Closure $fail) use ($limits) {
                    $isVideo = (Offer::MEDIA_MIMES[$value->getMimeType()] ?? null) === 'video';
                    $maxKb = $isVideo ? $limits['video_max_kb'] : $limits['image_max_kb'];

                    if ($value->getSize() > $maxKb * 1024) {
                        $fail(($isVideo ? 'Videos' : 'Pictures').' may not be larger than '.$this->megabytes($maxKb).'.');
                    }
                },
            ],
        ], [
            'title.required' => 'Give your offer a title.',
            'categories.*.exists' => 'Pick categories from the list.',
            'media.max' => 'An offer can have up to '.$limits['max_files'].' pictures and videos in total.',
            'media.*.uploaded' => 'A file could not be uploaded. It may be too large.',
            'media.*.mimetypes' => 'Use JPG, PNG, WebP or GIF pictures, or MP4, WebM or MOV videos.',
        ]);
    }

    /**
     * Store the uploaded files and add a row for each. The paths are collected
     * in $stored so the caller can delete them if the save fails.
     *
     * @param  array<int, UploadedFile>  $files
     * @param  array<int, string>  $stored
     */
    private function attachFiles(Offer $offer, array $files, array &$stored): void
    {
        foreach ($files as $file) {
            $path = $file->store("offer-media/{$offer->technician_id}", Offer::MEDIA_DISK);

            abort_if($path === false, 500, 'A file could not be saved.');

            $stored[] = $path;

            $name = $file->getClientOriginalName();

            $offer->media()->create([
                'path' => $path,
                // Keep the end of an over-long name so the extension survives.
                'name' => mb_strlen($name) > 200 ? mb_substr($name, -200) : $name,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }
    }

    /** 5120 -> "5 MB", 1536 -> "1.5 MB". */
    private function megabytes(int $kb): string
    {
        return round($kb / 1024, 1).' MB';
    }
}

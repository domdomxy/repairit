<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Offer;
use App\Models\Quote;
use App\Models\RequestMedia;
use App\Models\ServiceRequest;
use App\Models\User;
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

/**
 * Repair requests: a customer describes something they need fixed and
 * technicians answer with quotes (see QuoteController). Every signed-in person
 * can post one, browse the open ones and manage their own.
 */
class ServiceRequestController extends Controller
{
    /** Most requests a profile lists to other people: the latest open ones. The person who posted them sees all of theirs. */
    private const PROFILE_LIMIT = 20;

    public function create(Request $request): Response
    {
        return Inertia::render('Requests/Form', [
            'serviceRequest' => null,
            'categories' => $this->categories(),
            'limits' => $this->limits(),
            // Their public city is a sensible starting point.
            'defaultCity' => $request->user()->city ?: $request->user()->technicianProfile?->city,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validated($request);

        $this->ensureRoomForAnotherOpenRequest($user->serviceRequests()->open()->count(), 'description');

        $stored = [];

        // The files are stored before the rows are written, and removed again
        // if writing fails, so a failed save never leaves files behind.
        try {
            $serviceRequest = DB::transaction(function () use ($request, $user, $data, &$stored) {
                $serviceRequest = $user->serviceRequests()->create(Arr::only($data, ['description', 'budget', 'city']));
                $serviceRequest->categories()->sync($data['categories'] ?? []);

                $this->attachFiles($serviceRequest, $request->file('media', []), $stored);

                return $serviceRequest;
            });
        } catch (Throwable $e) {
            Storage::disk(Offer::MEDIA_DISK)->delete($stored);

            throw $e;
        }

        // Posted from a panel on another page (the feed, the customer's profile): stay there, as adding an offer does.
        $response = $request->boolean('from_panel') ? back() : redirect()->route('requests.show', $serviceRequest);

        return $response->with('success', 'Your request is posted. Technicians can now send you quotes.');
    }

    public function show(Request $request, ServiceRequest $serviceRequest): Response
    {
        $viewer = $request->user();
        $isOwner = $serviceRequest->customer_id === $viewer->id;

        $serviceRequest->load(['customer:id,name,avatar_path,role,suspended_at', 'categories', 'media'])->loadCount('quotes');

        abort_if(! $isOwner && $serviceRequest->customer->isSuspended(), 404);
        abort_if($serviceRequest->customer->hasBlocked($viewer), 404);

        $isTechnician = $viewer->role === 'technician' && ! $isOwner;

        // Quotes are private: the customer sees all of them, a technician only
        // their own, and everybody else just how many there are.
        $quotes = [];
        $myQuote = null;

        if ($isOwner) {
            $quotes = $serviceRequest->quotes()
                ->with('technician.technicianProfile')
                ->orderByRaw('accepted_at is null')
                ->latest()
                ->latest('id')
                ->get()
                ->map(fn (Quote $quote) => $quote->toClient())
                ->all();
        } elseif ($isTechnician) {
            $myQuote = $serviceRequest->quotes()
                ->where('technician_id', $viewer->id)
                ->with('technician.technicianProfile')
                ->first()
                ?->toClient();
        }

        return Inertia::render('Requests/Show', [
            'serviceRequest' => $serviceRequest->toCard(),
            'isOwner' => $isOwner,
            'quotes' => $quotes,
            'myQuote' => $myQuote,
            'canQuote' => $isTechnician && $serviceRequest->isOpen() && $viewer->technicianProfile !== null,
            'limits' => $this->limits(),
        ]);
    }

    public function edit(Request $request, ServiceRequest $serviceRequest): Response
    {
        $this->ensureOwner($request, $serviceRequest);

        $serviceRequest->load(['customer:id,name,avatar_path,role', 'categories', 'media']);

        return Inertia::render('Requests/Form', [
            'serviceRequest' => $serviceRequest->toCard(),
            'categories' => $this->categories(),
            'limits' => $this->limits(),
            'defaultCity' => null,
        ]);
    }

    public function update(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $this->ensureOwner($request, $serviceRequest);

        // Only files that really belong to this request can be removed.
        $removing = $serviceRequest->media()
            ->whereIn('id', array_filter(Arr::wrap($request->input('remove_media', [])), 'is_numeric'))
            ->get();

        $data = $this->validated($request, keptFiles: $serviceRequest->media()->count() - $removing->count());
        $stored = [];

        try {
            DB::transaction(function () use ($request, $serviceRequest, $data, $removing, &$stored) {
                $serviceRequest->update(Arr::only($data, ['description', 'budget', 'city']));
                $serviceRequest->categories()->sync($data['categories'] ?? []);

                $this->attachFiles($serviceRequest, $request->file('media', []), $stored);

                RequestMedia::whereKey($removing->modelKeys())->delete();
            });
        } catch (Throwable $e) {
            Storage::disk(Offer::MEDIA_DISK)->delete($stored);

            throw $e;
        }

        // Only now, once the rows are gone, are the old files deleted.
        Storage::disk(Offer::MEDIA_DISK)->delete($removing->pluck('path')->all());

        // Edited from a panel on another page (the feed): stay there, as posting from one does.
        $response = $request->boolean('from_panel') ? back() : redirect()->route('requests.show', $serviceRequest);

        return $response->with('success', 'Your request was updated.');
    }

    public function destroy(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $this->ensureOwner($request, $serviceRequest);

        $paths = $serviceRequest->media()->pluck('path')->all();

        // Its quotes, category tags and media rows go with it (cascade); the files don't.
        $serviceRequest->delete();

        Storage::disk(Offer::MEDIA_DISK)->delete($paths);

        // Deleted from the feed (`from_panel`): stay there. On the request's own page it no longer exists, so leave for the feed.
        $response = $request->boolean('from_panel') ? back() : redirect()->route('feed.index');

        return $response->with('success', 'Your request was deleted.');
    }

    /** Stop taking quotes, without deleting anything. */
    public function close(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $this->ensureOwner($request, $serviceRequest);

        $serviceRequest->update(['status' => ServiceRequest::STATUS_CLOSED]);

        return back()->with('success', 'Your request is closed. Technicians can no longer send quotes.');
    }

    /** Take quotes again. The technician chosen before, if any, is no longer chosen. */
    public function reopen(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $this->ensureOwner($request, $serviceRequest);

        if (! $serviceRequest->isOpen()) {
            $this->ensureRoomForAnotherOpenRequest($request->user()->serviceRequests()->open()->count(), 'status');
        }

        $serviceRequest->quotes()->update(['accepted_at' => null]);
        $serviceRequest->update(['status' => ServiceRequest::STATUS_OPEN]);

        return back()->with('success', 'Your request is open again.');
    }

    /**
     * Stream a picture or video of a request to any signed-in user. Files live
     * on the private disk, so this route is the only way to reach them (see
     * TechnicianOfferController::media for why it is a file response). The
     * requests of suspended customers are hidden, except from their owner.
     */
    public function media(Request $request, RequestMedia $media): BinaryFileResponse
    {
        $customer = $media->serviceRequest->customer;

        abort_if($customer->isSuspended() && $customer->id !== $request->user()->id, 404);

        $disk = Storage::disk(Offer::MEDIA_DISK);
        abort_unless($disk->exists($media->path), 404);

        return response()->file($disk->path($media->path), [
            'Content-Type' => $media->mime,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * @param  int  $keptFiles  Files the request keeps, which count against the per-request maximum.
     * @return array<string, mixed>
     */
    private function validated(Request $request, int $keptFiles = 0): array
    {
        $limits = Offer::limits();

        return $request->validate([
            'description' => ['required', 'string', 'max:'.ServiceRequest::DESCRIPTION_MAX],
            'budget' => ['nullable', 'string', 'max:'.ServiceRequest::BUDGET_MAX],
            'city' => ['nullable', 'string', 'max:'.ServiceRequest::CITY_MAX],
            'categories' => ['nullable', 'array', 'max:'.ServiceRequest::MAX_CATEGORIES],
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
            'categories.max' => 'Pick at most '.ServiceRequest::MAX_CATEGORIES.' categories.',
            'categories.*.exists' => 'Pick categories from the list.',
            'media.max' => 'A request can have up to '.$limits['max_files'].' pictures and videos in total.',
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
    private function attachFiles(ServiceRequest $serviceRequest, array $files, array &$stored): void
    {
        foreach ($files as $file) {
            $path = $file->store("request-media/{$serviceRequest->customer_id}", Offer::MEDIA_DISK);

            abort_if($path === false, 500, 'A file could not be saved.');

            $stored[] = $path;

            $name = $file->getClientOriginalName();

            $serviceRequest->media()->create([
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

    /** @throws ValidationException */
    private function ensureRoomForAnotherOpenRequest(int $open, string $field): void
    {
        if ($open >= ServiceRequest::MAX_OPEN_PER_CUSTOMER) {
            throw ValidationException::withMessages([
                $field => 'You already have '.ServiceRequest::MAX_OPEN_PER_CUSTOMER.' open requests. Close one before opening another.',
            ]);
        }
    }

    private function ensureOwner(Request $request, ServiceRequest $serviceRequest): void
    {
        abort_unless($serviceRequest->customer_id === $request->user()->id, 403);
    }

    /**
     * The requests a profile lists, as cards: the latest ones. Everybody sees
     * the open requests, as in the feed; the person who posted them also sees
     * all of their own, closed ones included (there is no other list of them). Shared by the customer's and the technician's profile
     * (anyone can post a request).
     *
     * @return list<array<string, mixed>>
     */
    public static function profileCards(User $owner, User $viewer): array
    {
        return $owner->serviceRequests()
            ->when($viewer->isNot($owner), fn ($query) => $query->open())
            ->with(['customer:id,name,avatar_path,role', 'categories', 'media'])
            ->withCount('quotes')
            // Lets a technician see which requests they have already answered.
            ->withExists(['quotes as has_my_quote' => fn ($query) => $query->where('technician_id', $viewer->id)])
            // Their own quote, to change it from the card. Quotes are private: nobody else's is loaded.
            ->with(['quotes' => fn ($query) => $query->where('technician_id', $viewer->id)])
            ->latest()
            ->latest('id')
            ->when($viewer->isNot($owner), fn ($query) => $query->limit(self::PROFILE_LIMIT))
            ->get()
            ->map(fn (ServiceRequest $serviceRequest) => $serviceRequest->toCard() + [
                'has_my_quote' => (bool) $serviceRequest->has_my_quote,
                'my_quote' => $serviceRequest->quotes->first()?->only(['id', 'price', 'estimated_time', 'message']),
            ])
            ->all();
    }

    /**
     * The limits the quote form on a request's card needs: only for a viewer who
     * can send quotes (a technician with a profile), null for everyone else.
     * Shared by the pages that list requests beside the feed.
     *
     * @return array<string, int>|null
     */
    public static function quoteLimitsFor(User $viewer): ?array
    {
        return $viewer->role === 'technician' && $viewer->technicianProfile !== null ? Quote::limits() : null;
    }

    /**
     * What the post-a-request form needs: the categories to tag with and the
     * limits it lets through. Shared by the form page and the feed's panel.
     *
     * @return array<string, mixed>
     */
    public static function formProps(): array
    {
        return [
            'categories' => self::categories(),
            'limits' => self::limits(),
        ];
    }

    /** @return array<string, int|list<string>> */
    private static function limits(): array
    {
        // A request's pictures and videos follow the same rules as an offer's.
        return Offer::limits() + [
            'image_extensions' => Offer::IMAGE_EXTENSIONS,
            'video_extensions' => Offer::VIDEO_EXTENSIONS,
            'description_max' => ServiceRequest::DESCRIPTION_MAX,
            'budget_max' => ServiceRequest::BUDGET_MAX,
            'city_max' => ServiceRequest::CITY_MAX,
            'max_categories' => ServiceRequest::MAX_CATEGORIES,
            'price_max' => Quote::PRICE_MAX,
            'time_max' => Quote::TIME_MAX,
            'message_max' => Quote::MESSAGE_MAX,
        ];
    }

    private static function categories()
    {
        return Category::orderBy('name')->get(['id', 'name', 'slug']);
    }
}

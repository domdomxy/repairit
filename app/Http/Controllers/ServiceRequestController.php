<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Quote;
use App\Models\ServiceRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Repair requests: a customer describes something they need fixed and
 * technicians answer with quotes (see QuoteController). Every signed-in person
 * can post one, browse the open ones and manage their own.
 */
class ServiceRequestController extends Controller
{
    private const PER_PAGE = 12;

    /** Every open request, with search and filters. */
    public function index(Request $request): Response
    {
        return $this->list($request, ServiceRequest::query()->open()->fromActiveCustomers(), 'all');
    }

    /** The requests this person posted, open or closed. */
    public function mine(Request $request): Response
    {
        return $this->list($request, ServiceRequest::query()->where('customer_id', $request->user()->id), 'mine');
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Requests/Form', [
            'serviceRequest' => null,
            'categories' => $this->categories(),
            'limits' => $this->limits(),
            // Their public city is a sensible starting point.
            'defaultCity' => $request->user()->city,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validated($request);

        $this->ensureRoomForAnotherOpenRequest($user->serviceRequests()->open()->count(), 'title');

        $serviceRequest = $user->serviceRequests()->create(Arr::only($data, ['title', 'description', 'budget', 'city']));
        $serviceRequest->categories()->sync($data['categories'] ?? []);

        return redirect()
            ->route('requests.show', $serviceRequest)
            ->with('success', 'Your request is posted. Technicians can now send you quotes.');
    }

    public function show(Request $request, ServiceRequest $serviceRequest): Response
    {
        $viewer = $request->user();
        $isOwner = $serviceRequest->customer_id === $viewer->id;

        $serviceRequest->load(['customer:id,name,avatar_path,role,suspended_at', 'categories'])->loadCount('quotes');

        abort_if(! $isOwner && $serviceRequest->customer->isSuspended(), 404);

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

        $serviceRequest->load(['customer:id,name,avatar_path,role', 'categories']);

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

        $data = $this->validated($request);

        $serviceRequest->update(Arr::only($data, ['title', 'description', 'budget', 'city']));
        $serviceRequest->categories()->sync($data['categories'] ?? []);

        return redirect()->route('requests.show', $serviceRequest)->with('success', 'Your request was updated.');
    }

    public function destroy(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $this->ensureOwner($request, $serviceRequest);

        // Its quotes and category tags go with it (cascade).
        $serviceRequest->delete();

        return redirect()->route('requests.mine')->with('success', 'Your request was deleted.');
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
     * The list page for both tabs: the same cards and filters, over different
     * sets of requests.
     *
     * @param  'all'|'mine'  $scope
     */
    private function list(Request $request, Builder $query, string $scope): Response
    {
        $user = $request->user();

        // Free text: matches the title or the description.
        $term = trim((string) $request->input('q'));

        if ($term !== '') {
            $like = $this->likePattern($term);

            $query->where(function ($q) use ($like) {
                $q->whereRaw("service_requests.title LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("service_requests.description LIKE ? ESCAPE '!'", [$like]);
            });
        }

        if ($request->filled('category')) {
            $slug = (string) $request->input('category');

            $query->whereHas('categories', fn ($q) => $q->where('categories.slug', $slug));
        }

        if ($request->filled('city')) {
            $query->whereRaw("service_requests.city LIKE ? ESCAPE '!'", [$this->likePattern((string) $request->input('city'))]);
        }

        $requests = $query
            ->with(['customer:id,name,avatar_path,role', 'categories'])
            ->withCount('quotes')
            // Lets a technician see which requests they have already answered.
            ->withExists(['quotes as has_my_quote' => fn ($q) => $q->where('technician_id', $user->id)])
            ->orderByDesc('service_requests.created_at')
            ->orderByDesc('service_requests.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (ServiceRequest $serviceRequest) => $serviceRequest->toCard() + [
                'has_my_quote' => (bool) $serviceRequest->has_my_quote,
            ]);

        return Inertia::render('Requests/Index', [
            'requests' => $requests,
            'categories' => $this->categories(),
            'scope' => $scope,
            // Cast to an object: an empty PHP array reaches the browser as a JS array.
            'filters' => (object) $request->only(['q', 'category', 'city']),
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:'.ServiceRequest::TITLE_MAX],
            'description' => ['required', 'string', 'max:'.ServiceRequest::DESCRIPTION_MAX],
            'budget' => ['nullable', 'string', 'max:'.ServiceRequest::BUDGET_MAX],
            'city' => ['nullable', 'string', 'max:'.ServiceRequest::CITY_MAX],
            'categories' => ['nullable', 'array', 'max:'.ServiceRequest::MAX_CATEGORIES],
            'categories.*' => ['integer', 'distinct', Rule::exists('categories', 'id')],
        ], [
            'categories.max' => 'Pick at most '.ServiceRequest::MAX_CATEGORIES.' categories.',
            'categories.*.exists' => 'Pick categories from the list.',
        ]);
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

    /** @return array{title_max: int, description_max: int, budget_max: int, city_max: int, max_categories: int, price_max: int, time_max: int, message_max: int} */
    private function limits(): array
    {
        return [
            'title_max' => ServiceRequest::TITLE_MAX,
            'description_max' => ServiceRequest::DESCRIPTION_MAX,
            'budget_max' => ServiceRequest::BUDGET_MAX,
            'city_max' => ServiceRequest::CITY_MAX,
            'max_categories' => ServiceRequest::MAX_CATEGORIES,
            'price_max' => Quote::PRICE_MAX,
            'time_max' => Quote::TIME_MAX,
            'message_max' => Quote::MESSAGE_MAX,
        ];
    }

    private function categories()
    {
        return Category::orderBy('name')->get(['id', 'name', 'slug']);
    }

    /** A search term as a LIKE pattern, with its own wildcards escaped (the queries use "!" as the escape character). */
    private function likePattern(string $term): string
    {
        $term = mb_substr(trim($term), 0, 100);

        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
    }
}

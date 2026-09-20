<?php

namespace App\Http\Controllers;

use App\Models\Repair;
use App\Models\User;
use App\Notifications\RepairUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The technician's side of repair tracking: start tracking something a
 * customer left, post updates as it moves along, fix its details, delete it.
 * What the customer sees is RepairController.
 */
class TechnicianRepairController extends Controller
{
    private const PER_PAGE = 15;

    private const FILTERS = ['active', 'closed', 'all'];

    /** The technician's repairs, with the form to start tracking a new one. */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $filter = in_array($request->input('filter'), self::FILTERS, true) ? $request->input('filter') : 'active';

        $repairs = $user->technicianRepairs()
            ->with('customer:id,name,avatar_path')
            ->when($filter === 'active', fn ($query) => $query->whereNotIn('status', Repair::CLOSED_STATUSES))
            ->when($filter === 'closed', fn ($query) => $query->whereIn('status', Repair::CLOSED_STATUSES))
            // The ones that moved last first.
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Repair $repair) => $repair->toListItem() + [
                'customer' => $repair->customer ? ['id' => $repair->customer->id, 'name' => $repair->customer->name] : null,
            ]);

        return Inertia::render('Technicians/Repairs', [
            'repairs' => $repairs,
            'filter' => $filter,
            'counts' => [
                'active' => $user->technicianRepairs()->whereNotIn('status', Repair::CLOSED_STATUSES)->count(),
                'closed' => $user->technicianRepairs()->whereIn('status', Repair::CLOSED_STATUSES)->count(),
            ],
            'customers' => Repair::customerChoices($user),
        ]);
    }

    /** Start tracking something. Its page is where the link to give the customer is. */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $this->validateDetails($request, $user);

        $repair = DB::transaction(function () use ($user, $data) {
            $repair = $user->technicianRepairs()->create($data + [
                'code' => Repair::generateCode(),
                'status' => 'received',
            ]);

            // The timeline starts with the drop-off.
            $repair->updates()->create(['status' => 'received']);

            return $repair;
        });

        $this->tell($repair, 'started');

        return redirect()
            ->route('repairs.show', $repair)
            ->with('success', 'Tracking started. Give the link on this page to your customer.');
    }

    /** Fix the title, the details or the customer the repair is linked to. */
    public function update(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeOwner($request, $repair);

        $repair->update($this->validateDetails($request, $request->user()));

        // Linking a customer for the first time (or another one) tells them.
        if ($repair->wasChanged('customer_id') && $repair->customer_id !== null) {
            $repair->unsetRelation('customer');
            $this->tell($repair, 'started');
        }

        return back()->with('success', 'Details saved.');
    }

    /**
     * Post an update: a new status, a note, or both. It goes on the timeline,
     * and the customer (if the repair is linked to their account) is told.
     */
    public function storeUpdate(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeOwner($request, $repair);

        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(Repair::STATUSES))],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $note = $data['note'] ?? null;
        $statusChanged = $data['status'] !== $repair->status;

        if (! $statusChanged && $note === null) {
            throw ValidationException::withMessages([
                'note' => 'Change the status or write a note for your customer.',
            ]);
        }

        DB::transaction(function () use ($repair, $data, $note) {
            $repair->updates()->create(['status' => $data['status'], 'note' => $note]);

            // touch() also saves the new status, and moves the repair up the list even when only a note was added.
            $repair->status = $data['status'];
            $repair->touch();
        });

        $this->tell($repair, $statusChanged ? 'status' : 'note', $note);

        return back()->with('success', 'Update posted.');
    }

    public function destroy(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeOwner($request, $repair);

        $repair->delete();

        return redirect()->route('technician.repairs.index')->with('success', 'Tracking deleted.');
    }

    /** @return array{title: string, description: ?string, customer_id: ?int} */
    private function validateDetails(Request $request, User $technician): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            // Only customers this technician has a conversation with.
            'customer_id' => [
                'nullable',
                'integer',
                Rule::exists('conversations', 'customer_id')->where('technician_id', $technician->id),
            ],
        ]);
    }

    /** Somebody else's repair does not exist as far as this technician is concerned. */
    private function authorizeOwner(Request $request, Repair $repair): void
    {
        abort_unless($repair->technician_id === $request->user()->id, 404);
    }

    /** Tell the customer whose account the repair is linked to, if there is one. */
    private function tell(Repair $repair, string $event, ?string $note = null): void
    {
        $repair->customer?->notify(new RepairUpdated($repair, $event, $repair->status, $note));
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Repair;
use App\Models\RepairUpdate;
use App\Models\RepairUpdateAttachment;
use App\Models\User;
use App\Notifications\RepairGuestUpdated;
use App\Notifications\RepairUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

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

        // The search box: the title, the code and the customer's name.
        $term = $request->string('q')->trim()->toString();

        $repairs = $user->technicianRepairs()
            ->with('customer:id,name,avatar_path')
            ->when($term !== '', fn ($query) => $query->search($term, 'customer'))
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
            'filters' => ['q' => $term],
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
     * Post an update: a new status, a note, files, or any of them. It goes on
     * the timeline, and the customer (if the repair is linked to their account)
     * is told.
     */
    public function storeUpdate(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeOwner($request, $repair);

        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(Repair::STATUSES))],
            'note' => ['nullable', 'string', 'max:500'],
            'attachments' => [
                'nullable',
                'array',
                'max:'.RepairUpdate::ATTACHMENT_MAX_FILES,
                function (string $attribute, mixed $value, \Closure $fail) {
                    $bytes = collect($value)
                        ->filter(fn ($file) => $file instanceof UploadedFile)
                        ->sum(fn (UploadedFile $file) => $file->getSize());

                    if ($bytes > RepairUpdate::ATTACHMENT_MAX_TOTAL_KB * 1024) {
                        $fail('The files together may not be larger than '.(RepairUpdate::ATTACHMENT_MAX_TOTAL_KB / 1024).' MB.');
                    }
                },
            ],
            'attachments.*' => [
                'file',
                'max:'.RepairUpdate::ATTACHMENT_MAX_KB,
                'mimes:'.implode(',', RepairUpdate::ATTACHMENT_EXTENSIONS),
            ],
        ], [
            'attachments.max' => 'You can attach up to '.RepairUpdate::ATTACHMENT_MAX_FILES.' files to one update.',
            'attachments.*.uploaded' => 'A file could not be uploaded. It may be too large.',
            'attachments.*.max' => 'Each file may not be larger than '.(RepairUpdate::ATTACHMENT_MAX_KB / 1024).' MB.',
            'attachments.*.mimes' => 'That file type is not allowed.',
            'attachments.*.file' => 'That is not a valid file.',
        ]);

        $note = $data['note'] ?? null;
        $files = $request->file('attachments', []);
        $statusChanged = $data['status'] !== $repair->status;

        if (! $statusChanged && $note === null && $files === []) {
            throw ValidationException::withMessages([
                'note' => 'Change the status, write a note or attach a file for your customer.',
            ]);
        }

        // Every stored path is remembered, so a failure after a file was saved never leaves it behind.
        $stored = [];

        try {
            DB::transaction(function () use ($repair, $data, $note, $files, &$stored) {
                $update = $repair->updates()->create(['status' => $data['status'], 'note' => $note]);

                foreach ($files as $file) {
                    $path = $file->store("repair-attachments/{$repair->id}", RepairUpdate::ATTACHMENT_DISK);

                    abort_if($path === false, 500, 'A file could not be saved.');

                    $stored[] = $path;

                    $name = $file->getClientOriginalName();

                    $update->attachments()->create([
                        'path' => $path,
                        // Keep the end of an over-long name so the extension survives.
                        'name' => mb_strlen($name) > 200 ? mb_substr($name, -200) : $name,
                        'mime' => $file->getMimeType() ?: 'application/octet-stream',
                        'size' => $file->getSize(),
                    ]);
                }

                // touch() also saves the new status, and moves the repair up the list even when only a note was added.
                $repair->status = $data['status'];
                $repair->touch();
            });
        } catch (Throwable $e) {
            Storage::disk(RepairUpdate::ATTACHMENT_DISK)->delete($stored);

            throw $e;
        }

        $this->tell($repair, $statusChanged ? 'status' : 'note', $note);

        return back()->with('success', 'Update posted.');
    }

    public function destroy(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeOwner($request, $repair);

        // The rows go with the repair; the files on disk do not, so remove them too.
        $paths = RepairUpdateAttachment::whereHas('repairUpdate', fn ($query) => $query->where('repair_id', $repair->id))
            ->pluck('path')
            ->all();

        $repair->delete();

        Storage::disk(RepairUpdate::ATTACHMENT_DISK)->delete($paths);

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

    /**
     * Tell the customer whose account the repair is linked to, if there is one,
     * and whoever left an email on the tracking page. 'started' is only for the
     * account: it says a technician began tracking something for you.
     */
    private function tell(Repair $repair, string $event, ?string $note = null): void
    {
        $repair->customer?->notifyFrom($repair->technician, new RepairUpdated($repair, $event, $repair->status, $note));

        if ($event !== 'started' && $repair->guest_email !== null) {
            Notification::route('mail', $repair->guest_email)
                ->notify(new RepairGuestUpdated($repair, $event, $repair->status, $repair->guest_email));
        }
    }
}

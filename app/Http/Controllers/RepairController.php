<?php

namespace App\Http\Controllers;

use App\Models\Repair;
use App\Models\RepairUpdate;
use App\Models\RepairUpdateAttachment;
use App\Notifications\RepairUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Following a repair: the list of the ones a technician linked to your account,
 * and the tracking page reached from the link the technician gives out.
 *
 * The page is open to anyone who has the code, signed in or not, like an
 * unlisted link: a technician can track a repair for somebody with no account
 * and just give them the link. So it shows what is needed to follow the repair
 * and no contact details. Managing a repair is TechnicianRepairController.
 */
class RepairController extends Controller
{
    private const PER_PAGE = 15;

    /** The tabs of the customer's list: everything, the repairs still going, and the ones that are over. */
    private const FILTERS = ['all', 'active', 'closed'];

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // Technicians manage repairs; they have their own list.
        if ($user->role === 'technician') {
            return redirect()->route('technician.repairs.index');
        }

        // Everything by default: a customer has few repairs, and would otherwise
        // open the page on an empty "active" tab when theirs are all done.
        $filter = in_array($request->input('filter'), self::FILTERS, true) ? $request->input('filter') : 'all';

        // The search box: the title, the code and the technician's name.
        $term = $request->string('q')->trim()->toString();

        $repairs = $user->customerRepairs()
            ->with('technician:id,name,avatar_path')
            ->when($term !== '', fn ($query) => $query->search($term, 'technician'))
            ->when($filter === 'active', fn ($query) => $query->whereNotIn('status', Repair::CLOSED_STATUSES))
            ->when($filter === 'closed', fn ($query) => $query->whereIn('status', Repair::CLOSED_STATUSES))
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Repair $repair) => $repair->toListItem() + [
                'technician' => [
                    'id' => $repair->technician->id,
                    'name' => $repair->technician->name,
                    'avatar_url' => $repair->technician->avatar_url,
                ],
            ]);

        return Inertia::render('Repairs/Index', [
            'repairs' => $repairs,
            'filter' => $filter,
            'filters' => ['q' => $term],
            'counts' => [
                'all' => $user->customerRepairs()->count(),
                'active' => $user->customerRepairs()->whereNotIn('status', Repair::CLOSED_STATUSES)->count(),
                'closed' => $user->customerRepairs()->whereIn('status', Repair::CLOSED_STATUSES)->count(),
            ],
        ]);
    }

    /**
     * The welcome page's "track your repair" box: somebody types the code the
     * technician gave them, or pastes the whole link, and lands on the page.
     * A code that does not exist is said so on the box instead of on a 404 page.
     */
    public function lookup(Request $request): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:300']]);

        $code = $this->normalizeCode($data['code']);
        $repair = $code === null ? null : Repair::where('code', $code)->first();

        if (! $repair) {
            throw ValidationException::withMessages([
                'code' => "We couldn't find a repair with that code. Check the code or the link your technician gave you.",
            ]);
        }

        return redirect()->route('repairs.show', $repair);
    }

    /**
     * What people type for a code: the code itself in any case, the eight
     * characters without the REP- start, or the whole link. Null when it cannot
     * be a code at all.
     */
    private function normalizeCode(string $input): ?string
    {
        $input = trim($input);

        // A pasted link: the code is the last part of its path.
        $path = parse_url($input, PHP_URL_PATH);
        $candidate = is_string($path) && $path !== '' ? basename(rtrim($path, '/')) : $input;

        $candidate = strtoupper(preg_replace('/\s+/', '', $candidate));

        if (preg_match('/^[A-Z2-9]{8}$/', $candidate)) {
            $candidate = "REP-{$candidate}";
        }

        return preg_match('/^REP-[A-Z2-9]{8}$/', $candidate) ? $candidate : null;
    }

    public function show(Request $request, Repair $repair): Response
    {
        // Null for somebody following it with just the link.
        $user = $request->user();
        $isOwner = $user !== null && $repair->technician_id === $user->id;

        $repair->load(['technician.technicianProfile', 'customer:id,name', 'updates.attachments']);

        // Opening the page settles its notifications.
        $user?->unreadNotifications()
            ->where('type', RepairUpdated::class)
            ->get()
            ->filter(fn ($notification) => ($notification->data['repair_id'] ?? null) === $repair->id)
            ->each->markAsRead();

        $technician = $repair->technician;

        return Inertia::render('Repairs/Show', [
            'repair' => $repair->toListItem() + [
                'description' => $repair->description,
                // Somebody with no account only gets the name: the profile is behind the sign-in.
                'technician' => $user === null
                    ? ['name' => $technician->name]
                    : [
                        'id' => $technician->id,
                        'name' => $technician->name,
                        'avatar_url' => $technician->avatar_url,
                        'city' => $technician->technicianProfile?->city,
                    ],
                // Who it is for is the technician's business, not that of everyone with the link.
                'customer' => $isOwner && $repair->customer ? ['id' => $repair->customer->id, 'name' => $repair->customer->name] : null,
            ],
            'updates' => $repair->updates->map(fn (RepairUpdate $update) => $update->toTimelineEntry($repair))->all(),
            'statuses' => Repair::STATUSES,
            'isOwner' => $isOwner,
            'customers' => $isOwner ? Repair::customerChoices($user) : [],
            'attachmentLimits' => $isOwner ? RepairUpdate::attachmentLimits() : null,
        ]);
    }

    /**
     * Stream a file of an update. Like the page itself, it is open to anyone
     * who has the repair's code, and only for that repair: the file must
     * belong to it. Files are on the private disk, so this is the only way
     * to reach them. Pictures, clips and PDFs are shown inline; every other type
     * is forced to download, so an upload can never run as a page.
     */
    public function attachment(Repair $repair, RepairUpdateAttachment $attachment): StreamedResponse
    {
        abort_unless($attachment->repairUpdate?->repair_id === $repair->id, 404);

        $disk = Storage::disk(RepairUpdate::ATTACHMENT_DISK);

        abort_unless($disk->exists($attachment->path), 404);

        $inline = $attachment->isInline();

        return $disk->response(
            $attachment->path,
            $attachment->name,
            array_filter([
                'Content-Type' => $inline ? $attachment->mime : null,
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, max-age=86400',
            ]),
            $inline ? 'inline' : 'attachment',
        );
    }
}

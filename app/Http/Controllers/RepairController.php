<?php

namespace App\Http\Controllers;

use App\Models\Repair;
use App\Models\RepairUpdate;
use App\Notifications\RepairUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Following a repair: the list of the ones a technician linked to your account,
 * and the tracking page reached from the link the technician gives out.
 *
 * The page is open to anyone signed in who has the code, like an unlisted
 * link, so it shows what is needed to follow the repair and no contact details.
 * Managing a repair is TechnicianRepairController.
 */
class RepairController extends Controller
{
    private const PER_PAGE = 15;

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // Technicians manage repairs; they have their own list.
        if ($user->role === 'technician') {
            return redirect()->route('technician.repairs.index');
        }

        $repairs = $user->customerRepairs()
            ->with('technician:id,name,avatar_path')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->through(fn (Repair $repair) => $repair->toListItem() + [
                'technician' => [
                    'id' => $repair->technician->id,
                    'name' => $repair->technician->name,
                    'avatar_url' => $repair->technician->avatar_url,
                ],
            ]);

        return Inertia::render('Repairs/Index', ['repairs' => $repairs]);
    }

    public function show(Request $request, Repair $repair): Response
    {
        $user = $request->user();
        $isOwner = $repair->technician_id === $user->id;

        $repair->load(['technician.technicianProfile', 'customer:id,name', 'updates']);

        // Opening the page settles its notifications.
        $user->unreadNotifications()
            ->where('type', RepairUpdated::class)
            ->get()
            ->filter(fn ($notification) => ($notification->data['repair_id'] ?? null) === $repair->id)
            ->each->markAsRead();

        $technician = $repair->technician;

        return Inertia::render('Repairs/Show', [
            'repair' => $repair->toListItem() + [
                'description' => $repair->description,
                'technician' => [
                    'id' => $technician->id,
                    'name' => $technician->name,
                    'avatar_url' => $technician->avatar_url,
                    'city' => $technician->technicianProfile?->city,
                ],
                // Who it is for is the technician's business, not that of everyone with the link.
                'customer' => $isOwner && $repair->customer ? ['id' => $repair->customer->id, 'name' => $repair->customer->name] : null,
            ],
            'updates' => $repair->updates->map(fn (RepairUpdate $update) => $update->toTimelineEntry())->all(),
            'statuses' => Repair::STATUSES,
            'isOwner' => $isOwner,
            'customers' => $isOwner ? Repair::customerChoices($user) : [],
        ]);
    }
}

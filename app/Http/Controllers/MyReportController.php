<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Notifications\ReportAcknowledged;
use App\Notifications\ReportClosed;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The reports a person filed, as the person who filed them sees them: where each
 * one stands and what they were told. The admins' side is Admin\ReportController.
 * What was decided, the admin's note and who looked at it never show here, and
 * neither does anything about the reported person beyond who they are.
 */
class MyReportController extends Controller
{
    private const PER_PAGE = 10;

    public function index(Request $request): Response
    {
        $reports = $request->user()
            ->filedReports()
            ->with('reportedUser:id,name')
            // What is still being looked at first, then the newest.
            ->orderByRaw("case status when 'open' then 0 else 1 end")
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Report $report) => $report->toReporterItem());

        return Inertia::render('Reports/Index', ['reports' => $reports]);
    }

    public function show(Request $request, Report $report): Response
    {
        $user = $request->user();

        // Somebody else's report does not exist as far as this person is concerned.
        abort_unless($report->reporter_id === $user->id, 404);

        $report->load('reportedUser:id,name');

        // Opening the page settles the notifications about it.
        $user->unreadNotifications()
            ->whereIn('type', [ReportAcknowledged::class, ReportClosed::class])
            ->get()
            ->filter(fn ($notification) => ($notification->data['report_id'] ?? null) === $report->id)
            ->each->markAsRead();

        return Inertia::render('Reports/Show', [
            'report' => $report->toReporterItem() + [
                'details' => $report->details,
                'timeline' => $report->reporterTimeline(),
            ],
        ]);
    }
}

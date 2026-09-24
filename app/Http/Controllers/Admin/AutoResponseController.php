<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\AutoResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The automatic messages around support tickets and reports: the first reply
 * sent when one is created (one per category) and the closure message sent
 * when one is closed (one per outcome). Every entry always shows here — most
 * start out with no row in the database at all, shown with the built-in
 * default text, until an admin edits or disables one.
 */
class AutoResponseController extends Controller
{
    public function index(): Response
    {
        $existing = AutoResponse::all()->keyBy(fn (AutoResponse $row) => "{$row->type}.{$row->category}");

        $build = function (string $type) use ($existing) {
            return collect(AutoResponse::categoriesFor($type))
                ->map(function (string $label, string $category) use ($type, $existing) {
                    $row = $existing->get("{$type}.{$category}");

                    return [
                        'type' => $type,
                        'category' => $category,
                        'label' => $label,
                        'enabled' => $row?->enabled ?? true,
                        // Null (no custom wording) is what lets the placeholder show the default.
                        'body' => $row?->body,
                        'default' => AutoResponse::DEFAULTS["{$type}.{$category}"] ?? '',
                    ];
                })
                ->values();
        };

        return Inertia::render('Admin/AutoResponses/Index', [
            'support' => $build(AutoResponse::TYPE_SUPPORT),
            'reports' => $build(AutoResponse::TYPE_REPORT),
            'supportClosures' => $build(AutoResponse::TYPE_SUPPORT_CLOSURE),
            'reportClosures' => $build(AutoResponse::TYPE_REPORT_CLOSURE),
        ]);
    }

    public function update(Request $request, string $type, string $category): RedirectResponse
    {
        abort_unless(in_array($type, AutoResponse::TYPES, true), 404);
        abort_unless(array_key_exists($category, AutoResponse::categoriesFor($type)), 404);

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            // Empty means "use the default text", not a validation error.
            'body' => ['nullable', 'string', 'max:2000'],
        ]);

        $body = trim((string) ($data['body'] ?? ''));

        AutoResponse::updateOrCreate(
            ['type' => $type, 'category' => $category],
            ['enabled' => $data['enabled'], 'body' => $body !== '' ? $body : null],
        );

        $label = AutoResponse::categoriesFor($type)[$category];
        $what = match ($type) {
            AutoResponse::TYPE_SUPPORT_CLOSURE => 'support closure message',
            AutoResponse::TYPE_REPORT_CLOSURE => 'report closure message',
            default => "{$type} reply",
        };

        AdminLog::record(
            $request->user(),
            'auto_response.updated',
            "Updated the automatic {$what} for \"{$label}\"".($data['enabled'] ? '' : ' (now off)'),
        );

        return back()->with('success', 'Automatic reply saved.');
    }
}

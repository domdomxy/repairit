<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use Inertia\Inertia;
use Inertia\Response;

class LogController extends Controller
{
    public function index(): Response
    {
        $logs = AdminLog::query()
            ->with('admin:id,name')
            ->latest()
            ->orderByDesc('id')
            ->paginate(25)
            ->through(fn (AdminLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'admin' => $log->admin?->name,
                'created_at' => $log->created_at->toIso8601String(),
            ]);

        return Inertia::render('Admin/Logs/Index', ['logs' => $logs]);
    }
}

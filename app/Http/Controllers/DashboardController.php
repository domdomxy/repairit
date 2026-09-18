<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = Auth::user();

        return match ($user->role) {
            'technician' => Inertia::render('Dashboard/Technician', [
                'conversationCount' => $user->technicianConversations()->count(),
            ]),
            'admin' => Inertia::render('Dashboard/Admin', [
                'userCount' => \App\Models\User::count(),
                'technicianCount' => \App\Models\User::where('role', 'technician')->count(),
            ]),
            default => Inertia::render('Dashboard/Customer', [
                'conversationCount' => $user->customerConversations()->count(),
            ]),
        };
    }
}
<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ConversationController extends Controller
{
    // List the current user's conversations (customer or technician side)
    public function index()
    {
        $user = Auth::user();

        $conversations = Conversation::where('customer_id', $user->id)
            ->orWhere('technician_id', $user->id)
            ->with(['customer:id,name', 'technician:id,name'])
            ->withCount(['messages as unread_count' => function ($query) use ($user) {
                $query->whereNull('read_at')->where('sender_id', '!=', $user->id);
            }])
            ->orderByDesc('last_message_at')
            ->get();

        return Inertia::render('Messages/Index', [
            'conversations' => $conversations,
        ]);
    }

    // Start (or reopen) a conversation with a technician, then redirect into it
    public function startWith(User $technician)
    {
        abort_unless($technician->role === 'technician' && ! $technician->isSuspended(), 404);

        $customer = Auth::user();
        abort_if($customer->id === $technician->id, 403);

        $conversation = Conversation::firstOrCreate([
            'customer_id' => $customer->id,
            'technician_id' => $technician->id,
        ]);

        return redirect()->route('conversations.show', $conversation);
    }

    public function show(Conversation $conversation)
    {
        $user = Auth::user();
        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        $conversation->load(['customer:id,name', 'technician:id,name']);

        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->get();

        // Mark incoming messages as read
        $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_id', '!=', $user->id)
            ->update(['read_at' => now()]);

        return Inertia::render('Messages/Show', [
            'conversation' => $conversation,
            'messages' => $messages,
        ]);
    }
}
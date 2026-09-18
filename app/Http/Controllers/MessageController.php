<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MessageController extends Controller
{
    public function store(Request $request, Conversation $conversation)
    {
        $user = Auth::user();
        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        // A suspended account can't be written to (they can't read it either),
        // and the sender shouldn't get a silent success.
        abort_if($conversation->participantFor($user)->isSuspended(), 403, 'This account has been suspended.');

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $conversation->messages()->create([
            'sender_id' => $user->id,
            'body' => $validated['body'],
        ]);

        $conversation->update(['last_message_at' => $message->created_at]);

        broadcast(new MessageSent($message))->toOthers();

        return back();
    }
}
<?php

namespace App\Console\Commands;

use App\Models\SupportTicket;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class CloseInactiveSupportTickets extends Command
{
    protected $signature = 'support:close-inactive';

    protected $description = 'Close support tickets waiting on their owner with no activity for a day, and tell the owner';

    public function handle(): int
    {
        $closed = 0;

        SupportTicket::inactive()->with('user')->each(function (SupportTicket $ticket) use (&$closed) {
            // The admin-managed "closed for inactivity" text is posted in the thread by the model.
            $ticket->transitionTo('closed', 'inactive');

            $notification = new SupportTicketStatusChanged($ticket, 'closed');

            if ($ticket->isGuest()) {
                Notification::route('mail', $ticket->guest_email)->notify($notification);
            } elseif ($ticket->user && ! $ticket->user->isSuspended()) {
                $ticket->user->notify($notification);
            }

            $closed++;
        });

        $this->info("Closed {$closed} inactive ticket(s).");

        return self::SUCCESS;
    }
}

<?php

namespace App\Notifications;

use App\Models\Repair;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * The email of somebody who followed a repair with just its link and left an
 * address: it confirms they are subscribed ('subscribed'), then says when the
 * status changed ('status') or a note or file was added ('note'). Like the
 * other emails here it never carries what the technician wrote; it says what
 * happened and links to the tracking page. Every one ends with a link that
 * removes the address in one click.
 */
class RepairGuestUpdated extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    /**
     * The address the email is for is kept, so the unsubscribe link only
     * removes that one, even if the address was changed while it was queued.
     * The status is passed in for the same reason as RepairUpdated.
     */
    public function __construct(
        public Repair $repair,
        public string $event,
        public string $status,
        public string $email,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $code = $this->repair->code;
        $label = Str::lower(Repair::STATUSES[$this->status] ?? $this->status);
        $title = $this->escapeForMail($this->repair->title);

        [$subject, $line] = match ($this->event) {
            'subscribed' => [
                "You will get updates on repair {$code}",
                "You will get an email each time there is news on your repair \"{$title}\" ({$code}). Its status is {$label}.",
            ],
            'status' => [
                "Repair {$code}: {$label}",
                "The status of your repair ({$code}) changed to {$label}.",
            ],
            default => [
                "New update on repair {$code}",
                "There is a new update on your repair ({$code}).",
            ],
        };

        $unsubscribe = URL::signedRoute('repairs.email.unsubscribe', [
            'repair' => $this->repair,
            'h' => hash('sha256', $this->email),
        ]);

        return (new MailMessage)
            ->subject($subject)
            ->line($line)
            ->action('Track your repair', route('repairs.show', $this->repair))
            ->line("You get this email because this address was added on the repair's tracking page. [Stop these emails]({$unsubscribe}), or change the address on that page at any time.");
    }
}

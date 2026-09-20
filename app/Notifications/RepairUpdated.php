<?php

namespace App\Notifications;

use App\Models\Repair;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Tells a customer that something happened to a repair linked to their account:
 * the technician started tracking it ('started'), changed its status ('status')
 * or only wrote a note ('note'). As with every other email here, the email
 * never carries what the technician wrote: it says what happened and links to
 * the tracking page.
 */
class RepairUpdated extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    /** The status is passed in, not read from the repair: a later update must not change what this one said. */
    public function __construct(
        public Repair $repair,
        public string $event,
        public string $status,
        public ?string $note = null,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    private function statusLabel(): string
    {
        return Repair::STATUSES[$this->status] ?? $this->status;
    }

    public function toArray(object $notifiable): array
    {
        [$title, $body] = match ($this->event) {
            'started' => ["{$this->repair->technician->name} is tracking {$this->repair->title}", "Status: {$this->statusLabel()}"],
            'status' => ["{$this->repair->title} is now ".Str::lower($this->statusLabel()), $this->note],
            default => ["New update on {$this->repair->title}", $this->note],
        };

        return [
            'kind' => 'repair',
            'title' => $title,
            'body' => $body ? Str::limit($body, 120) : null,
            'repair_id' => $this->repair->id,
            'status' => $this->status,
            'url' => route('repairs.show', $this->repair, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $code = $this->repair->code;

        [$subject, $line] = match ($this->event) {
            'started' => [
                "Repair {$code} is now being tracked",
                $this->escapeForMail($this->repair->technician->name)." started tracking a repair for you ({$code}). Its status is ".Str::lower($this->statusLabel()).'.',
            ],
            'status' => [
                "Repair {$code}: ".Str::lower($this->statusLabel()),
                "The status of your repair ({$code}) changed to ".Str::lower($this->statusLabel()).'.',
            ],
            default => [
                "New update on repair {$code}",
                "There is a new update on your repair ({$code}).",
            ],
        };

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($line)
            ->action('Track your repair', route('repairs.show', $this->repair))
            ->line('You can turn these emails off in your profile settings.');
    }
}

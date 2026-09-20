<?php

namespace App\Notifications;

use App\Models\Report;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins when someone reports a message, a conversation or an offer. Like every
 * other email here it never carries what people wrote: it says that a report
 * came in and links to it.
 */
class NewReport extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    /** Drop the job quietly if the report or a user was deleted meanwhile. */
    public bool $deleteWhenMissingModels = true;

    public function __construct(public Report $report) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toArray(object $notifiable): array
    {
        $what = $this->report->targetLabel();

        return [
            'kind' => 'report',
            'title' => "New report against {$this->report->reportedUser->name}",
            'body' => "{$this->report->reasonLabel()} - reported {$what}",
            'report_id' => $this->report->id,
            'url' => route('admin.reports.show', $this->report, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New report to review')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->escapeForMail($this->report->reporter->name).' reported '.$this->report->targetLabel().' ('.$this->report->reasonLabel().').')
            ->action('Review the report', route('admin.reports.show', $this->report))
            ->line('You can turn these emails off in your profile settings.');
    }
}

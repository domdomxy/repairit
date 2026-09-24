<?php

namespace App\Notifications;

use App\Models\Report;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Sent to the person who filed a report once an admin has closed it (resolved
 * or dismissed) — the admin-managed closure text for that outcome, not a
 * personal answer. Like ReportAcknowledged it carries the text itself, since
 * the reporter has no report page to check back on. It never reveals the
 * admin's internal resolution note or what was done to the reported person.
 */
class ReportClosed extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public Report $report, public string $status, public string $text) {}

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
        return [
            'kind' => 'report_closed',
            'title' => 'We finished reviewing your report',
            'body' => Str::limit(preg_replace('/\s+/u', ' ', trim($this->text)), 160),
            'report_id' => $this->report->id,
            'status' => $this->status,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('We finished reviewing your report')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->text)
            ->line('You can turn these emails off in your profile settings.');
    }
}

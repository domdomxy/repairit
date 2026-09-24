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
 * Sent to the person who filed a report, right when they file it — the reason
 * category's canned acknowledgement, not a real answer. Admins get NewReport
 * separately; this one only ever reaches the reporter. It carries the text itself
 * and links to the report's page, where they can follow it until it is closed.
 */
class ReportAcknowledged extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public Report $report, public string $text) {}

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
            'kind' => 'report_received',
            'title' => 'We received your report',
            'body' => Str::limit(preg_replace('/\s+/u', ' ', trim($this->text)), 160),
            'report_id' => $this->report->id,
            'url' => route('reports.mine.show', $this->report, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('We received your report')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->text)
            ->action('Follow your report', route('reports.mine.show', $this->report))
            ->line('You can turn these emails off in your profile settings.');
    }
}

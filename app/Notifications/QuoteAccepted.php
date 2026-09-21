<?php

namespace App\Notifications;

use App\Models\Quote;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Tells a technician that a customer chose their quote. */
class QuoteAccepted extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public Quote $quote) {}

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
            'kind' => 'quote',
            'title' => "{$this->quote->serviceRequest->customer->name} chose your quote",
            'body' => $this->quote->serviceRequest->excerpt(),
            'quote_id' => $this->quote->id,
            'url' => route('requests.show', $this->quote->service_request_id, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your quote was chosen')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->escapeForMail($this->quote->serviceRequest->customer->name).' chose your quote on '.config('app.name').'.')
            ->action('See the request', route('requests.show', $this->quote->service_request_id))
            ->line('You can turn these emails off in your profile settings.');
    }
}

<?php

namespace App\Notifications;

use App\Models\Quote;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells a customer that a technician sent a quote for their repair request.
 * As with every other email here, the email never carries what people wrote
 * (not even the price or the request's title): it says that a quote came in
 * and links to the request.
 */
class NewQuote extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    /** Drop the job quietly if the quote, the request or a user was deleted meanwhile. */
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
            'title' => "{$this->quote->technician->name} sent a quote for {$this->quote->serviceRequest->title}",
            'body' => "Price: {$this->quote->price}",
            'quote_id' => $this->quote->id,
            'url' => route('requests.show', $this->quote->service_request_id, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('You received a quote for your repair request')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->escapeForMail($this->quote->technician->name).' sent a quote for one of your repair requests on '.config('app.name').'.')
            ->action('See the quote', route('requests.show', $this->quote->service_request_id))
            ->line('You can turn these emails off in your profile settings.');
    }
}

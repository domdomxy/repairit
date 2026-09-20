<?php

namespace App\Notifications;

use App\Models\CustomerReview;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/** Tells a customer that a technician rated them. */
class NewCustomerReview extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public CustomerReview $review) {}

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
            'kind' => 'review',
            'title' => "{$this->review->technician->name} rated you {$this->review->rating} stars",
            'body' => $this->review->comment ? Str::limit($this->review->comment, 120) : null,
            'review_id' => $this->review->id,
            'url' => route('customers.show', $this->review->customer_id, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("You received a {$this->review->rating}-star rating")
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line(
                $this->escapeForMail($this->review->technician->name)
                ." rated you {$this->review->rating} stars on ".config('app.name').'.'
            )
            ->action('See your profile', route('customers.show', $this->review->customer_id))
            ->line('You can turn these emails off in your profile settings.');
    }
}

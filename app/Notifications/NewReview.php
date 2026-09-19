<?php

namespace App\Notifications;

use App\Models\Review;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class NewReview extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public Review $review) {}

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
            'title' => "{$this->review->customer->name} left you a {$this->review->rating}-star review",
            'body' => $this->review->comment ? Str::limit($this->review->comment, 120) : null,
            'review_id' => $this->review->id,
            'url' => route('technicians.show', $this->review->technician_id, absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("You received a {$this->review->rating}-star review")
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line(
                $this->escapeForMail($this->review->customer->name)
                ." left you a {$this->review->rating}-star review on ".config('app.name').'.'
            )
            ->action('See your reviews', route('technicians.show', $this->review->technician_id))
            ->line('You can turn these emails off in your profile settings.');
    }
}

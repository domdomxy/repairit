<?php

namespace App\Notifications;

use App\Models\Message;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class NewMessage extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    /** Drop the job quietly if the message or user was deleted meanwhile. */
    public bool $deleteWhenMissingModels = true;

    public function __construct(public Message $message) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * Hold the email back briefly. If the recipient opens the conversation in
     * the meantime there is nothing left to tell them (see shouldSend).
     */
    public function withDelay(object $notifiable): array
    {
        return ['mail' => now()->addMinutes(2)];
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        return $channel !== 'mail' || $this->message->fresh()?->read_at === null;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'message',
            'title' => "New message from {$this->message->sender->name}",
            'body' => $this->preview(),
            'conversation_id' => $this->message->conversation_id,
            'url' => route('conversations.show', $this->message->conversation_id, absolute: false),
        ];
    }

    /**
     * The email deliberately leaves out the message text: it only says who
     * wrote and links back to the app, so conversations stay off email.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $sender = $this->message->sender->name;

        return (new MailMessage)
            ->subject("New message from {$sender}")
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->escapeForMail($sender).' sent you a message on '.config('app.name').'.')
            ->action('Read the message', route('conversations.show', $this->message->conversation_id))
            ->line('You can turn these emails off in your profile settings.');
    }

    /** A short line for the in-app list; attachment-only messages have no text. */
    private function preview(): ?string
    {
        $text = trim((string) $this->message->body);

        if ($text !== '') {
            return Str::limit(preg_replace('/\s+/u', ' ', $text), 120);
        }

        return $this->message->attachment ? 'Sent an attachment' : null;
    }
}

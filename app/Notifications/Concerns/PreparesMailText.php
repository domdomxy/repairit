<?php

namespace App\Notifications\Concerns;

/**
 * Notification emails are rendered as Markdown, so any user-controlled text
 * (a display name, say) must be neutralised first. Otherwise someone could
 * register as "[Verify your account](https://evil.example)" and have a
 * genuine-looking email from us carry their link.
 */
trait PreparesMailText
{
    protected function escapeForMail(string $text): string
    {
        return preg_replace('/([\\\\`*_{}\[\]()#+!|<>~:\/])/', '\\\\$1', $text);
    }
}

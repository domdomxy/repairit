<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\UserWarning;
use App\Notifications\AccountHealthRestored;
use Illuminate\Console\Command;

class RefreshAccountHealthStatuses extends Command
{
    protected $signature = 'accounts:refresh-health';

    protected $description = "Tell users whose last active warning just aged out that their account health status is back to good";

    public function handle(): int
    {
        $notified = 0;

        // Warnings that aged out since this command last ran (it runs daily,
        // so yesterday to now covers every one exactly once).
        $userIds = UserWarning::expired()
            ->where('expires_at', '>', now()->subDay())
            ->distinct()
            ->pluck('user_id');

        User::whereIn('id', $userIds)
            ->whereNull('suspended_at')
            ->each(function (User $user) use (&$notified) {
                // Another still-active warning (from a second, separate
                // warning) keeps them at "warned" — only notify once they are
                // actually back to "good".
                if (! $user->activeWarnings()->exists()) {
                    $user->notify(new AccountHealthRestored);
                    $notified++;
                }
            });

        $this->info("Notified {$notified} user(s) that their account health status is back to good.");

        return self::SUCCESS;
    }
}

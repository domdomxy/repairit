<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Keeps a person's other open tabs and devices in step when they trust or
 * revoke a site: the list is sent whole, so a page just replaces what it has.
 * Only ever sent to the person's own private channel. It is broadcast at once
 * (not queued) because the list is tiny and a stale "trusted" entry on another
 * tab is exactly what this event exists to prevent.
 */
class TrustedHostsUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /** @param  array<int, string>  $hosts */
    public function __construct(public int $userId, public array $hosts) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.User.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'trusted-hosts.updated';
    }

    public function broadcastWith(): array
    {
        return ['hosts' => $this->hosts];
    }
}

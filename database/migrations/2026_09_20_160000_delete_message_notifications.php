<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Messages moved out of the notifications list into their own panel.
        // The rows already stored would otherwise stay in the list for good.
        DB::table('notifications')
            ->where('type', 'App\\Notifications\\NewMessage')
            ->delete();
    }

    public function down(): void
    {
        // Nothing to bring back: they were only pointers to conversations.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            // When the other side (the person asking for help, or the support
            // team) first opened the ticket after this message was written.
            // Null means it hasn't been seen yet: the ticket page puts a
            // "New messages" line above the oldest such message.
            $table->timestamp('read_at')->nullable();
        });

        // Everything written before this existed counts as seen, so old
        // tickets don't all open with a "New messages" line.
        DB::table('support_messages')->update(['read_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            $table->dropColumn('read_at');
        });
    }
};

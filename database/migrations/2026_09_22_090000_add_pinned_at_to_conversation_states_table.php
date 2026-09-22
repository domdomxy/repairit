<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pinning is per person, like hiding: it keeps a conversation at the top
        // of this person's own list and doesn't touch the other person's copy,
        // and it is unrelated to favoriting a user (which is only for the
        // technician search).
        Schema::table('conversation_states', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->after('hidden_at');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_states', function (Blueprint $table) {
            $table->dropColumn('pinned_at');
        });
    }
};

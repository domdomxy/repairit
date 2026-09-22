<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Pinning a message is shared, not per-person like pinning a whole
            // conversation (see conversation_states.pinned_at): either side can
            // pin or unpin, and both see the same result.
            $table->timestamp('pinned_at')->nullable()->after('read_at');
            $table->foreignId('pinned_by_id')->nullable()->after('pinned_at')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pinned_by_id');
            $table->dropColumn('pinned_at');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // The message this one replies to, if any. Same conversation
            // always; never cleared when the original is deleted, so a reply
            // can still show "This message was deleted" the way a shared
            // offer or request does.
            $table->foreignId('reply_to_id')->nullable()->after('conversation_id')
                ->constrained('messages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reply_to_id');
        });
    }
};

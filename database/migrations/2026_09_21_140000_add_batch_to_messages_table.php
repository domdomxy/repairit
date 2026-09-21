<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Files chosen and sent together in one submission share a batch id,
            // so the chat can show them as one stack instead of separate bubbles,
            // even though each still has its own row (and so its own delete/report).
            $table->uuid('batch_id')->nullable()->after('sender_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['batch_id']);
            $table->dropColumn('batch_id');
        });
    }
};

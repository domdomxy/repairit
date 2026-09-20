<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Set the last time the sender changed the text.
            $table->timestamp('edited_at')->nullable()->after('read_at');

            // "Delete for everyone". The row, its text and its files are kept
            // (an admin can still read them if the chat is reported); the
            // conversation just shows a placeholder to both people.
            $table->timestamp('deleted_for_everyone_at')->nullable()->after('edited_at');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['edited_at', 'deleted_for_everyone_at']);
        });
    }
};

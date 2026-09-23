<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            // A guest ticket has no user_id at all, so this becomes optional.
            $table->foreignId('user_id')->nullable()->change();

            // Only set on guest tickets: how we identify and reach them instead.
            $table->string('guest_name', 100)->nullable()->after('user_id');
            $table->string('guest_email', 255)->nullable()->after('guest_name');
            // A long, unguessable key that stands in for being logged in: it's
            // what lets a guest open and reply to their own ticket link.
            $table->string('guest_token', 64)->nullable()->unique()->after('guest_email');

            $table->index('guest_email');
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropIndex(['guest_email']);
            $table->dropColumn(['guest_name', 'guest_email', 'guest_token']);
            $table->foreignId('user_id')->nullable(false)->change();
        });
    }
};

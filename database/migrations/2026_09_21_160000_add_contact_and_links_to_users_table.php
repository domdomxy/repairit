<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a customer can choose to show on their public profile besides the
     * bio and city: a phone number and their email (both hidden until they opt
     * in). Links (a website, social networks...) are for every account, so
     * technicians use the `links` column too; their phone and their "show"
     * choices stay on the technician profile.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 30)->nullable();
            $table->boolean('show_phone_publicly')->default(false);
            $table->boolean('show_email_publicly')->default(false);
            $table->json('links')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'show_phone_publicly', 'show_email_publicly', 'links']);
        });
    }
};

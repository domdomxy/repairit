<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('technician_profiles', function (Blueprint $table) {
            // Off until the technician turns it on.
            $table->boolean('auto_reply_enabled')->default(false)->after('show_email_publicly');
            // Their own wording. Null means "send the default message".
            $table->text('auto_reply_message')->nullable()->after('auto_reply_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('technician_profiles', function (Blueprint $table) {
            $table->dropColumn(['auto_reply_enabled', 'auto_reply_message']);
        });
    }
};

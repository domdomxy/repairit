<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A warning an admin issued before deciding whether to suspend someone.
        // It stays "active" (counted toward the account's health status) until
        // expires_at, 90 days after it was issued, then ages out on its own.
        Schema::create('user_warnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // The admin who issued it; kept even if that admin account is later removed.
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason');
            $table->timestamp('expires_at');
            $table->timestamps();

            // "Is this user currently warned?" is checked on every settings page load.
            $table->index(['user_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_warnings');
    }
};

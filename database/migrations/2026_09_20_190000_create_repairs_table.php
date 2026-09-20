<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repairs', function (Blueprint $table) {
            $table->id();
            // What people read out and what the tracking link is built on.
            $table->string('code', 12)->unique();
            $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
            // Optional: the customer's account, so it shows in their list and they get notified.
            // The repair outlives the customer's account.
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('received');

            $table->timestamps();

            $table->index(['technician_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repairs');
    }
};

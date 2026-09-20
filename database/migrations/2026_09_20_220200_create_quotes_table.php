<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A technician's answer to a repair request: what they would charge, how
     * long it would take and a note. One per technician and request (sending
     * again edits it). `accepted_at` is set on the one the customer chose.
     */
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
            $table->string('price', 60);
            $table->string('estimated_time', 60)->nullable();
            $table->text('message')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique(['service_request_id', 'technician_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};

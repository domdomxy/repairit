<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A repair request: a customer describing something they need fixed (a
     * broken phone, a leaking tap), for technicians to answer with a quote.
     * It is the mirror of an offer, which is a technician describing what they do.
     */
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('description');
            // Free text ("Up to 100 TND"), like an offer's price, so no currency or format is assumed.
            $table->string('budget', 60)->nullable();
            $table->string('city', 100)->nullable();
            // 'open' while technicians can still send quotes, 'closed' otherwise.
            $table->string('status', 20)->default('open');
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['customer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
    }
};

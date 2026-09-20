<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            // Free text ("From 50 TND", "80 TND / hour") so no currency or format is assumed.
            $table->string('price', 60)->nullable();
            $table->timestamps();

            $table->index(['technician_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};

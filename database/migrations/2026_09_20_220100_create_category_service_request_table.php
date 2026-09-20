<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The categories a customer tags a repair request with, so technicians can find it by them. */
    public function up(): void
    {
        Schema::create('category_service_request', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_request_id')->constrained()->cascadeOnDelete();

            $table->unique(['category_id', 'service_request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('category_service_request');
    }
};

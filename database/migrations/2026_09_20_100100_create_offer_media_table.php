<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The pictures and videos of an offer, one row per file.
        Schema::create('offer_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained()->cascadeOnDelete();
            // Where the file lives on the private disk. Never sent to the browser.
            $table->string('path');
            $table->string('name');
            $table->string('mime', 127);
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offer_media');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Files a technician attached to an update on a repair's timeline
        // (photos of the device, an invoice, ...).
        Schema::create('repair_update_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('repair_update_id')->constrained()->cascadeOnDelete();
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
        Schema::dropIfExists('repair_update_attachments');
    }
};

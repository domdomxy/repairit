<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pictures the person asking for help attached to a ticket message
        // (signed in or guest). Staff replies never carry any.
        Schema::create('support_message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_message_id')->constrained()->cascadeOnDelete();
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
        Schema::dropIfExists('support_message_attachments');
    }
};

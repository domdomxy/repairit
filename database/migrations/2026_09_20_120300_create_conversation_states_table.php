<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A conversation is shared by two people, so what one of them does to
        // it (hide it, delete it) is kept per person and never touches the
        // other person's copy.
        Schema::create('conversation_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Moved out of the list into "Hidden" until it is unhidden.
            $table->timestamp('hidden_at')->nullable();

            // "Delete conversation": everything up to this message is gone for
            // this person. Messages sent afterwards show up again.
            $table->timestamp('cleared_at')->nullable();
            $table->unsignedBigInteger('cleared_through_message_id')->nullable();

            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_states');
    }
};

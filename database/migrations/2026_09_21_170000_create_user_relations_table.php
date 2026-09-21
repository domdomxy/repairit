<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // What one person has done about another: blocked, muted, favorited or
        // restricted them. Each row is one-way (user_id acted on target_id) and
        // the other person is never told; a person can hold several of the four
        // at once for the same target, but each only once.
        Schema::create('user_relations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('target_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 16);
            $table->timestamps();

            $table->unique(['user_id', 'target_id', 'type']);
            // "Who has blocked me?" is asked on every search and every feed.
            $table->index(['target_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_relations');
    }
};

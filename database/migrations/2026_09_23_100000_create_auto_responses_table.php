<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auto_responses', function (Blueprint $table) {
            $table->id();
            // 'support' (SupportTicket::CATEGORIES) or 'report' (Report::REASONS).
            $table->string('type', 20);
            $table->string('category', 30);
            // Off skips sending it, without losing the admin's wording underneath.
            $table->boolean('enabled')->default(true);
            // Null means "use the built-in default text" for this type/category.
            $table->text('body')->nullable();
            $table->timestamps();

            $table->unique(['type', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_responses');
    }
};

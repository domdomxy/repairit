<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('technician_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            $table->text('bio')->nullable();

            // Location: supports both exact-city and geo-radius search
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->enum('availability_status', ['available', 'busy', 'offline'])
                ->default('available');

            // Public contact card (technician controls visibility)
            $table->string('phone')->nullable();
            $table->boolean('show_phone_publicly')->default(false);
            $table->boolean('show_email_publicly')->default(false);

            // Cached rating, recalculated by a Review observer
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);

            $table->timestamps();

            $table->index(['latitude', 'longitude']);
            $table->index('city');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('technician_profiles');
    }
};
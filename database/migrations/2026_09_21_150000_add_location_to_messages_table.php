<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // A message that shares a point on a map instead of, or alongside,
            // text or files. Both are set together, or neither is.
            $table->decimal('location_lat', 10, 7)->nullable();
            $table->decimal('location_lng', 10, 7)->nullable();
            // Optional human-readable label; the coordinates alone are enough
            // to show and open the pin, so this is never required.
            $table->string('location_label', 120)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['location_lat', 'location_lng', 'location_label']);
        });
    }
};

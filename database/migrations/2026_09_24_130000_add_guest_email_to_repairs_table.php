<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('repairs', function (Blueprint $table) {
            // Somebody following the repair with just the link can leave an email
            // to be told of the updates. Optional, and theirs to change or remove.
            $table->string('guest_email')->nullable()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('repairs', function (Blueprint $table) {
            $table->dropColumn('guest_email');
        });
    }
};

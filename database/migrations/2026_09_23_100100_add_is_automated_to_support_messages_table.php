<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            // True for the canned first reply sent when a ticket is opened:
            // it isn't a real answer, so it doesn't count as staff replying.
            $table->boolean('is_automated')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('support_messages', function (Blueprint $table) {
            $table->dropColumn('is_automated');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // A message that shares an offer. The offer itself can be deleted
            // later, so its title is kept: the chat then says which offer is gone.
            $table->foreignId('offer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('offer_title', 120)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('offer_id');
            $table->dropColumn('offer_title');
        });
    }
};

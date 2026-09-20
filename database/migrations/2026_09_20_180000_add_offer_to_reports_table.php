<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A report can now be about an offer, which has no conversation.
        Schema::table('reports', function (Blueprint $table) {
            $table->unsignedBigInteger('conversation_id')->nullable()->change();
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('offer_id')->nullable()->after('message_id')->constrained()->nullOnDelete();
            // What the offer was called when it was reported, kept if it is deleted later.
            $table->string('offer_title', 120)->nullable()->after('offer_id');
        });
    }

    public function down(): void
    {
        // Offer reports have no conversation, so they cannot outlive this column being required again.
        DB::table('reports')->whereNull('conversation_id')->delete();

        Schema::table('reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('offer_id');
            $table->dropColumn('offer_title');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->unsignedBigInteger('conversation_id')->nullable(false)->change();
        });
    }
};

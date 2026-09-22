<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A report can now be about a person as a whole, not about one message,
     * offer, request or review of theirs. Such a report points at nothing but
     * the reported user, so this flag is what tells it apart.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->boolean('user_report')->default(false)->after('review_comment');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('user_report');
        });
    }
};

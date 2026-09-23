<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The sites a person told the "Leaving Repairit" prompt to stop asking
     * about, as a JSON list of host names (["instagram.com", ...]). They live on
     * the account rather than in the browser, so a trusted site follows the
     * person to every device and never carries over to another account that
     * happens to share a browser. Null (the default) means nothing is trusted.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('trusted_link_hosts')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('trusted_link_hosts');
        });
    }
};

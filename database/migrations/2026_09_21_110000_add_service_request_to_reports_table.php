<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A report can now be about a repair request, like one about an offer: it
     * has no conversation. The title is copied onto the report so it is still
     * known once the request has been deleted.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('service_request_id')->nullable()->after('offer_title')->constrained()->nullOnDelete();
            $table->string('request_title', 120)->nullable()->after('service_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_request_id');
            $table->dropColumn('request_title');
        });
    }
};

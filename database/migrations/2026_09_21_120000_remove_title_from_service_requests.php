<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A repair request no longer has a title: what the customer wrote is the
     * post. Existing titles are dropped with the column.
     *
     * A request report used to keep the request's title; it now keeps the
     * start of what the request said.
     */
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropColumn('title');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->renameColumn('request_title', 'request_excerpt');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->renameColumn('request_excerpt', 'request_title');
        });

        Schema::table('service_requests', function (Blueprint $table) {
            $table->string('title', 120)->default('')->after('customer_id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_warnings', function (Blueprint $table) {
            // Set when a warning was issued from a report, so the account health
            // page can show the reported item (message, post, review...) alongside
            // it. Null for warnings an admin issued directly from the users list,
            // and left in place if the report is later deleted, so the warning
            // itself still stands on its own.
            $table->foreignId('report_id')->nullable()->after('admin_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('user_warnings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('report_id');
        });
    }
};

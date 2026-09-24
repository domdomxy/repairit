<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // What the reporter was told, kept as it was worded then, so their report page
            // shows the same text as the notification even after an admin edits the wording.
            $table->text('reporter_ack_text')->nullable()->after('details');
            $table->text('reporter_closure_text')->nullable()->after('reporter_ack_text');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['reporter_ack_text', 'reporter_closure_text']);
        });
    }
};

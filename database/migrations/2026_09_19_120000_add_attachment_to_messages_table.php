<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // A message can now be a file on its own, so the text is optional.
            $table->text('body')->nullable()->change();

            // Where the file lives on the private disk, plus what to show and
            // how to serve it. The path is never sent to the browser.
            $table->string('attachment_path')->nullable()->after('body');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime', 127)->nullable()->after('attachment_name');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
        });
    }

    public function down(): void
    {
        // Attachment-only messages have no text; give them an empty body
        // before the column goes back to NOT NULL.
        DB::table('messages')->whereNull('body')->update(['body' => '']);

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size']);
            $table->text('body')->nullable(false)->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A message can carry several files, so they get a table of their own
        // instead of the four attachment_* columns on messages.
        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            // Where the file lives on the private disk. Never sent to the browser.
            $table->string('path');
            $table->string('name');
            $table->string('mime', 127);
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });

        // Keep the files people have already sent: each old single attachment
        // becomes the first (and only) row for its message.
        DB::table('message_attachments')->insertUsing(
            ['message_id', 'path', 'name', 'mime', 'size', 'created_at', 'updated_at'],
            DB::table('messages')
                ->select([
                    'id',
                    'attachment_path',
                    DB::raw("COALESCE(attachment_name, 'file')"),
                    DB::raw("COALESCE(attachment_mime, 'application/octet-stream')"),
                    DB::raw('COALESCE(attachment_size, 0)'),
                    'created_at',
                    'created_at',
                ])
                ->whereNotNull('attachment_path')
                ->orderBy('id'),
        );

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('attachment_path')->nullable()->after('body');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime', 127)->nullable()->after('attachment_name');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
        });

        // The old layout holds one file per message, so only the first one
        // survives a rollback. The other files stay on disk but lose their row.
        DB::table('message_attachments')
            ->orderBy('id')
            ->each(function ($attachment) {
                DB::table('messages')
                    ->where('id', $attachment->message_id)
                    ->whereNull('attachment_path')
                    ->update([
                        'attachment_path' => $attachment->path,
                        'attachment_name' => $attachment->name,
                        'attachment_mime' => $attachment->mime,
                        'attachment_size' => $attachment->size,
                    ]);
            });

        Schema::dropIfExists('message_attachments');
    }
};

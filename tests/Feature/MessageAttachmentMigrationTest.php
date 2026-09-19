<?php

use App\Models\Conversation;
use App\Models\MessageAttachment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** The migration that moved single attachments off the messages table. */
function attachmentsMigration(): object
{
    return require database_path('migrations/2026_09_19_150000_create_message_attachments_table.php');
}

test('files sent under the old one-file layout survive the move to the new table', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = User::factory()->create(['role' => 'technician']);
    $conversation = Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);

    $migration = attachmentsMigration();

    // Go back to the old layout and write messages the way the old code did.
    $migration->down();

    expect(Schema::hasColumn('messages', 'attachment_path'))->toBeTrue();

    $withFile = DB::table('messages')->insertGetId([
        'conversation_id' => $conversation->id,
        'sender_id' => $customer->id,
        'body' => 'See attached',
        'attachment_path' => 'message-attachments/1/abc.pdf',
        'attachment_name' => 'quote.pdf',
        'attachment_mime' => 'application/pdf',
        'attachment_size' => 2048,
        'created_at' => '2026-09-19 10:00:00',
        'updated_at' => '2026-09-19 10:00:00',
    ]);

    $textOnly = DB::table('messages')->insertGetId([
        'conversation_id' => $conversation->id,
        'sender_id' => $technician->id,
        'body' => 'Thanks',
        'created_at' => '2026-09-19 10:05:00',
        'updated_at' => '2026-09-19 10:05:00',
    ]);

    $migration->up();

    expect(Schema::hasColumn('messages', 'attachment_path'))->toBeFalse();

    $attachment = MessageAttachment::where('message_id', $withFile)->sole();

    expect($attachment->path)->toBe('message-attachments/1/abc.pdf')
        ->and($attachment->name)->toBe('quote.pdf')
        ->and($attachment->mime)->toBe('application/pdf')
        ->and($attachment->size)->toBe(2048)
        // Messages without a file get no row, and every message keeps its text.
        ->and(MessageAttachment::where('message_id', $textOnly)->exists())->toBeFalse()
        ->and(DB::table('messages')->where('id', $withFile)->value('body'))->toBe('See attached')
        ->and(DB::table('messages')->count())->toBe(2);
});

test('rolling the migration back keeps the first file of each message', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = User::factory()->create(['role' => 'technician']);
    $conversation = Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
    $message = $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Two files']);

    $message->attachments()->create(['path' => 'a/one.pdf', 'name' => 'one.pdf', 'mime' => 'application/pdf', 'size' => 1]);
    $message->attachments()->create(['path' => 'a/two.pdf', 'name' => 'two.pdf', 'mime' => 'application/pdf', 'size' => 2]);

    $migration = attachmentsMigration();
    $migration->down();

    expect(Schema::hasTable('message_attachments'))->toBeFalse();

    $row = DB::table('messages')->where('id', $message->id)->first();

    expect($row->attachment_path)->toBe('a/one.pdf')
        ->and($row->attachment_name)->toBe('one.pdf')
        ->and($row->body)->toBe('Two files');

    // Leave the schema as the other tests expect it.
    $migration->up();
});

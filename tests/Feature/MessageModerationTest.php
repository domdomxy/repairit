<?php

use App\Events\MessageDeleted;
use App\Events\MessageUpdated;
use App\Models\AdminLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Report;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(Message::ATTACHMENT_DISK));

/**
 * @return array{0: User, 1: User, 2: Conversation} [customer, technician, conversation]
 */
function moderationSetup(): array
{
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
        'last_message_at' => now(),
    ]);

    return [$customer, $technician, $conversation];
}

function moderationMessage(Conversation $conversation, User $sender, string $body = 'Hello'): Message
{
    return $conversation->messages()->create(['sender_id' => $sender->id, 'body' => $body]);
}

// ------------------------------------------------------------------ editing

test('a sender can edit their message and the old text is kept', function () {
    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Original text');

    $this->actingAs($customer)
        ->patch(route('messages.update', $message), ['body' => 'Changed text'])
        ->assertRedirect();

    $message->refresh();

    expect($message->body)->toBe('Changed text')
        ->and($message->edited_at)->not->toBeNull()
        ->and($message->edits)->toHaveCount(1)
        ->and($message->edits->first()->body)->toBe('Original text');
});

test('editing a message to the same text changes nothing', function () {
    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Same');

    $this->actingAs($customer)->patch(route('messages.update', $message), ['body' => 'Same'])->assertRedirect();

    expect($message->fresh()->edited_at)->toBeNull()
        ->and($message->edits()->count())->toBe(0);
});

test('only the sender can edit a message', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Mine');

    $this->actingAs($technician)
        ->patch(route('messages.update', $message), ['body' => 'Hijacked'])
        ->assertForbidden();

    $this->actingAs(User::factory()->create())
        ->patch(route('messages.update', $message), ['body' => 'Hijacked'])
        ->assertForbidden();

    expect($message->fresh()->body)->toBe('Mine');
});

test('a message cannot be edited to nothing unless it carries files', function () {
    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Text');

    $this->actingAs($customer)
        ->patch(route('messages.update', $message), ['body' => ''])
        ->assertSessionHasErrors('body');

    expect($message->fresh()->body)->toBe('Text');

    $withFile = $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Caption']);
    $withFile->attachments()->create([
        'path' => UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf')
            ->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK),
        'name' => 'quote.pdf',
        'mime' => 'application/pdf',
        'size' => 10240,
    ]);

    $this->actingAs($customer)->patch(route('messages.update', $withFile), ['body' => ''])->assertRedirect();

    expect($withFile->fresh()->body)->toBeNull();
});

test('a message deleted for everyone can no longer be edited', function () {
    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer);
    $message->forceFill(['deleted_for_everyone_at' => now()])->save();

    $this->actingAs($customer)
        ->patch(route('messages.update', $message), ['body' => 'Too late'])
        ->assertForbidden();
});

test('editing and deleting for everyone are broadcast to the other person', function () {
    Event::fake([MessageUpdated::class, MessageDeleted::class]);

    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'One');

    $this->actingAs($customer)->patch(route('messages.update', $message), ['body' => 'Two']);
    Event::assertDispatched(MessageUpdated::class, fn ($event) => $event->message->is($message));

    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);
    Event::assertDispatched(MessageDeleted::class, fn ($event) => $event->message->is($message));
});

// ----------------------------------------------------------------- deleting

test('delete for me removes a message for that person only', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Secret');
    moderationMessage($conversation, $technician, 'Reply');

    $this->actingAs($customer)
        ->delete(route('messages.destroy', $message), ['scope' => 'me'])
        ->assertRedirect();

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->has('messages', 1)
            ->where('messages.0.body', 'Reply'));

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->has('messages', 2)
            ->where('messages.0.body', 'Secret')
            ->where('messages.0.deleted', false));

    // Nothing is destroyed.
    expect(Message::find($message->id))->not->toBeNull();
});

test('either person can delete a message for themselves, but only the sender for everyone', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer);

    $this->actingAs($technician)
        ->delete(route('messages.destroy', $message), ['scope' => 'everyone'])
        ->assertForbidden();

    expect($message->fresh()->deleted_for_everyone_at)->toBeNull();

    $this->actingAs($technician)
        ->delete(route('messages.destroy', $message), ['scope' => 'me'])
        ->assertRedirect();

    $this->assertDatabaseHas('message_deletions', ['message_id' => $message->id, 'user_id' => $technician->id]);
});

test('a delete needs a valid scope and a participant', function () {
    [$customer, , $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer);

    $this->actingAs($customer)
        ->delete(route('messages.destroy', $message), ['scope' => 'nobody'])
        ->assertSessionHasErrors('scope');

    $this->actingAs(User::factory()->create())
        ->delete(route('messages.destroy', $message), ['scope' => 'me'])
        ->assertForbidden();
});

test('delete for everyone leaves a placeholder for both people and keeps the text for admins', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Something regrettable');

    $this->actingAs($customer)
        ->delete(route('messages.destroy', $message), ['scope' => 'everyone'])
        ->assertRedirect();

    foreach ([$customer, $technician] as $person) {
        $this->actingAs($person)
            ->get(route('conversations.show', $conversation))
            ->assertInertia(fn (Assert $page) => $page
                ->has('messages', 1)
                ->where('messages.0.deleted', true)
                ->where('messages.0.body', null)
                ->where('messages.0.attachments', []));
    }

    // Still there for a later report.
    expect($message->fresh()->body)->toBe('Something regrettable')
        ->and($message->fresh()->deleted_for_everyone_at)->not->toBeNull();
});

test('a deleted message no longer counts as unread or as a request', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $customer, 'Please help');

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.unread_count', 1)
            ->where('conversations.0.is_request', true));

    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.unread_count', 0)
            ->where('conversations.0.is_request', false)
            ->where('conversations.0.last_message.preview', 'This message was deleted'));
});

test('files of a deleted message can no longer be opened by the two people', function () {
    [$customer, $technician, $conversation] = moderationSetup();

    $message = $conversation->messages()->create(['sender_id' => $customer->id]);
    $attachment = $message->attachments()->create([
        'path' => UploadedFile::fake()->create('quote.pdf', 10, 'application/pdf')
            ->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK),
        'name' => 'quote.pdf',
        'mime' => 'application/pdf',
        'size' => 10240,
    ]);

    $url = route('messages.attachment', $attachment);

    $this->actingAs($technician)->get($url)->assertOk();

    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);

    $this->actingAs($technician)->get($url)->assertNotFound();
    $this->actingAs($customer)->get($url)->assertNotFound();
});

// ------------------------------------------------------- hiding and deleting

test('hiding a conversation moves it out of the list for that person only', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    moderationMessage($conversation, $technician, 'Hi');

    $this->actingAs($customer)
        ->post(route('conversations.hide', $conversation))
        ->assertRedirect(route('conversations.index'));

    $this->assertDatabaseHas('conversation_states', ['conversation_id' => $conversation->id, 'user_id' => $customer->id]);

    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('conversations', 1)
            ->where('conversations.0.is_hidden', true));

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('conversations.0.is_hidden', false));

    $this->actingAs($customer)->post(route('conversations.unhide', $conversation))->assertRedirect();

    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('conversations.0.is_hidden', false));
});

test('writing in a hidden conversation brings it back', function () {
    [$customer, , $conversation] = moderationSetup();

    $this->actingAs($customer)->post(route('conversations.hide', $conversation));

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Back again']);

    expect($conversation->states()->where('user_id', $customer->id)->first()->hidden_at)->toBeNull();
});

test('only the two people can hide or delete a conversation', function () {
    [, , $conversation] = moderationSetup();
    $stranger = User::factory()->create();

    $this->actingAs($stranger)->post(route('conversations.hide', $conversation))->assertForbidden();
    $this->actingAs($stranger)->post(route('conversations.unhide', $conversation))->assertForbidden();
    $this->actingAs($stranger)->delete(route('conversations.destroy', $conversation))->assertForbidden();
});

test('deleting a conversation clears it for that person only and it returns with new messages', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    moderationMessage($conversation, $customer, 'Old question');
    moderationMessage($conversation, $technician, 'Old answer');

    $this->actingAs($customer)
        ->delete(route('conversations.destroy', $conversation))
        ->assertRedirect(route('conversations.index'));

    // Gone from the customer's list, untouched for the technician.
    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->has('conversations', 0));

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page->has('messages', 2));

    // Nothing was removed.
    expect($conversation->messages()->count())->toBe(2);

    // The customer can still open it by address, and it is empty.
    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('messages', 0));

    // A new message from the technician brings it back, with only that message.
    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'New message']);

    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('conversations', 1)
            ->where('conversations.0.unread_count', 1)
            ->where('conversations.0.last_message.preview', 'New message'));

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->has('messages', 1)
            ->where('messages.0.body', 'New message'));
});

// ---------------------------------------------------------------- reporting

test('a message from the other person can be reported and admins are told', function () {
    Notification::fake();

    [$customer, $technician, $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);
    $message = moderationMessage($conversation, $technician, 'Send me money');

    $this->actingAs($customer)
        ->post(route('messages.report', $message), ['reason' => 'fraud', 'details' => 'Asked for a deposit'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->reporter_id)->toBe($customer->id)
        ->and($report->reported_user_id)->toBe($technician->id)
        ->and($report->conversation_id)->toBe($conversation->id)
        ->and($report->message_id)->toBe($message->id)
        ->and($report->reason)->toBe('fraud')
        ->and($report->status)->toBe('open');

    Notification::assertSentTo($admin, NewReport::class);
    Notification::assertNotSentTo($technician, NewReport::class);
    Notification::assertNotSentTo($customer, NewReport::class);
});

test('reporting the same thing twice does not file a second report', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $technician);

    $this->actingAs($customer)->post(route('messages.report', $message), ['reason' => 'spam']);
    $this->actingAs($customer)->post(route('messages.report', $message), ['reason' => 'spam']);

    expect(Report::count())->toBe(1);
});

test('you cannot report your own message, a stranger\'s conversation, or an unknown reason', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $mine = moderationMessage($conversation, $customer);
    $theirs = moderationMessage($conversation, $technician);

    $this->actingAs($customer)->post(route('messages.report', $mine), ['reason' => 'spam'])->assertForbidden();

    $stranger = User::factory()->create();
    $this->actingAs($stranger)->post(route('messages.report', $theirs), ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($stranger)->post(route('conversations.report', $conversation), ['reason' => 'spam'])->assertForbidden();

    $this->actingAs($customer)
        ->post(route('messages.report', $theirs), ['reason' => 'made-up'])
        ->assertSessionHasErrors('reason');

    expect(Report::count())->toBe(0);
});

test('a message the reporter already deleted for themselves cannot be reported', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $technician);

    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'me']);

    $this->actingAs($customer)->post(route('messages.report', $message), ['reason' => 'spam'])->assertNotFound();
});

test('a whole conversation can be reported', function () {
    [$customer, $technician, $conversation] = moderationSetup();

    $this->actingAs($technician)
        ->post(route('conversations.report', $conversation), ['reason' => 'harassment'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->message_id)->toBeNull()
        ->and($report->reporter_id)->toBe($technician->id)
        ->and($report->reported_user_id)->toBe($customer->id)
        ->and($report->isMessageReport())->toBeFalse();
});

test('the open conversation page says what the person has already reported', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $message = moderationMessage($conversation, $technician);

    $this->actingAs($customer)->post(route('messages.report', $message), ['reason' => 'spam']);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('moderation.reported_message_ids', [$message->id])
            ->where('moderation.reported_conversation', false)
            ->has('moderation.reasons'));
});

// -------------------------------------------------------------- admin review

test('an admin reads the whole reported conversation, deleted messages and old versions included', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $first = moderationMessage($conversation, $technician, 'Pay me outside the app');
    moderationMessage($conversation, $customer, 'No thanks');

    $this->actingAs($technician)->patch(route('messages.update', $first), ['body' => 'Pay me in the app']);
    $this->actingAs($technician)->delete(route('messages.destroy', $first), ['scope' => 'everyone']);
    $this->actingAs($customer)->post(route('messages.report', $first), ['reason' => 'fraud']);

    $report = Report::sole();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Show')
            ->where('report.id', $report->id)
            ->where('report.type', 'message')
            ->where('report.reported.id', $technician->id)
            ->has('messages', 2)
            // The deleted message is readable, and so is what it said before the edit.
            ->where('messages.0.body', 'Pay me in the app')
            ->where('messages.0.flagged', true)
            ->where('messages.0.deleted_for_everyone_at', fn ($value) => $value !== null)
            ->where('messages.0.edits.0.body', 'Pay me outside the app')
            ->where('messages.1.body', 'No thanks')
            ->where('messages.1.flagged', false));
});

test('opening a report is recorded once per admin', function () {
    $this->withoutVite();

    [$customer, , $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($admin)->get(route('admin.reports.show', $report))->assertOk();
    $this->actingAs($admin)->get(route('admin.reports.show', $report))->assertOk();

    expect(AdminLog::where('action', 'report.viewed')->where('admin_id', $admin->id)->count())->toBe(1);
});

test('only admins can open the reports', function () {
    [$customer, , $conversation] = moderationSetup();

    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($customer)->get(route('admin.reports.index'))->assertForbidden();
    $this->actingAs($customer)->get(route('admin.reports.show', $report))->assertForbidden();
    $this->actingAs($customer)->post(route('admin.reports.status', $report), ['status' => 'resolved'])->assertForbidden();
});

test('the report list can be filtered by status', function () {
    $this->withoutVite();

    [$customer, $technician, $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'spam']);
    $this->actingAs($technician)->post(route('conversations.report', $conversation), ['reason' => 'other']);
    Report::first()->forceFill(['status' => 'dismissed'])->save();

    $this->actingAs($admin)
        ->get(route('admin.reports.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Index')
            ->has('reports.data', 2)
            ->where('counts.open', 1)
            ->where('counts.dismissed', 1));

    $this->actingAs($admin)
        ->get(route('admin.reports.index', ['status' => 'open']))
        ->assertInertia(fn (Assert $page) => $page->has('reports.data', 1));
});

test('an admin can resolve, dismiss and reopen a report, and each step is logged', function () {
    [$customer, , $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($admin)
        ->post(route('admin.reports.status', $report), ['status' => 'resolved', 'note' => 'Warned the user'])
        ->assertRedirect();

    $report->refresh();
    expect($report->status)->toBe('resolved')
        ->and($report->resolution_note)->toBe('Warned the user')
        ->and($report->reviewed_by_id)->toBe($admin->id)
        ->and($report->reviewed_at)->not->toBeNull();

    $this->actingAs($admin)->post(route('admin.reports.status', $report), ['status' => 'open']);

    $report->refresh();
    expect($report->status)->toBe('open')
        ->and($report->reviewed_by_id)->toBeNull()
        ->and($report->reviewed_at)->toBeNull();

    $this->actingAs($admin)->post(route('admin.reports.status', $report), ['status' => 'dismissed']);

    expect($report->fresh()->status)->toBe('dismissed')
        ->and(AdminLog::where('action', 'report.resolved')->count())->toBe(1)
        ->and(AdminLog::where('action', 'report.reopened')->count())->toBe(1)
        ->and(AdminLog::where('action', 'report.dismissed')->count())->toBe(1);

    $this->actingAs($admin)
        ->post(route('admin.reports.status', $report), ['status' => 'bogus'])
        ->assertSessionHasErrors('status');
});

test('an admin can open files of a reported conversation, and only of a reported one', function () {
    [$customer, $technician, $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $message = $conversation->messages()->create(['sender_id' => $technician->id]);
    $attachment = $message->attachments()->create([
        'path' => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf')
            ->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK),
        'name' => 'evidence.pdf',
        'mime' => 'application/pdf',
        'size' => 10240,
    ]);

    $url = route('messages.attachment', $attachment);

    // Being an admin is not enough on its own.
    $this->actingAs($admin)->get($url)->assertForbidden();

    // The sender deletes it for everyone, then the customer reports the chat.
    $this->actingAs($technician)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);
    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'inappropriate']);

    $this->actingAs($admin)->get($url)->assertOk();
    $this->actingAs($technician)->get($url)->assertNotFound();
});

test('the admin dashboard counts open reports', function () {
    $this->withoutVite();

    [$customer, , $conversation] = moderationSetup();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('conversations.report', $conversation), ['reason' => 'spam']);

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('stats.reports_open', 1));
});

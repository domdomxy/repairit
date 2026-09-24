<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The automatic messages around support tickets and reports, managed by admins.
 *
 * Two kinds, four types:
 *  - support / report: the reply sent as soon as a ticket or report is
 *    created, one per category (the ticket's topic, the report's reason).
 *  - support_closure / report_closure: the message sent when a ticket is
 *    resolved or closed, or a report resolved or dismissed. There the
 *    "category" is the outcome, since that is what the wording depends on.
 *
 * A row is only created once an admin actually
 * edits or disables a category; until then it behaves as enabled with the
 * built-in default text below, the same way a technician's auto-reply falls
 * back to TechnicianProfile::DEFAULT_AUTO_REPLY.
 */
class AutoResponse extends Model
{
    public const TYPE_SUPPORT = 'support';

    public const TYPE_REPORT = 'report';

    public const TYPE_SUPPORT_CLOSURE = 'support_closure';

    public const TYPE_REPORT_CLOSURE = 'report_closure';

    public const TYPES = [
        self::TYPE_SUPPORT,
        self::TYPE_REPORT,
        self::TYPE_SUPPORT_CLOSURE,
        self::TYPE_REPORT_CLOSURE,
    ];

    /** The outcomes that send a closure message, keyed as they are stored. */
    public const SUPPORT_CLOSURES = [
        'resolved' => 'Resolved',
        'closed' => 'Closed',
        // Not a status: the closed message used when a ticket is closed for going quiet.
        'inactive' => 'Closed for inactivity',
    ];

    public const REPORT_CLOSURES = [
        'resolved' => 'Resolved',
        'dismissed' => 'Dismissed',
    ];

    /** 'type.category' => the text sent when no admin override exists. */
    public const DEFAULTS = [
        'support.question' => "Thanks for reaching out! We've received your question and will get back to you as soon as we can.",
        'support.account' => "Thanks for letting us know. Account issues are handled as a priority — we'll reply here shortly.",
        'support.report' => "Thanks for the report. Our team reviews every one and will follow up here if we need more from you.",
        'support.bug' => "Thanks for flagging this. We've logged it and will update this ticket once we know more.",
        'support.other' => "Thanks for getting in touch. We've received your message and will reply here as soon as we can.",
        'report.spam' => 'Thanks for reporting this. We take spam and advertising seriously and our team will review it shortly.',
        'report.harassment' => "Thanks for reporting this. We take harassment and abuse seriously and we're looking into it — you don't need to do anything else.",
        'report.inappropriate' => 'Thanks for reporting this. Our team will review the content and take action if it breaks our rules.',
        'report.fraud' => "Thanks for reporting this. Scams and fraud are reviewed urgently — we'll take it from here.",
        'report.other' => 'Thanks for your report. Our team will look into it and take any action that is needed.',
        'support_closure.resolved' => "We've marked this ticket as resolved. If the problem is still there, just reply here and we'll pick it back up.",
        'support_closure.inactive' => "We haven't heard back from you in a while, so we've closed this ticket for now. If you still need help, please open a new ticket and we'll pick it up from there.",
        'support_closure.closed' => "This ticket is now closed. If you still need help, please open a new ticket and we'll be glad to look into it.",
        'report_closure.resolved' => "Thanks again for your report. We've reviewed it and taken the action that was needed.",
        'report_closure.dismissed' => "Thanks again for your report. We reviewed it carefully and didn't find a breach of our rules this time. If you see anything else, please report it.",
    ];

    protected $fillable = [
        'type',
        'category',
        'enabled',
        'body',
    ];

    protected $casts = [
        'enabled' => 'boolean',
    ];

    /** The category labels each type can take: the ticket topics / report reasons, or the closing outcomes. */
    public static function categoriesFor(string $type): array
    {
        return match ($type) {
            self::TYPE_SUPPORT => SupportTicket::CATEGORIES,
            self::TYPE_REPORT => Report::REASONS,
            self::TYPE_SUPPORT_CLOSURE => self::SUPPORT_CLOSURES,
            self::TYPE_REPORT_CLOSURE => self::REPORT_CLOSURES,
            default => [],
        };
    }

    /**
     * The text to send for this type/category, or null if an admin has
     * turned it off. Falls back to the admin's own wording, then the
     * built-in default — never to an empty message.
     */
    public static function textFor(string $type, string $category): ?string
    {
        $row = static::where('type', $type)->where('category', $category)->first();

        if ($row && ! $row->enabled) {
            return null;
        }

        $body = trim((string) $row?->body);

        return $body !== '' ? $body : (self::DEFAULTS["{$type}.{$category}"] ?? null);
    }
}

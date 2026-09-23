<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The automatic message sent as soon as a support ticket or a report is
 * created, one per category. A row is only created once an admin actually
 * edits or disables a category; until then it behaves as enabled with the
 * built-in default text below, the same way a technician's auto-reply falls
 * back to TechnicianProfile::DEFAULT_AUTO_REPLY.
 */
class AutoResponse extends Model
{
    public const TYPE_SUPPORT = 'support';

    public const TYPE_REPORT = 'report';

    public const TYPES = [self::TYPE_SUPPORT, self::TYPE_REPORT];

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

    /** The category labels each type can take, keyed the same way as SupportTicket::CATEGORIES / Report::REASONS. */
    public static function categoriesFor(string $type): array
    {
        return match ($type) {
            self::TYPE_SUPPORT => SupportTicket::CATEGORIES,
            self::TYPE_REPORT => Report::REASONS,
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

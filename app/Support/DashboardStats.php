<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Small, database-agnostic building blocks for the dashboard charts.
 *
 * Rows are grouped in PHP rather than with SQL date functions, so the same code
 * runs on SQLite (development) and MySQL/PostgreSQL alike. That is fine at this
 * size: every query is limited to a recent window, and only one column is read.
 */
final class DashboardStats
{
    /** How many days the time-series charts look back, today included. */
    public const WINDOW_DAYS = 30;

    /**
     * One entry per day for the last $days days, oldest first. Days without
     * any rows are present with a count of 0, so the chart has no gaps.
     *
     * @return list<array{date: string, count: int}>
     */
    public static function dailyCounts(Builder $query, int $days = self::WINDOW_DAYS, string $column = 'created_at'): array
    {
        $start = now()->subDays($days - 1)->startOfDay();

        $perDay = (clone $query)
            ->where($column, '>=', $start)
            ->pluck($column)
            ->countBy(fn ($value) => Carbon::parse($value)->format('Y-m-d'));

        $series = [];

        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i)->format('Y-m-d');
            $series[] = ['date' => $date, 'count' => (int) ($perDay[$date] ?? 0)];
        }

        return $series;
    }

    /**
     * Rows in the last $days days against the $days before that, for the
     * "compared with the previous period" figure on a stat card.
     *
     * @return array{current: int, previous: int}
     */
    public static function trend(Builder $query, int $days = self::WINDOW_DAYS, string $column = 'created_at'): array
    {
        $currentStart = now()->subDays($days - 1)->startOfDay();
        $previousStart = $currentStart->copy()->subDays($days);

        return [
            'current' => (clone $query)->where($column, '>=', $currentStart)->count(),
            'previous' => (clone $query)
                ->where($column, '>=', $previousStart)
                ->where($column, '<', $currentStart)
                ->count(),
        ];
    }

    /**
     * How many rows fall on each value of a column, as [value => count].
     * $column is interpolated into SQL, so only ever pass a literal column name.
     * Values that never occur are included with 0 when $expected lists them,
     * which keeps the order and the colours of a chart stable.
     *
     * @param  list<string|int>  $expected
     * @return array<string|int, int>
     */
    public static function countBy(Builder $query, string $column, array $expected = []): array
    {
        $counts = (clone $query)
            ->selectRaw("{$column} as bucket, COUNT(*) as total")
            ->groupBy($column)
            ->pluck('total', 'bucket')
            ->map(fn ($total) => (int) $total)
            ->all();

        $result = [];

        foreach ($expected as $value) {
            $result[$value] = $counts[$value] ?? 0;
        }

        // Anything unexpected is kept rather than silently dropped.
        foreach ($counts as $value => $total) {
            $result[$value] ??= $total;
        }

        return $result;
    }

    /**
     * Ratings 1 to 5 as a chart-ready list, e.g. for "how are technicians rated".
     *
     * @return list<array{rating: int, count: int}>
     */
    public static function ratingDistribution(Builder $reviews): array
    {
        $counts = self::countBy($reviews, 'rating', [1, 2, 3, 4, 5]);

        return collect([1, 2, 3, 4, 5])
            ->map(fn (int $rating) => ['rating' => $rating, 'count' => $counts[$rating]])
            ->all();
    }

    /** The average of a set of reviews, rounded to one decimal, or null when there are none. */
    public static function averageRating(Builder $reviews): ?float
    {
        $average = (clone $reviews)->avg('rating');

        return $average === null ? null : round((float) $average, 1);
    }
}

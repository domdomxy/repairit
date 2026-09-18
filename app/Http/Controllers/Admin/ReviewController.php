<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Review;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    public function index(Request $request): Response
    {
        $term = trim((string) $request->input('q'));
        $rating = $request->input('rating');

        $reviews = Review::query()
            ->with(['technician:id,name', 'customer:id,name'])
            ->when($term !== '', fn ($query) => $query->where(
                fn ($query) => $query
                    ->where('comment', 'like', "%{$term}%")
                    ->orWhereHas('customer', fn ($q) => $q->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('technician', fn ($q) => $q->where('name', 'like', "%{$term}%"))
            ))
            ->when(in_array((string) $rating, ['1', '2', '3', '4', '5'], true),
                fn ($query) => $query->where('rating', (int) $rating))
            ->latest()
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Review $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'created_at' => $review->created_at->toIso8601String(),
                'technician' => ['id' => $review->technician->id, 'name' => $review->technician->name],
                'customer' => ['id' => $review->customer->id, 'name' => $review->customer->name],
            ]);

        return Inertia::render('Admin/Reviews/Index', [
            'reviews' => $reviews,
            'filters' => ['q' => $term, 'rating' => $rating],
        ]);
    }

    public function destroy(Request $request, Review $review): RedirectResponse
    {
        $review->load(['technician:id,name', 'customer:id,name']);

        AdminLog::record(
            $request->user(),
            'review.deleted',
            "Removed {$review->rating}-star review by {$review->customer->name} for {$review->technician->name}",
            $review,
        );

        // Model delete (not a query delete) so the observer refreshes the
        // technician's cached rating.
        $review->delete();

        return back()->with('success', 'Review removed.');
    }
}

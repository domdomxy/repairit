<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\CustomerReview;
use App\Models\Message;
use App\Models\Offer;
use App\Models\Report;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/** Reporting: one message or the whole chat from inside a conversation, or an offer, a repair request or a review from the page it is shown on. */
class ReportController extends Controller
{
    /** Report a message the other person sent. */
    public function storeMessage(Request $request, Message $message): RedirectResponse
    {
        $user = $request->user();
        $conversation = $message->conversation;

        abort_unless($conversation->hasParticipant($user), 403);
        abort_if($message->sender_id === $user->id, 403, 'You cannot report your own message.');

        // Only what this person could see: not a message they already deleted
        // for themselves, or from before they deleted the conversation.
        abort_unless(Message::whereKey($message->id)->visibleTo($user)->exists(), 404);

        return $this->file($request, $conversation, $message->sender_id, $message);
    }

    /** Report an offer somebody else made. It has no conversation. */
    public function storeOffer(Request $request, Offer $offer): RedirectResponse
    {
        $user = $request->user();

        abort_if($offer->technician_id === $user->id, 403, 'You cannot report your own offer.');

        return $this->file($request, null, $offer->technician_id, null, $offer);
    }

    /** Report a repair request somebody else posted. It has no conversation. */
    public function storeRequest(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $user = $request->user();

        abort_if($serviceRequest->customer_id === $user->id, 403, 'You cannot report your own request.');
        // Only what this person could see: a suspended customer's requests are not shown.
        abort_if($serviceRequest->customer->isSuspended(), 404);

        return $this->file($request, null, $serviceRequest->customer_id, null, serviceRequest: $serviceRequest);
    }

    /** Report a review a customer wrote about a technician. It has no conversation. */
    public function storeReview(Request $request, Review $review): RedirectResponse
    {
        $user = $request->user();

        abort_if($review->customer_id === $user->id, 403, 'You cannot report your own review.');
        // Only what this person could see: a suspended technician's page is not shown.
        abort_if($review->technician?->isSuspended(), 404);

        return $this->file($request, null, $review->customer_id, null, null, [
            'review_id' => $review->id,
            'review_kind' => 'technician',
            'review_subject_id' => $review->technician_id,
            'review_rating' => $review->rating,
            'review_comment' => $review->comment,
        ]);
    }

    /** Report a review a technician wrote about a customer. It has no conversation. */
    public function storeCustomerReview(Request $request, CustomerReview $customerReview): RedirectResponse
    {
        $user = $request->user();

        abort_if($customerReview->technician_id === $user->id, 403, 'You cannot report your own review.');
        abort_if($customerReview->customer?->isSuspended(), 404);

        return $this->file($request, null, $customerReview->technician_id, null, null, [
            'customer_review_id' => $customerReview->id,
            'review_kind' => 'customer',
            'review_subject_id' => $customerReview->customer_id,
            'review_rating' => $customerReview->rating,
            'review_comment' => $customerReview->comment,
        ]);
    }

    /** Report the conversation as a whole. */
    public function storeConversation(Request $request, Conversation $conversation): RedirectResponse
    {
        $user = $request->user();

        abort_unless($conversation->hasParticipant($user), 403);

        return $this->file($request, $conversation, $conversation->participantFor($user)->id, null);
    }

    /**
     * @param  array<string, mixed>  $review  For a review report: which review it is (`review_id` or
     *                                        `customer_review_id`) and a copy of what it said.
     */
    private function file(Request $request, ?Conversation $conversation, int $reportedUserId, ?Message $message, ?Offer $offer = null, array $review = [], ?ServiceRequest $serviceRequest = null): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(Report::REASONS))],
            'details' => ['nullable', 'string', 'max:1000'],
        ]);

        // One open report per thing is enough; a second one would only fill the queue.
        $alreadyReported = Report::where('reporter_id', $user->id)
            ->where('conversation_id', $conversation?->id)
            ->where('message_id', $message?->id)
            ->where('offer_id', $offer?->id)
            ->where('service_request_id', $serviceRequest?->id)
            ->where('review_id', $review['review_id'] ?? null)
            ->where('customer_review_id', $review['customer_review_id'] ?? null)
            ->where('status', 'open')
            ->exists();

        if ($alreadyReported) {
            return back()->with('success', 'You have already reported this. An admin will look at it.');
        }

        $report = Report::create([
            'reporter_id' => $user->id,
            'reported_user_id' => $reportedUserId,
            'conversation_id' => $conversation?->id,
            'message_id' => $message?->id,
            'offer_id' => $offer?->id,
            'offer_title' => $offer?->title,
            'service_request_id' => $serviceRequest?->id,
            'request_excerpt' => $serviceRequest?->excerpt(120),
            'reason' => $data['reason'],
            'details' => $data['details'] ?? null,
            ...$review,
        ]);

        // Everyone who can review it, except the people it is about.
        $admins = User::where('role', 'admin')
            ->whereNull('suspended_at')
            ->whereNotIn('id', [$user->id, $reportedUserId])
            ->get();

        Notification::send($admins, new NewReport($report));

        return back()->with('success', 'Thanks, your report was sent to the admins.');
    }
}

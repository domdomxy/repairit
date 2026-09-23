<?php

namespace App\Http\Controllers;

use App\Models\CustomerReview;
use App\Models\Report;
use App\Models\User;
use App\Support\ProfileLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A customer's public profile: who they are, the repair requests they posted
 * and what technicians say about them.
 */
class CustomerProfileController extends Controller
{
    /** Longest bio and city a customer can put on their public profile, in characters. */
    public const BIO_MAX_LENGTH = 500;

    public const CITY_MAX_LENGTH = 100;

    public const PHONE_MAX_LENGTH = 30;

    /**
     * The page where a customer edits what their public profile shows: a
     * technician's own edit page has the same place (TechnicianProfileController).
     * The picture and the account details are on the account page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Customers/EditProfile', [
            'profile' => [
                'bio' => $user->bio,
                'city' => $user->city,
                'phone' => $user->phone,
                'show_phone_publicly' => (bool) $user->show_phone_publicly,
                'show_email_publicly' => (bool) $user->show_email_publicly,
                'links' => ProfileLinks::list($user->links),
                'bio_max' => self::BIO_MAX_LENGTH,
                'city_max' => self::CITY_MAX_LENGTH,
                'phone_max' => self::PHONE_MAX_LENGTH,
                'links_max' => ProfileLinks::MAX,
                'link_label_max' => ProfileLinks::LABEL_MAX,
                'link_url_max' => ProfileLinks::URL_MAX,
            ],
        ]);
    }

    /**
     * Save what the public profile shows. Everything here is visible to every
     * signed-in user, and every field is optional: the phone number and the
     * email are only shown if the customer ticks the matching box.
     */
    public function update(Request $request): RedirectResponse
    {
        ProfileLinks::prepare($request);

        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:'.self::BIO_MAX_LENGTH],
            'city' => ['nullable', 'string', 'max:'.self::CITY_MAX_LENGTH],
            'phone' => [
                'nullable',
                'string',
                'max:'.self::PHONE_MAX_LENGTH,
                'regex:/^[0-9+\s().-]+$/',
                Rule::requiredIf($request->boolean('show_phone_publicly')),
            ],
            'show_phone_publicly' => ['boolean'],
            'show_email_publicly' => ['boolean'],
        ] + ProfileLinks::rules(), [
            'phone.required' => 'Add a phone number to show it on your public profile.',
            'phone.regex' => 'Phone numbers can only contain digits, spaces, and + ( ) . -',
        ] + ProfileLinks::messages());

        $request->user()->fill([
            'bio' => filled($validated['bio'] ?? null) ? trim($validated['bio']) : null,
            'city' => filled($validated['city'] ?? null) ? trim($validated['city']) : null,
            'phone' => filled($validated['phone'] ?? null) ? trim($validated['phone']) : null,
            'show_phone_publicly' => (bool) ($validated['show_phone_publicly'] ?? false),
            'show_email_publicly' => (bool) ($validated['show_email_publicly'] ?? false),
            'links' => ProfileLinks::clean($validated['links'] ?? []),
        ])->save();

        return Redirect::route('customer.profile.edit');
    }

    public function show(Request $request, User $customer): Response
    {
        abort_unless($customer->role === 'customer' && ! $customer->isSuspended(), 404);

        $viewer = $request->user();

        // Someone who blocked you does not exist as far as you are concerned.
        abort_if($customer->hasBlocked($viewer), 404);

        $stats = CustomerReview::where('customer_id', $customer->id)
            ->selectRaw('COUNT(*) as total, AVG(rating) as average')
            ->first();

        $reviews = CustomerReview::where('customer_id', $customer->id)
            ->with('technician:id,name,avatar_path')
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (CustomerReview $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'technician' => [
                    'id' => $review->technician->id,
                    'name' => $review->technician->name,
                    'avatar_url' => $review->technician->avatar_url,
                ],
            ])
            ->values()
            ->all();

        $isTechnician = $viewer->role === 'technician';
        $isOwner = $viewer->is($customer);

        // Contact details are public only when the customer chose to show them. The keys are
        // left out altogether otherwise, so nothing private is in the page's data.
        $contact = [];

        if ($customer->show_phone_publicly && filled($customer->phone)) {
            $contact['phone'] = $customer->phone;
        }

        if ($customer->show_email_publicly) {
            $contact['email'] = $customer->email;
        }

        return Inertia::render('Customers/Show', [
            // What the viewer did about this customer (null on their own profile, and for admins).
            'relations' => $isOwner || $customer->isAdmin() ? null : $viewer->relationFlagsFor($customer),
            // Only what is meant to be public: the bio, city, links and contact details are there
            // only because the customer chose to fill them in or to show them.
            'customer' => $contact + [
                'id' => $customer->id,
                'name' => $customer->name,
                'avatar_url' => $customer->avatar_url,
                'bio' => $customer->bio,
                'city' => $customer->city,
                'links' => ProfileLinks::list($customer->links),
                'member_since' => $customer->created_at?->toIso8601String(),
                'rating_count' => (int) $stats->total,
                'rating_avg' => $stats->total ? round((float) $stats->average, 2) : null,
                'reviews' => $reviews,
            ],
            'requests' => ServiceRequestController::profileCards($customer, $viewer),
            // What the "Create a new request" panel needs: only on your own profile.
            'requestForm' => $isOwner
                ? ServiceRequestController::formProps() + ['defaultCity' => $customer->city]
                : null,
            // Whether the viewer has earned the right to rate (see CustomerReview::conversationFor);
            // `myReview` prefills the form.
            // The reasons the report form on each review offers.
            'reportReasons' => Report::REASONS,
            // The quote form on the customer's requests: only technicians send quotes.
            'quoteLimits' => ServiceRequestController::quoteLimitsFor($viewer),
            'canReview' => $isTechnician && CustomerReview::conversationFor($viewer, $customer) !== null,
            'myReview' => $isTechnician
                ? CustomerReview::where('technician_id', $viewer->id)
                    ->where('customer_id', $customer->id)
                    ->first(['rating', 'comment'])
                : null,
        ]);
    }
}

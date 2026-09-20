<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /** Longest bio and city a customer can put on their public profile, in characters. */
    public const BIO_MAX_LENGTH = 500;

    public const CITY_MAX_LENGTH = 100;

    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
            // What the picture form accepts, so the page and the server agree.
            'avatar' => [
                'max_kb' => User::AVATAR_MAX_KB,
                'extensions' => User::AVATAR_EXTENSIONS,
            ],
            // What a customer shows on their public profile; technicians have their own profile page for this.
            'publicInfo' => $request->user()->role === 'customer' ? [
                'bio' => $request->user()->bio,
                'city' => $request->user()->city,
                'bio_max' => self::BIO_MAX_LENGTH,
                'city_max' => self::CITY_MAX_LENGTH,
            ] : null,
        ]);
    }

    /**
     * Update what a customer shows on their public profile page. Everything
     * here is visible to every signed-in user, and both fields are optional.
     */
    public function updatePublicInfo(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless($user->role === 'customer', 403, 'Only customers have a public profile to fill in.');

        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:'.self::BIO_MAX_LENGTH],
            'city' => ['nullable', 'string', 'max:'.self::CITY_MAX_LENGTH],
        ]);

        $user->fill([
            'bio' => filled($validated['bio'] ?? null) ? trim($validated['bio']) : null,
            'city' => filled($validated['city'] ?? null) ? trim($validated['city']) : null,
        ])->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}

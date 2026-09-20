<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\TechnicianProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TechnicianProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $profile = $request->user()
            ->technicianProfile()
            ->firstOrCreate([], ['availability_status' => 'available']);

        return Inertia::render('Technicians/EditProfile', [
            'profile' => [
                'bio' => $profile->bio,
                'phone' => $profile->phone,
                'address' => $profile->address,
                'city' => $profile->city,
                'latitude' => $profile->latitude !== null ? (float) $profile->latitude : null,
                'longitude' => $profile->longitude !== null ? (float) $profile->longitude : null,
                'availability_status' => $profile->availability_status,
                'show_phone_publicly' => (bool) $profile->show_phone_publicly,
                'show_email_publicly' => (bool) $profile->show_email_publicly,
                'auto_reply_enabled' => (bool) $profile->auto_reply_enabled,
                'auto_reply_message' => $profile->auto_reply_message,
                'categories' => $profile->categories()->pluck('categories.id')->all(),
            ],
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'autoReplyDefault' => TechnicianProfile::DEFAULT_AUTO_REPLY,
            'autoReplyMaxLength' => TechnicianProfile::AUTO_REPLY_MAX_LENGTH,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:1000'],
            'phone' => [
                'nullable',
                'string',
                'max:30',
                'regex:/^[0-9+\s().-]+$/',
                Rule::requiredIf($request->boolean('show_phone_publicly')),
            ],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'availability_status' => ['required', Rule::in(['available', 'busy', 'offline'])],
            'show_phone_publicly' => ['boolean'],
            'show_email_publicly' => ['boolean'],
            'auto_reply_enabled' => ['boolean'],
            // Empty means "use the default message".
            'auto_reply_message' => ['nullable', 'string', 'max:'.TechnicianProfile::AUTO_REPLY_MAX_LENGTH],
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['integer', 'distinct', 'exists:categories,id'],
        ], [
            'phone.required' => 'Add a phone number to show it on your public profile.',
            'phone.regex' => 'Phone numbers can only contain digits, spaces, and + ( ) . -',
            'categories.required' => 'Select at least one specialty.',
            'categories.min' => 'Select at least one specialty.',
        ]);

        $categories = $validated['categories'];
        unset($validated['categories']);

        // A blank custom message means the default one.
        $validated['auto_reply_message'] = filled($validated['auto_reply_message'] ?? null)
            ? trim($validated['auto_reply_message'])
            : null;

        $profile = $request->user()
            ->technicianProfile()
            ->firstOrCreate([], ['availability_status' => 'available']);

        $profile->update($validated);
        $profile->categories()->sync($categories);

        return Redirect::route('technician.profile.edit');
    }
}

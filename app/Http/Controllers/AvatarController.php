<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AvatarController extends Controller
{
    /**
     * Stream someone's picture to any signed-in user.
     *
     * Pictures live on the private disk, so this route is the only way to
     * reach them. The URL carries a version (see User::getAvatarUrlAttribute)
     * which changes with each upload, so the browser can cache the response
     * for a long time.
     */
    public function show(User $user): StreamedResponse
    {
        abort_unless($user->avatar_path, 404);

        $disk = Storage::disk(User::AVATAR_DISK);
        abort_unless($disk->exists($user->avatar_path), 404);

        return $disk->response($user->avatar_path, null, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=31536000',
        ]);
    }

    /** Replace the signed-in user's picture. */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'avatar' => [
                'required',
                'file',
                'max:'.User::AVATAR_MAX_KB,
                // Checked against the file's real content type, not just its name.
                'mimes:'.implode(',', User::AVATAR_EXTENSIONS),
            ],
        ], [
            'avatar.required' => 'Choose a picture to upload.',
            'avatar.uploaded' => 'The picture could not be uploaded. It may be too large.',
            'avatar.max' => 'The picture may not be larger than '.(User::AVATAR_MAX_KB / 1024).' MB.',
            'avatar.mimes' => 'Use a JPG, PNG or WebP picture.',
        ]);

        $user = $request->user();
        $previous = $user->avatar_path;

        $path = $request->file('avatar')->store('avatars', User::AVATAR_DISK);

        abort_if($path === false, 500, 'The picture could not be saved.');

        try {
            $user->avatar_path = $path;
            $user->save();
        } catch (Throwable $e) {
            Storage::disk(User::AVATAR_DISK)->delete($path);

            throw $e;
        }

        if ($previous) {
            Storage::disk(User::AVATAR_DISK)->delete($previous);
        }

        return back();
    }

    /** Go back to the initials placeholder. */
    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk(User::AVATAR_DISK)->delete($user->avatar_path);

            $user->avatar_path = null;
            $user->save();
        }

        return back();
    }
}

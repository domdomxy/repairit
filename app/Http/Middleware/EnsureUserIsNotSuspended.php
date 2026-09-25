<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Signs a suspended or (self-)deactivated user out on their next request, so
 * either one takes effect immediately instead of waiting for their session
 * to expire — including in another tab or device that was already signed in
 * when the account was deactivated elsewhere.
 */
class EnsureUserIsNotSuspended
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isSuspended() || $user?->isDeactivated()) {
            $message = $user->isSuspended()
                ? 'Your account has been suspended.'
                : 'Your account has been deactivated.';

            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()
                ->route('login')
                ->with('status', $message);
        }

        return $next($request);
    }
}

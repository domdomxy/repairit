<?php

namespace App\Http\Controllers;

use App\Models\Repair;
use App\Notifications\RepairGuestUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

/**
 * The email somebody following a repair with just its link can leave to be
 * told of the updates. Like the tracking page it is open to anyone who has
 * the link, so an address is never shown back in full (see Repair::maskedGuestEmail).
 * A technician does not use this: they post the updates, and a customer with an
 * account is notified through it.
 */
class RepairEmailController extends Controller
{
    /** Add the address, or replace the one already there. */
    public function update(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeFollower($request, $repair);

        $data = $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:255']]);

        $email = mb_strtolower(trim($data['email']));
        $changed = $repair->guest_email !== $email;

        $repair->guest_email = $email;

        // Not touch(): saving an address is not news on the repair, so it must not move it up the technician's list.
        $repair->timestamps = false;
        $repair->save();

        if ($changed) {
            Notification::route('mail', $email)->notify(new RepairGuestUpdated($repair, 'subscribed', $repair->status, $email));
        }

        return back()->with('success', "Done. You will get an email at {$repair->maskedGuestEmail()} when there is an update.");
    }

    /** Stop the emails from the page. */
    public function destroy(Request $request, Repair $repair): RedirectResponse
    {
        $this->authorizeFollower($request, $repair);

        $this->forget($repair);

        return back()->with('success', 'You will no longer get emails about this repair.');
    }

    /**
     * The link at the bottom of every email: one click, no sign-in. It is signed,
     * and only works for the address the email was sent to, so an old email
     * cannot remove an address that was put there later.
     */
    public function unsubscribe(Request $request, Repair $repair): RedirectResponse
    {
        $fingerprint = $repair->guestEmailFingerprint();

        if ($fingerprint !== null && hash_equals($fingerprint, (string) $request->query('h'))) {
            $this->forget($repair);
        }

        return redirect()
            ->route('repairs.show', $repair)
            ->with('success', 'You will no longer get emails about this repair.');
    }

    private function forget(Repair $repair): void
    {
        $repair->guest_email = null;
        $repair->timestamps = false;
        $repair->save();
    }

    /**
     * The technician runs the repair, and a customer it is linked to is already
     * told through their account: neither needs (or gets) this.
     */
    private function authorizeFollower(Request $request, Repair $repair): void
    {
        $user = $request->user();

        abort_if($user !== null && ($repair->technician_id === $user->id || $repair->customer_id === $user->id), 403);
    }
}

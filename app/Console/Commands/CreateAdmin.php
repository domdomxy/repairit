<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create
                            {email : The admin\'s email address}
                            {--name=Admin : Display name for a new account}';

    protected $description = 'Create an admin account, or promote an existing user to admin';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));

        if (Validator::make(['email' => $email], ['email' => 'email'])->fails()) {
            $this->error('That is not a valid email address.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            if ($user->isAdmin()) {
                $this->info("{$email} is already an admin.");

                return self::SUCCESS;
            }

            if (! $this->confirm("{$email} already exists as a {$user->role}. Promote them to admin?")) {
                return self::FAILURE;
            }

            // Admins have no technician profile or conversations, so a
            // technician is not promoted in place: it would leave an orphaned
            // public profile behind.
            if ($user->role === 'technician') {
                $this->error('Technician accounts cannot be promoted. Use a separate email for the admin account.');

                return self::FAILURE;
            }

            $user->role = 'admin';
            $user->email_verified_at ??= now();
            $user->save();

            $this->info("{$email} is now an admin.");

            return self::SUCCESS;
        }

        $password = $this->secret('Password');

        $validator = Validator::make(['password' => $password], ['password' => Password::defaults()]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        // Role is not user-registrable, and the dashboard route requires a
        // verified email, so both are set explicitly here.
        $user = new User([
            'name' => $this->option('name'),
            'email' => $email,
            'password' => $password,
            'role' => 'admin',
        ]);
        $user->email_verified_at = now();
        $user->save();

        $this->info("Admin account created for {$email}.");

        return self::SUCCESS;
    }
}

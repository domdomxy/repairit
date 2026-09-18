<?php

use App\Models\User;

test('it creates a verified admin who can reach the dashboard', function () {
    $this->artisan('admin:create', ['email' => 'Boss@Example.com', '--name' => 'The Boss'])
        ->expectsQuestion('Password', 'a-long-safe-password')
        ->assertSuccessful();

    $admin = User::where('email', 'boss@example.com')->first();

    expect($admin->role)->toBe('admin');
    expect($admin->name)->toBe('The Boss');
    expect($admin->email_verified_at)->not->toBeNull();

    $this->withoutVite();
    $this->actingAs($admin)->get(route('dashboard'))->assertOk();
});

test('it rejects a weak password without creating anyone', function () {
    $this->artisan('admin:create', ['email' => 'boss@example.com'])
        ->expectsQuestion('Password', 'short')
        ->assertFailed();

    expect(User::count())->toBe(0);
});

test('it rejects an invalid email', function () {
    $this->artisan('admin:create', ['email' => 'not-an-email'])->assertFailed();

    expect(User::count())->toBe(0);
});

test('it can promote an existing customer', function () {
    $customer = User::factory()->create(['role' => 'customer', 'email' => 'amira@example.com']);

    $this->artisan('admin:create', ['email' => 'amira@example.com'])
        ->expectsConfirmation('amira@example.com already exists as a customer. Promote them to admin?', 'yes')
        ->assertSuccessful();

    expect($customer->fresh()->role)->toBe('admin');
});

test('it declines to promote a technician', function () {
    $technician = User::factory()->create(['role' => 'technician', 'email' => 'sami@example.com']);

    $this->artisan('admin:create', ['email' => 'sami@example.com'])
        ->expectsConfirmation('sami@example.com already exists as a technician. Promote them to admin?', 'yes')
        ->assertFailed();

    expect($technician->fresh()->role)->toBe('technician');
});

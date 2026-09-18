<?php

use App\Models\Category;
use App\Models\User;

test('registration screen can be rendered', function () {
    $response = $this->get('/register');

    $response->assertStatus(200);
});

test('new customers can register', function () {
    $response = $this->post('/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'customer',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));

    $this->assertDatabaseHas('users', ['email' => 'test@example.com', 'role' => 'customer']);
    $this->assertDatabaseMissing('technician_profiles', ['user_id' => User::firstOrFail()->id]);
});

test('new technicians can register with categories and get a profile', function () {
    $category = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    $response = $this->post('/register', [
        'name' => 'Test Technician',
        'email' => 'tech@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'technician',
        'categories' => [$category->id],
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));

    $technician = User::where('email', 'tech@example.com')->firstOrFail();

    expect($technician->role)->toBe('technician')
        ->and($technician->technicianProfile)->not->toBeNull()
        ->and($technician->technicianProfile->categories->pluck('id')->all())->toBe([$category->id]);
});

test('a technician must pick at least one category', function () {
    $this->post('/register', [
        'name' => 'Test Technician',
        'email' => 'tech@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'technician',
    ])->assertSessionHasErrors('categories');

    $this->assertGuest();
    expect(User::count())->toBe(0);
});

test('registration requires a valid role', function () {
    foreach ([null, 'admin'] as $role) {
        $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => $role,
        ])->assertSessionHasErrors('role');
    }

    $this->assertGuest();
    expect(User::count())->toBe(0);
});

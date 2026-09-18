<?php

use App\Models\AdminLog;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\Review;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function adminUser(): User
{
    return User::factory()->create(['role' => 'admin']);
}

function panelTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function panelCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function panelReview(User $customer, User $technician, int $rating): Review
{
    return Review::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
        'rating' => $rating,
    ]);
}

function suspend(User $user): User
{
    $user->suspended_at = now();
    $user->save();

    return $user;
}

// ---------------------------------------------------------------- access

test('guests are sent to the login page', function (string $routeName) {
    $this->get(route($routeName))->assertRedirect(route('login'));
})->with([
    'admin.users.index',
    'admin.categories.index',
    'admin.reviews.index',
    'admin.logs.index',
]);

test('customers and technicians cannot open the admin pages', function (string $routeName) {
    $this->actingAs(panelCustomer())->get(route($routeName))->assertForbidden();
    $this->actingAs(panelTechnician())->get(route($routeName))->assertForbidden();
})->with([
    'admin.users.index',
    'admin.categories.index',
    'admin.reviews.index',
    'admin.logs.index',
]);

test('non-admins cannot perform admin actions', function () {
    $customer = panelCustomer();
    $target = panelTechnician();
    $category = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $review = panelReview($customer, $target, 4);

    $this->actingAs($customer);

    $this->post(route('admin.users.suspend', $target))->assertForbidden();
    $this->delete(route('admin.users.destroy', $target))->assertForbidden();
    $this->post(route('admin.categories.store'), ['name' => 'HVAC'])->assertForbidden();
    $this->delete(route('admin.categories.destroy', $category))->assertForbidden();
    $this->delete(route('admin.reviews.destroy', $review))->assertForbidden();

    expect($target->fresh()->suspended_at)->toBeNull();
    expect(User::whereKey($target->id)->exists())->toBeTrue();
    expect(Category::count())->toBe(1);
    expect(Review::count())->toBe(1);
    expect(AdminLog::count())->toBe(0);
});

test('admins can open every admin page', function () {
    $this->withoutVite();
    $this->actingAs(adminUser());

    foreach ([
        'admin.users.index' => 'Admin/Users/Index',
        'admin.categories.index' => 'Admin/Categories/Index',
        'admin.reviews.index' => 'Admin/Reviews/Index',
        'admin.logs.index' => 'Admin/Logs/Index',
    ] as $routeName => $component) {
        $this->get(route($routeName))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }
});

// ------------------------------------------------------------- dashboard

test('the admin dashboard shows platform totals', function () {
    $this->withoutVite();

    $technician = panelTechnician();
    $customer = panelCustomer();
    suspend(panelCustomer());
    Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
    panelReview($customer, $technician, 5);

    $this->actingAs(adminUser())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Admin')
            ->where('stats.users', 4)
            ->where('stats.customers', 2)
            ->where('stats.technicians', 1)
            ->where('stats.suspended', 1)
            ->where('stats.categories', 1)
            ->where('stats.conversations', 1)
            ->where('stats.reviews', 1)
            ->has('recentUsers', 4)
            ->has('recentLogs', 0));
});

// ----------------------------------------------------------------- users

test('the user list can be searched and filtered', function () {
    $this->withoutVite();

    panelCustomer(['name' => 'Amira Ben Salah', 'email' => 'amira@example.com']);
    panelCustomer(['name' => 'Karim Trabelsi', 'email' => 'karim@example.com']);
    panelTechnician(['name' => 'Sami Plumber']);
    suspend(panelCustomer(['name' => 'Blocked Bob']));

    $admin = adminUser();

    $names = fn ($query) => collect(
        $this->actingAs($admin)->get(route('admin.users.index', $query))
            ->viewData('page')['props']['users']['data']
    )->pluck('name')->sort()->values()->all();

    expect($names(['q' => 'amira']))->toBe(['Amira Ben Salah']);
    expect($names(['q' => 'karim@example']))->toBe(['Karim Trabelsi']);
    expect($names(['role' => 'technician']))->toBe(['Sami Plumber']);
    expect($names(['status' => 'suspended']))->toBe(['Blocked Bob']);
    expect($names(['status' => 'active']))->not->toContain('Blocked Bob');
    expect($names([]))->toHaveCount(5);
});

test('an admin can suspend and restore a user, and each action is logged', function () {
    $admin = adminUser();
    $customer = panelCustomer(['name' => 'Amira', 'email' => 'amira@example.com']);

    $this->actingAs($admin)
        ->post(route('admin.users.suspend', $customer))
        ->assertSessionHasNoErrors();

    expect($customer->fresh()->isSuspended())->toBeTrue();
    $this->assertDatabaseHas('admin_logs', [
        'admin_id' => $admin->id,
        'action' => 'user.suspended',
        'target_type' => 'User',
        'target_id' => $customer->id,
    ]);

    $this->actingAs($admin)->post(route('admin.users.unsuspend', $customer));

    expect($customer->fresh()->isSuspended())->toBeFalse();
    $this->assertDatabaseHas('admin_logs', ['action' => 'user.unsuspended', 'target_id' => $customer->id]);
});

test('suspending an already suspended user does not add a second log entry', function () {
    $customer = suspend(panelCustomer());
    $admin = adminUser();

    $this->actingAs($admin)->post(route('admin.users.suspend', $customer));

    expect(AdminLog::count())->toBe(0);
});

test('a suspended user is signed out on their next request', function () {
    $customer = suspend(panelCustomer());

    $this->actingAs($customer)
        ->get(route('dashboard'))
        ->assertRedirect(route('login'));

    $this->assertGuest();
});

test('a suspended user cannot log in', function () {
    $customer = suspend(panelCustomer(['email' => 'blocked@example.com']));

    $this->post(route('login'), ['email' => 'blocked@example.com', 'password' => 'password'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('a restored user can log in again', function () {
    $customer = panelCustomer(['email' => 'back@example.com']);

    $this->actingAs(adminUser())->post(route('admin.users.suspend', $customer));
    auth()->logout();
    $this->actingAs(adminUser())->post(route('admin.users.unsuspend', $customer));
    auth()->logout();

    $this->post(route('login'), ['email' => 'back@example.com', 'password' => 'password'])
        ->assertSessionHasNoErrors();

    $this->assertAuthenticatedAs($customer->fresh());
});

test('a suspended technician disappears from search, their profile and contact', function () {
    $this->withoutVite();

    $technician = suspend(panelTechnician(['name' => 'Hidden Tech']));
    $visible = panelTechnician(['name' => 'Visible Tech']);
    $customer = panelCustomer();

    $this->actingAs($customer)
        ->get(route('technicians.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 1)
            ->where('technicians.data.0.id', $visible->id));

    $this->actingAs($customer)->get(route('technicians.show', $technician))->assertNotFound();
    $this->actingAs($customer)->post(route('conversations.start', $technician))->assertNotFound();

    expect(Conversation::count())->toBe(0);
});

test('admin accounts cannot be suspended or deleted, not even by themselves', function () {
    $admin = adminUser();
    $otherAdmin = adminUser();

    $this->actingAs($admin);

    $this->post(route('admin.users.suspend', $admin))->assertForbidden();
    $this->post(route('admin.users.suspend', $otherAdmin))->assertForbidden();
    $this->delete(route('admin.users.destroy', $admin))->assertForbidden();
    $this->delete(route('admin.users.destroy', $otherAdmin))->assertForbidden();

    expect(User::where('role', 'admin')->count())->toBe(2);
    expect(User::whereNotNull('suspended_at')->count())->toBe(0);
    expect(AdminLog::count())->toBe(0);
});

test('deleting a customer removes them and refreshes the ratings they had affected', function () {
    $technician = panelTechnician();
    $keeper = panelCustomer();
    $leaving = panelCustomer(['name' => 'Leaving Larry', 'email' => 'larry@example.com']);

    panelReview($keeper, $technician, 5);
    panelReview($leaving, $technician, 1);

    $profile = TechnicianProfile::where('user_id', $technician->id)->first();
    expect([(int) $profile->rating_count, (float) $profile->rating_avg])->toBe([2, 3.0]);

    $admin = adminUser();

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $leaving))
        ->assertSessionHasNoErrors();

    expect(User::whereKey($leaving->id)->exists())->toBeFalse();

    $profile->refresh();
    expect([(int) $profile->rating_count, (float) $profile->rating_avg])->toBe([1, 5.0]);

    $log = AdminLog::where('action', 'user.deleted')->first();
    expect($log->admin_id)->toBe($admin->id);
    expect($log->target_id)->toBe($leaving->id);
    expect($log->description)->toContain('Leaving Larry')->toContain('larry@example.com');
});

test('deleting a technician removes their profile and conversations', function () {
    $technician = panelTechnician();
    $customer = panelCustomer();
    Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);

    $this->actingAs(adminUser())->delete(route('admin.users.destroy', $technician));

    expect(User::whereKey($technician->id)->exists())->toBeFalse();
    expect(TechnicianProfile::where('user_id', $technician->id)->exists())->toBeFalse();
    expect(Conversation::count())->toBe(0);
});

// ------------------------------------------------------------ categories

test('an admin can create a category and its slug is generated', function () {
    $admin = adminUser();

    $this->actingAs($admin)
        ->post(route('admin.categories.store'), ['name' => '  Air Conditioning  '])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('categories', ['name' => 'Air Conditioning', 'slug' => 'air-conditioning']);
    $this->assertDatabaseHas('admin_logs', ['action' => 'category.created', 'admin_id' => $admin->id]);
});

test('category names are validated', function (mixed $name) {
    $this->actingAs(adminUser())
        ->post(route('admin.categories.store'), ['name' => $name])
        ->assertSessionHasErrors('name');

    expect(Category::count())->toBe(0);
})->with([null, '', '!!!', str_repeat('a', 101)]);

test('a category cannot duplicate an existing one, even with different punctuation', function () {
    Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    $this->actingAs(adminUser());

    $this->post(route('admin.categories.store'), ['name' => 'Plumbing'])->assertSessionHasErrors('name');
    $this->post(route('admin.categories.store'), ['name' => 'plumbing!'])->assertSessionHasErrors('name');

    expect(Category::count())->toBe(1);
});

test('an admin can rename a category, and keeping its own name is allowed', function () {
    $category = Category::create(['name' => 'Painting', 'slug' => 'painting']);
    Category::create(['name' => 'HVAC', 'slug' => 'hvac']);

    $this->actingAs(adminUser());

    $this->put(route('admin.categories.update', $category), ['name' => 'Painting'])
        ->assertSessionHasNoErrors();

    $this->put(route('admin.categories.update', $category), ['name' => 'Painting & Decorating'])
        ->assertSessionHasNoErrors();

    expect($category->fresh()->only('name', 'slug'))
        ->toBe(['name' => 'Painting & Decorating', 'slug' => 'painting-decorating']);

    $this->put(route('admin.categories.update', $category), ['name' => 'HVAC'])
        ->assertSessionHasErrors('name');

    expect($category->fresh()->name)->toBe('Painting & Decorating');
});

test('deleting a category removes it from technicians and is logged', function () {
    $category = Category::create(['name' => 'Carpentry', 'slug' => 'carpentry']);
    $technician = panelTechnician();
    $technician->technicianProfile->categories()->attach($category);

    $this->actingAs(adminUser())
        ->delete(route('admin.categories.destroy', $category))
        ->assertSessionHasNoErrors();

    expect(Category::count())->toBe(0);
    expect($technician->technicianProfile->categories()->count())->toBe(0);
    expect(User::whereKey($technician->id)->exists())->toBeTrue();

    $log = AdminLog::where('action', 'category.deleted')->first();
    expect($log->description)->toContain('Carpentry')->toContain('1 technician');
});

test('the category page reports how many technicians use each category', function () {
    $this->withoutVite();

    $used = Category::create(['name' => 'Electrical', 'slug' => 'electrical']);
    Category::create(['name' => 'Roofing', 'slug' => 'roofing']);
    panelTechnician()->technicianProfile->categories()->attach($used);

    $this->actingAs(adminUser())
        ->get(route('admin.categories.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('categories.0.name', 'Electrical')
            ->where('categories.0.technician_count', 1)
            ->where('categories.1.name', 'Roofing')
            ->where('categories.1.technician_count', 0));
});

// --------------------------------------------------------------- reviews

test('an admin can remove a review, which recalculates the rating and is logged', function () {
    $technician = panelTechnician();
    $bad = panelReview(panelCustomer(['name' => 'Angry Ann']), $technician, 1);
    panelReview(panelCustomer(), $technician, 5);

    $admin = adminUser();

    $this->actingAs($admin)
        ->delete(route('admin.reviews.destroy', $bad))
        ->assertSessionHasNoErrors();

    expect(Review::count())->toBe(1);

    $profile = TechnicianProfile::where('user_id', $technician->id)->first();
    expect([(int) $profile->rating_count, (float) $profile->rating_avg])->toBe([1, 5.0]);

    $log = AdminLog::where('action', 'review.deleted')->first();
    expect($log->admin_id)->toBe($admin->id);
    expect($log->description)->toContain('Angry Ann')->toContain('1-star');
});

test('reviews can be filtered by rating and searched', function () {
    $this->withoutVite();

    $technician = panelTechnician(['name' => 'Sami Plumber']);
    panelReview(panelCustomer(['name' => 'Amira']), $technician, 5)->update(['comment' => 'Superb work']);
    panelReview(panelCustomer(['name' => 'Karim']), $technician, 2)->update(['comment' => 'Arrived late']);

    $admin = adminUser();

    $comments = fn ($query) => collect(
        $this->actingAs($admin)->get(route('admin.reviews.index', $query))
            ->viewData('page')['props']['reviews']['data']
    )->pluck('comment')->sort()->values()->all();

    expect($comments(['rating' => 2]))->toBe(['Arrived late']);
    expect($comments(['q' => 'superb']))->toBe(['Superb work']);
    expect($comments(['q' => 'Karim']))->toBe(['Arrived late']);
    expect($comments([]))->toHaveCount(2);
});

// ------------------------------------------------------------------ logs

test('the activity log lists entries newest first with the admin who acted', function () {
    $this->withoutVite();

    $admin = adminUser();
    AdminLog::record($admin, 'category.created', 'Created category "First"');
    AdminLog::record($admin, 'category.created', 'Created category "Second"');

    $this->actingAs($admin)
        ->get(route('admin.logs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('logs.data', 2)
            ->where('logs.data.0.description', 'Created category "Second"')
            ->where('logs.data.0.admin', $admin->name));
});

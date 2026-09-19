<?php

use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\LogController as AdminLogController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Admin\SupportController as AdminSupportController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SupportController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\TechnicianController;
use App\Http\Controllers\TechnicianProfileController;
use App\Http\Controllers\DashboardController;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::post('/profile/avatar', [AvatarController::class, 'store'])->name('profile.avatar.store');
    Route::delete('/profile/avatar', [AvatarController::class, 'destroy'])->name('profile.avatar.destroy');
    Route::get('/avatars/{user}', [AvatarController::class, 'show'])->name('avatars.show');
    Route::get('/messages', [ConversationController::class, 'index'])->name('conversations.index');
    Route::get('/messages/{conversation}', [ConversationController::class, 'show'])->name('conversations.show');
    Route::post('/technicians/{technician}/contact', [ConversationController::class, 'startWith'])->name('conversations.start');
    Route::post('/messages/{conversation}', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/message-attachments/{attachment}', [MessageController::class, 'attachment'])->name('messages.attachment');
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    Route::get('/support', [SupportController::class, 'index'])->name('support.index');
    // Must stay above /support/{ticket}, or "new" would be read as a ticket id.
    Route::get('/support/new', [SupportController::class, 'create'])->name('support.create');
    Route::post('/support', [SupportController::class, 'store'])->middleware('throttle:6,1')->name('support.store');
    Route::get('/support/{ticket}', [SupportController::class, 'show'])->name('support.show');
    Route::post('/support/{ticket}/reply', [SupportController::class, 'reply'])->middleware('throttle:20,1')->name('support.reply');
    Route::post('/support/{ticket}/close', [SupportController::class, 'close'])->name('support.close');
    Route::get('/technicians', [TechnicianController::class, 'index'])->name('technicians.index');
    Route::get('/technicians/{technician}', [TechnicianController::class, 'show'])->name('technicians.show');
    Route::post('/technicians/{technician}/review', [ReviewController::class, 'store'])->name('reviews.store');
    Route::delete('/technicians/{technician}/review', [ReviewController::class, 'destroy'])->name('reviews.destroy');
    });

Route::middleware(['auth', 'role:technician'])->group(function () {
    Route::get('/technician/profile', [TechnicianProfileController::class, 'edit'])->name('technician.profile.edit');
    Route::put('/technician/profile', [TechnicianProfileController::class, 'update'])->name('technician.profile.update');
});

Route::middleware(['auth', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
    Route::post('/users/{user}/suspend', [AdminUserController::class, 'suspend'])->name('users.suspend');
    Route::post('/users/{user}/unsuspend', [AdminUserController::class, 'unsuspend'])->name('users.unsuspend');
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');

    Route::get('/categories', [AdminCategoryController::class, 'index'])->name('categories.index');
    Route::post('/categories', [AdminCategoryController::class, 'store'])->name('categories.store');
    Route::put('/categories/{category}', [AdminCategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy'])->name('categories.destroy');

    Route::get('/reviews', [AdminReviewController::class, 'index'])->name('reviews.index');
    Route::delete('/reviews/{review}', [AdminReviewController::class, 'destroy'])->name('reviews.destroy');

    Route::get('/support', [AdminSupportController::class, 'index'])->name('support.index');
    Route::get('/support/{ticket}', [AdminSupportController::class, 'show'])->name('support.show');
    Route::post('/support/{ticket}/reply', [AdminSupportController::class, 'reply'])->name('support.reply');
    Route::post('/support/{ticket}/status', [AdminSupportController::class, 'status'])->name('support.status');

    Route::get('/logs', [AdminLogController::class, 'index'])->name('logs.index');
});

require __DIR__.'/auth.php';

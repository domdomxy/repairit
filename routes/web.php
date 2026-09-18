<?php

use App\Http\Controllers\ProfileController;
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
    Route::get('/messages', [ConversationController::class, 'index'])->name('conversations.index');
    Route::get('/messages/{conversation}', [ConversationController::class, 'show'])->name('conversations.show');
    Route::post('/technicians/{technician}/contact', [ConversationController::class, 'startWith'])->name('conversations.start');
    Route::post('/messages/{conversation}', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/technicians', [TechnicianController::class, 'index'])->name('technicians.index');
    Route::get('/technicians/{technician}', [TechnicianController::class, 'show'])->name('technicians.show');
    });

Route::middleware(['auth', 'role:customer'])->group(function () {
    Route::post('/technicians/{technician}/review', [ReviewController::class, 'store'])->name('reviews.store');
    Route::delete('/technicians/{technician}/review', [ReviewController::class, 'destroy'])->name('reviews.destroy');
});

Route::middleware(['auth', 'role:technician'])->group(function () {
    Route::get('/technician/profile', [TechnicianProfileController::class, 'edit'])->name('technician.profile.edit');
    Route::put('/technician/profile', [TechnicianProfileController::class, 'update'])->name('technician.profile.update');
});

require __DIR__.'/auth.php';

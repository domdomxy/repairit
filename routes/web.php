<?php

use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\LogController as AdminLogController;
use App\Http\Controllers\Admin\ReportController as AdminReportController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Admin\SupportController as AdminSupportController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\CustomerProfileController;
use App\Http\Controllers\CustomerReviewController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OfferController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\RepairController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\SupportController;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\TechnicianController;
use App\Http\Controllers\TechnicianOfferController;
use App\Http\Controllers\TechnicianProfileController;
use App\Http\Controllers\TechnicianRepairController;
use App\Http\Controllers\DashboardController;
use Inertia\Inertia;

Route::get('/', function () {
    // The main page of the app, once signed in, is the feed.
    if (auth()->check()) {
        return redirect()->route('feed.index');
    }

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
    // Hiding, deleting and reporting a conversation. Hiding and deleting only affect the person asking.
    Route::post('/messages/{conversation}/hide', [ConversationController::class, 'hide'])->name('conversations.hide');
    Route::post('/messages/{conversation}/unhide', [ConversationController::class, 'unhide'])->name('conversations.unhide');
    Route::delete('/messages/{conversation}', [ConversationController::class, 'destroy'])->name('conversations.destroy');
    Route::post('/messages/{conversation}/report', [ReportController::class, 'storeConversation'])->middleware('throttle:10,1,reports')->name('conversations.report');
    // One message: edit it, delete it (scope "me" or "everyone"), or report it.
    Route::patch('/message/{message}', [MessageController::class, 'update'])->name('messages.update');
    Route::delete('/message/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');
    Route::post('/message/{message}/report', [ReportController::class, 'storeMessage'])->middleware('throttle:10,1,reports')->name('messages.report');
    Route::get('/message-attachments/{attachment}', [MessageController::class, 'attachment'])->name('messages.attachment');
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    Route::delete('/notifications', [NotificationController::class, 'clear'])->name('notifications.clear');
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy'])->name('notifications.destroy');
    Route::get('/support', [SupportController::class, 'index'])->name('support.index');
    // Must stay above /support/{ticket}, or "new" would be read as a ticket id.
    Route::get('/support/new', [SupportController::class, 'create'])->name('support.create');
    Route::post('/support', [SupportController::class, 'store'])->middleware('throttle:6,1')->name('support.store');
    Route::get('/support/{ticket}', [SupportController::class, 'show'])->name('support.show');
    Route::post('/support/{ticket}/reply', [SupportController::class, 'reply'])->middleware('throttle:20,1')->name('support.reply');
    Route::post('/support/{ticket}/close', [SupportController::class, 'close'])->name('support.close');
    Route::get('/technicians', [TechnicianController::class, 'index'])->name('technicians.index');
    Route::get('/technicians/{technician}', [TechnicianController::class, 'show'])->name('technicians.show');
    // A customer's public profile, and technicians rating the customers they have worked with.
    Route::get('/customers/{customer}', [CustomerProfileController::class, 'show'])->name('customers.show');
    Route::post('/customers/{customer}/review', [CustomerReviewController::class, 'store'])->name('customer-reviews.store');
    Route::delete('/customers/{customer}/review', [CustomerReviewController::class, 'destroy'])->name('customer-reviews.destroy');
    // The feed: every technician's offers and every open repair request, with search and filters.
    // (The technician's own offers are technician.offers.index, a customer's own requests requests.mine.)
    Route::get('/feed', [FeedController::class, 'index'])->name('feed.index');
    // The feed used to be the offers page: keep old links (and their filters) working.
    Route::get('/offers', fn (Request $request) => redirect()->route('feed.index', $request->query()));
    // One offer on its own page: the link people copy and share.
    Route::get('/offers/{offer}', [OfferController::class, 'show'])->name('offers.show');
    // Send an offer in the chat with its technician (starting the chat if needed).
    Route::post('/offers/{offer}/share', [MessageController::class, 'shareOffer'])->middleware('throttle:20,1')->name('offers.share');
    // Report an offer to the admins.
    Route::post('/offers/{offer}/report', [ReportController::class, 'storeOffer'])->middleware('throttle:10,1,reports')->name('offers.report');
    // Report a review: one a customer wrote about a technician, or one a technician wrote about a customer.
    Route::post('/reviews/{review}/report', [ReportController::class, 'storeReview'])->middleware('throttle:10,1,reports')->name('reviews.report');
    Route::post('/customer-reviews/{customerReview}/report', [ReportController::class, 'storeCustomerReview'])->middleware('throttle:10,1,reports')->name('customer-reviews.report');
    Route::get('/offer-media/{media}', [TechnicianOfferController::class, 'media'])->name('offers.media');
    // Repair requests: what customers need fixed, for technicians to answer with a quote.
    // "mine" and "new" must stay above /requests/{serviceRequest}, or they would be read as an id.
    Route::get('/requests', [ServiceRequestController::class, 'index'])->name('requests.index');
    Route::get('/requests/mine', [ServiceRequestController::class, 'mine'])->name('requests.mine');
    Route::get('/requests/new', [ServiceRequestController::class, 'create'])->name('requests.create');
    Route::post('/requests', [ServiceRequestController::class, 'store'])->middleware('throttle:10,1')->name('requests.store');
    Route::get('/requests/{serviceRequest}', [ServiceRequestController::class, 'show'])->name('requests.show');
    Route::get('/requests/{serviceRequest}/edit', [ServiceRequestController::class, 'edit'])->name('requests.edit');
    Route::put('/requests/{serviceRequest}', [ServiceRequestController::class, 'update'])->name('requests.update');
    Route::delete('/requests/{serviceRequest}', [ServiceRequestController::class, 'destroy'])->name('requests.destroy');
    Route::post('/requests/{serviceRequest}/close', [ServiceRequestController::class, 'close'])->name('requests.close');
    Route::post('/requests/{serviceRequest}/reopen', [ServiceRequestController::class, 'reopen'])->name('requests.reopen');
    // The customer choosing one of the quotes they received.
    Route::post('/quotes/{quote}/accept', [QuoteController::class, 'accept'])->name('quotes.accept');
    // Following a repair: the ones linked to my account, and one by its code (the link the technician gives out).
    Route::get('/repairs', [RepairController::class, 'index'])->name('repairs.index');
    Route::get('/repairs/{repair}', [RepairController::class, 'show'])->name('repairs.show');
    Route::post('/technicians/{technician}/review', [ReviewController::class, 'store'])->name('reviews.store');
    Route::delete('/technicians/{technician}/review', [ReviewController::class, 'destroy'])->name('reviews.destroy');
    });

Route::middleware(['auth', 'role:customer'])->group(function () {
    // What a customer chooses to show on their public profile page: a page of its own, like a technician's.
    Route::get('/customer/profile', [CustomerProfileController::class, 'edit'])->name('customer.profile.edit');
    Route::put('/customer/profile', [CustomerProfileController::class, 'update'])->name('customer.profile.update');
});

Route::middleware(['auth', 'role:technician'])->group(function () {
    Route::get('/technician/profile', [TechnicianProfileController::class, 'edit'])->name('technician.profile.edit');
    Route::put('/technician/profile', [TechnicianProfileController::class, 'update'])->name('technician.profile.update');
    // Answering a customer's repair request with a quote (sending again edits it), or taking it back.
    Route::post('/requests/{serviceRequest}/quotes', [QuoteController::class, 'store'])->middleware('throttle:30,1')->name('requests.quotes.store');
    Route::delete('/requests/{serviceRequest}/quote', [QuoteController::class, 'destroy'])->name('requests.quote.destroy');
    Route::get('/technician/offers', [TechnicianOfferController::class, 'index'])->name('technician.offers.index');
    Route::post('/technician/offers', [TechnicianOfferController::class, 'store'])->name('technician.offers.store');
    // The edit form sends a POST with _method=PUT: PHP doesn't read uploaded files from a real PUT request.
    Route::put('/technician/offers/{offer}', [TechnicianOfferController::class, 'update'])->name('technician.offers.update');
    Route::delete('/technician/offers/{offer}', [TechnicianOfferController::class, 'destroy'])->name('technician.offers.destroy');
    // Keeping track of what customers leave: start tracking, post updates, fix details, delete.
    Route::get('/technician/repairs', [TechnicianRepairController::class, 'index'])->name('technician.repairs.index');
    Route::post('/technician/repairs', [TechnicianRepairController::class, 'store'])->middleware('throttle:30,1')->name('technician.repairs.store');
    Route::put('/technician/repairs/{repair}', [TechnicianRepairController::class, 'update'])->name('technician.repairs.update');
    Route::post('/technician/repairs/{repair}/updates', [TechnicianRepairController::class, 'storeUpdate'])->middleware('throttle:60,1')->name('technician.repairs.updates.store');
    Route::delete('/technician/repairs/{repair}', [TechnicianRepairController::class, 'destroy'])->name('technician.repairs.destroy');
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

    Route::get('/reports', [AdminReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/{report}', [AdminReportController::class, 'show'])->name('reports.show');
    Route::post('/reports/{report}/status', [AdminReportController::class, 'status'])->name('reports.status');
    // Remove the review a report is about.
    Route::delete('/reports/{report}/review', [AdminReportController::class, 'destroyReview'])->name('reports.review.destroy');

    Route::get('/logs', [AdminLogController::class, 'index'])->name('logs.index');
});

require __DIR__.'/auth.php';

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A report can now be about a review: one a customer wrote about a
     * technician (`reviews`), or one a technician wrote about a customer
     * (`customer_reviews`). Like an offer report it has no conversation.
     *
     * A review can be edited or deleted after it is reported, so what it said
     * (and who it was about) is copied onto the report. The two foreign keys
     * only link to the review while it still exists.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('review_id')->nullable()->after('offer_title')->constrained()->nullOnDelete();
            $table->foreignId('customer_review_id')->nullable()->after('review_id')->constrained()->nullOnDelete();
            // 'technician' = a review about a technician, 'customer' = a review about a customer.
            $table->string('review_kind', 20)->nullable()->after('customer_review_id');
            // Who the review was about (the reported user is the one who wrote it).
            $table->foreignId('review_subject_id')->nullable()->after('review_kind')->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('review_rating')->nullable()->after('review_subject_id');
            $table->text('review_comment')->nullable()->after('review_rating');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('review_id');
            $table->dropConstrainedForeignId('customer_review_id');
            $table->dropConstrainedForeignId('review_subject_id');
            $table->dropColumn(['review_kind', 'review_rating', 'review_comment']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // A message that shares a repair request, or carries a technician's
            // quote for one. The request can be deleted later, so the start of
            // its text is kept: the chat then says which request is gone.
            $table->foreignId('service_request_id')->nullable()->constrained()->nullOnDelete();
            $table->string('request_excerpt', 160)->nullable();

            // A message that carries a quote. It is withdrawn by deleting the
            // quote, so the price is kept for the chat to say what was withdrawn.
            $table->foreignId('quote_id')->nullable()->constrained()->nullOnDelete();
            $table->string('quote_price', 60)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_request_id');
            $table->dropConstrainedForeignId('quote_id');
            $table->dropColumn(['request_excerpt', 'quote_price']);
        });
    }
};

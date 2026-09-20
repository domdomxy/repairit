<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The categories a technician tags an offer with (one or more).
        Schema::create('category_offer', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['offer_id', 'category_id']);
        });

        // Until now an offer was shown under the categories its technician works
        // in. Existing offers keep exactly that, as tags they can change.
        $now = now()->toDateTimeString();

        DB::table('category_offer')->insertUsing(
            ['offer_id', 'category_id', 'created_at', 'updated_at'],
            DB::table('offers')
                ->join('technician_profiles', 'technician_profiles.user_id', '=', 'offers.technician_id')
                ->join('category_technician', 'category_technician.technician_profile_id', '=', 'technician_profiles.id')
                ->selectRaw('offers.id, category_technician.category_id, ?, ?', [$now, $now]),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('category_offer');
    }
};

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Category extends Model
{
    protected $fillable = ['name', 'slug', 'icon'];

    public function technicianProfiles(): BelongsToMany
    {
        return $this->belongsToMany(TechnicianProfile::class, 'category_technician');
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offer extends Model
{
    /** Private disk (storage/app/private): files are only reachable through the authorised route. */
    public const MEDIA_DISK = 'local';

    /** Most offers one technician can have. */
    public const MAX_PER_TECHNICIAN = 20;

    /** Most pictures and videos one offer can carry. */
    public const MEDIA_MAX_FILES = 6;

    /** Largest single picture, in kilobytes. */
    public const IMAGE_MAX_KB = 5120;

    /** Largest single video, in kilobytes. */
    public const VIDEO_MAX_KB = 40960;

    /** Largest total for the files of one upload, in kilobytes. */
    public const MEDIA_MAX_TOTAL_KB = 81920;

    /**
     * What may be uploaded: real content type => kind. The type is read from
     * the file's content, not its name. Add a line here to allow another type.
     */
    public const MEDIA_MIMES = [
        'image/jpeg' => 'image',
        'image/png' => 'image',
        'image/webp' => 'image',
        'image/gif' => 'image',
        'video/mp4' => 'video',
        'video/webm' => 'video',
        'video/quicktime' => 'video',
    ];

    /** The same types as file extensions, for the file picker and quick checks in the browser. */
    public const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];

    protected $fillable = [
        'technician_id',
        'title',
        'description',
        'price',
    ];

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    /** The categories the technician tagged this offer with, by name. Load them with `with('categories')`. */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_offer')->orderBy('categories.name');
    }

    /** The pictures and videos of this offer, oldest first. Load them with `with('media')`. */
    public function media(): HasMany
    {
        return $this->hasMany(OfferMedia::class)->orderBy('id');
    }

    /**
     * The upload limits in force right now: the configured ones above, lowered
     * to what PHP will actually accept (upload_max_filesize / post_max_size).
     * Without this, a video that passes our rules can still be dropped by PHP
     * before Laravel sees it, and the person gets an unhelpful error.
     *
     * @return array{max_files: int, image_max_kb: int, video_max_kb: int, max_total_kb: int}
     */
    public static function limits(): array
    {
        $file = self::iniKb('upload_max_filesize');
        $post = self::iniKb('post_max_size');

        return [
            'max_files' => self::MEDIA_MAX_FILES,
            'image_max_kb' => min(self::IMAGE_MAX_KB, $file),
            'video_max_kb' => min(self::VIDEO_MAX_KB, $file),
            'max_total_kb' => min(self::MEDIA_MAX_TOTAL_KB, $post),
        ];
    }

    /** A php.ini size ("2M", "1G", "0") in kilobytes. 0 and -1 mean "no limit". */
    private static function iniKb(string $setting): int
    {
        $bytes = ini_parse_quantity((string) ini_get($setting));

        return $bytes > 0 ? intdiv($bytes, 1024) : PHP_INT_MAX;
    }

    /**
     * The public card: only what the browser needs. Files are listed through
     * OfferMedia, which keeps storage paths and content types on the server.
     *
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'price' => $this->price,
            'categories' => $this->categories
                ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug])
                ->values()
                ->all(),
            'media' => $this->media->values()->all(),
        ];
    }
}

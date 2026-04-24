<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImageGeneration extends Model
{
    protected $table = 'image_generations';

    protected $fillable = [
        'user_id', 'type', 'prompt', 'model',
        'image_data', 'mime_type', 'caption',
    ];

    public function getImageSrcAttribute(): ?string
    {
        if (! $this->image_data) return null;
        return 'data:' . ($this->mime_type ?: 'image/png') . ';base64,' . $this->image_data;
    }
}

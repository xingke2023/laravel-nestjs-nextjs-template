<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VideoGeneration extends Model
{
    protected $table = 'video_generations';

    protected $fillable = [
        'user_id', 'task_id', 'prompt', 'model',
        'status', 'video_url', 'resolution', 'duration', 'ratio',
    ];
}

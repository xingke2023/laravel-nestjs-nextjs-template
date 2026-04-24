<?php

namespace App\Filament\Resources\ImageGenerations\Pages;

use App\Filament\Resources\ImageGenerations\ImageGenerationResource;
use Filament\Resources\Pages\ViewRecord;

class ViewImageGeneration extends ViewRecord
{
    protected static string $resource = ImageGenerationResource::class;

    /**
     * Load image_data when viewing a record so the infolist ImageEntry works.
     * The Model excludes image_data from default selects to keep list queries fast.
     */
    protected function resolveRecord(int | string $key): \App\Models\ImageGeneration
    {
        return \App\Models\ImageGeneration::withoutGlobalScopes()
            ->select(['id','user_id','type','prompt','model','mime_type','caption','image_data','created_at','updated_at'])
            ->findOrFail($key);
    }
}

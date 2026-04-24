<?php

namespace App\Filament\Resources\ImageGenerations\Pages;

use App\Filament\Resources\ImageGenerations\ImageGenerationResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListImageGenerations extends ListRecords
{
    protected static string $resource = ImageGenerationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}

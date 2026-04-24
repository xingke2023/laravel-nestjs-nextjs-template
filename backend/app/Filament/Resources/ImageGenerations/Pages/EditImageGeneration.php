<?php

namespace App\Filament\Resources\ImageGenerations\Pages;

use App\Filament\Resources\ImageGenerations\ImageGenerationResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditImageGeneration extends EditRecord
{
    protected static string $resource = ImageGenerationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}

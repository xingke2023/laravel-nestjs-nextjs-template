<?php

namespace App\Filament\Resources\VideoGenerations\Pages;

use App\Filament\Resources\VideoGenerations\VideoGenerationResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditVideoGeneration extends EditRecord
{
    protected static string $resource = VideoGenerationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}

<?php

namespace App\Filament\Resources\VideoGenerations\Pages;

use App\Filament\Resources\VideoGenerations\VideoGenerationResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListVideoGenerations extends ListRecords
{
    protected static string $resource = VideoGenerationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}

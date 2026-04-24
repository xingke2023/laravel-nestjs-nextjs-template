<?php

namespace App\Filament\Resources\VideoGenerations\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;

class VideoGenerationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('user_id'),
                TextInput::make('task_id')
                    ->required(),
                Textarea::make('prompt')
                    ->required()
                    ->columnSpanFull(),
                TextInput::make('model'),
                TextInput::make('status')
                    ->required()
                    ->default('queued'),
                Textarea::make('video_url')
                    ->columnSpanFull(),
                TextInput::make('resolution'),
                TextInput::make('duration')
                    ->numeric(),
                TextInput::make('ratio'),
            ]);
    }
}

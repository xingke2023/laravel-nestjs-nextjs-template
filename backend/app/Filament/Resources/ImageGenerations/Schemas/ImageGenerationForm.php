<?php

namespace App\Filament\Resources\ImageGenerations\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;

class ImageGenerationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('user_id'),
                Select::make('type')
                    ->options(['image' => 'Image', 'image_chat' => 'Image chat'])
                    ->default('image')
                    ->required(),
                Textarea::make('prompt')
                    ->required()
                    ->columnSpanFull(),
                TextInput::make('model'),
                Textarea::make('image_data')
                    ->required()
                    ->columnSpanFull(),
                TextInput::make('mime_type')
                    ->required()
                    ->default('image/png'),
                Textarea::make('caption')
                    ->columnSpanFull(),
            ]);
    }
}

<?php

namespace App\Filament\Resources\ImageGenerations;

use App\Filament\Resources\ImageGenerations\Pages\ListImageGenerations;
use App\Filament\Resources\ImageGenerations\Pages\ViewImageGeneration;

use App\Filament\Resources\ImageGenerations\Tables\ImageGenerationsTable;
use App\Models\ImageGeneration;
use BackedEnum;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class ImageGenerationResource extends Resource
{
    protected static ?string $model = ImageGeneration::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedPhoto;

    protected static ?string $navigationLabel = '图片生成历史';

    protected static ?string $modelLabel = '图片生成';

    protected static ?string $pluralModelLabel = '图片生成历史';

    public static function form(Schema $schema): Schema
    {
        return $schema;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            ImageEntry::make('image_src')
                ->label('生成图片')
                ->width(512)
                ->height(512)
                ->columnSpanFull(),
            TextEntry::make('user_id')->label('用户 ID'),
            TextEntry::make('type')->label('类型')->badge(),
            TextEntry::make('model')->label('模型'),
            TextEntry::make('created_at')->label('生成时间')->dateTime('Y-m-d H:i:s'),
            TextEntry::make('prompt')->label('提示词')->columnSpanFull(),
            TextEntry::make('caption')->label('描述')->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return ImageGenerationsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListImageGenerations::route('/'),
            'view'  => ViewImageGeneration::route('/{record}'),
        ];
    }
}

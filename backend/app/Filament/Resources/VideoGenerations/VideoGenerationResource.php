<?php

namespace App\Filament\Resources\VideoGenerations;

use App\Filament\Resources\VideoGenerations\Pages\ListVideoGenerations;
use App\Filament\Resources\VideoGenerations\Pages\ViewVideoGeneration;
use App\Filament\Resources\VideoGenerations\Tables\VideoGenerationsTable;
use App\Models\VideoGeneration;
use BackedEnum;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class VideoGenerationResource extends Resource
{
    protected static ?string $model = VideoGeneration::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedFilm;

    protected static ?string $navigationLabel = '视频生成历史';

    protected static ?string $modelLabel = '视频生成';

    protected static ?string $pluralModelLabel = '视频生成历史';

    public static function form(Schema $schema): Schema
    {
        return $schema;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            TextEntry::make('user_id')->label('用户 ID'),
            TextEntry::make('status')->label('状态')->badge()
                ->color(fn (string $state) => match ($state) {
                    'succeeded' => 'success',
                    'failed'    => 'danger',
                    'queued'    => 'gray',
                    default     => 'warning',
                }),
            TextEntry::make('model')->label('模型'),
            TextEntry::make('resolution')->label('分辨率'),
            TextEntry::make('duration')->label('时长(s)'),
            TextEntry::make('ratio')->label('比例'),
            TextEntry::make('created_at')->label('提交时间')->dateTime('Y-m-d H:i:s'),
            TextEntry::make('updated_at')->label('更新时间')->dateTime('Y-m-d H:i:s'),
            TextEntry::make('task_id')->label('任务 ID')->columnSpanFull(),
            TextEntry::make('prompt')->label('提示词')->columnSpanFull(),
            TextEntry::make('video_url')->label('视频')
                ->html()
                ->formatStateUsing(fn ($state) => $state
                    ? '<video controls playsinline style="max-width:100%;max-height:480px;border-radius:8px" src="' . e($state) . '"></video>'
                      . '<br><a href="' . e($state) . '" target="_blank" style="font-size:12px;color:#6b7280;word-break:break-all">' . e($state) . '</a>'
                    : '<span style="color:#9ca3af">暂无视频</span>')
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return VideoGenerationsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListVideoGenerations::route('/'),
            'view'  => ViewVideoGeneration::route('/{record}'),
        ];
    }
}

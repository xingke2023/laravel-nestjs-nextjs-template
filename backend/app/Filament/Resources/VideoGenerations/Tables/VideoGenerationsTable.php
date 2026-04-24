<?php

namespace App\Filament\Resources\VideoGenerations\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class VideoGenerationsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('user_id')
                    ->label('用户')
                    ->sortable()
                    ->searchable(),
                TextColumn::make('status')
                    ->label('状态')
                    ->badge()
                    ->color(fn (string $state) => match ($state) {
                        'succeeded' => 'success',
                        'failed'    => 'danger',
                        'queued'    => 'gray',
                        default     => 'warning',
                    }),
                TextColumn::make('prompt')
                    ->label('提示词')
                    ->limit(50)
                    ->searchable(),
                TextColumn::make('model')->label('模型')->toggleable(),
                TextColumn::make('resolution')->label('分辨率')->toggleable(),
                TextColumn::make('duration')->label('时长(s)')->toggleable(),
                TextColumn::make('video_url')
                    ->label('视频')
                    ->formatStateUsing(fn ($state) => $state ? '▶ 播放' : '-')
                    ->url(fn ($record) => $record->video_url)
                    ->openUrlInNewTab()
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('时间')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('状态')
                    ->options([
                        'queued'    => '排队中',
                        'running'   => '生成中',
                        'succeeded' => '成功',
                        'failed'    => '失败',
                    ]),
            ])
            ->recordActions([
                ViewAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}

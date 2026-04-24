<?php

namespace App\Filament\Resources\ImageGenerations\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ImageGenerationsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                ImageColumn::make('image_src')
                    ->label('图片')
                    ->height(60)
                    ->width(60),
                TextColumn::make('user_id')
                    ->label('用户')
                    ->sortable()
                    ->searchable(),
                TextColumn::make('type')
                    ->label('类型')
                    ->badge()
                    ->color(fn (string $state) => match ($state) {
                        'image_chat' => 'warning',
                        default => 'primary',
                    }),
                TextColumn::make('prompt')
                    ->label('提示词')
                    ->limit(60)
                    ->searchable(),
                TextColumn::make('model')
                    ->label('模型')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('时间')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->label('类型')
                    ->options(['image' => 'image', 'image_chat' => 'image_chat']),
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

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clothing_items', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->comment('SSO user ID (JWT sub)');
            $table->enum('category', ['top', 'pants', 'skirt', 'accessory'])->comment('上衣/裤子/裙子/配饰');
            $table->string('name')->nullable()->comment('商品名称');
            $table->string('image_url')->comment('图片访问 URL');
            $table->string('filename')->comment('存储文件名');
            $table->timestamps();

            $table->index(['user_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clothing_items');
    }
};

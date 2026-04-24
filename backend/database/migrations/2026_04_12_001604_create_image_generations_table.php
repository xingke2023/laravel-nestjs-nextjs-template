<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('image_generations', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->nullable()->comment('SSO user ID (JWT sub)');
            $table->enum('type', ['image', 'image_chat'])->default('image');
            $table->text('prompt');
            $table->string('model')->nullable();
            $table->longText('image_data')->comment('base64 encoded image');
            $table->string('mime_type')->default('image/png');
            $table->text('caption')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('image_generations');
    }
};

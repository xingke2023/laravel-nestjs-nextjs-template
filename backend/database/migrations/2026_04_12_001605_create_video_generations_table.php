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
        Schema::create('video_generations', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->nullable()->comment('SSO user ID (JWT sub)');
            $table->string('task_id')->unique();
            $table->text('prompt');
            $table->string('model')->nullable();
            $table->string('status')->default('queued');
            $table->text('video_url')->nullable();
            $table->string('resolution')->nullable();
            $table->unsignedTinyInteger('duration')->nullable();
            $table->string('ratio')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('video_generations');
    }
};

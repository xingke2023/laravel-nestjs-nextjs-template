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
        Schema::create('wx_messages', function (Blueprint $table) {
            $table->id();
            $table->string('openid')->comment('发送者 openid');
            $table->string('msg_type')->comment('消息类型 text/image/event...');
            $table->text('content')->nullable()->comment('消息内容');
            $table->string('event')->nullable()->comment('事件类型（subscribe等）');
            $table->string('msg_id')->nullable()->comment('微信消息ID');
            $table->text('raw_xml')->comment('原始解密XML');
            $table->text('reply')->nullable()->comment('回复内容');
            $table->timestamps();
            $table->index('openid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wx_messages');
    }
};

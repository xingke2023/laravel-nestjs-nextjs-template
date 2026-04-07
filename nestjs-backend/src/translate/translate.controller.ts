import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { TranslateService } from './translate.service.js';
import { GeminiDto } from './dto/gemini.dto.js';

@Controller()
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  /**
   * GET /api/speech-key
   * 需要 JWT 认证（默认全局保护，不加 @Public()）
   * 返回 Azure 语音识别密钥（eastasia 优先轮询）
   */
  @Get('speech-key')
  getSpeechKey(): { key: string; region: string } {
    return this.translateService.getSpeechKey();
  }

  /**
   * POST /api/gemini
   * 需要 JWT 认证（默认全局保护，不加 @Public()）
   * 接收语音识别文字，返回 Gemini 生成的面试回答
   */
  @Post('gemini')
  @HttpCode(200)
  async getGeminiAnswer(@Body() dto: GeminiDto): Promise<{ answer: string }> {
    const answer = await this.translateService.getGeminiAnswer(dto.text);
    return { answer };
  }
}

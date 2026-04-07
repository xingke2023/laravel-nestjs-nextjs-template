import { Module } from '@nestjs/common';
import { TranslateService } from './translate.service.js';
import { TranslateController } from './translate.controller.js';

@Module({
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}

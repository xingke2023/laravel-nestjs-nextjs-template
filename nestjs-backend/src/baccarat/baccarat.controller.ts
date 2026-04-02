import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BaccaratService } from './baccarat.service';
import { Public } from '../auth/public.decorator';

@Controller('baccarat')
export class BaccaratController {
  constructor(private readonly baccaratService: BaccaratService) {}

  @Public()
  @Get('calc')
  calc(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.calc(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Post('remove')
  remove(
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() body: any,
    @Res() res: any,
  ) {
    const cards = Array.isArray(body?.cards) ? body.cards : [];
    const { id, data } = this.baccaratService.remove(sessionId ?? null, cards);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Post('reset')
  reset(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.reset(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Get('status')
  status(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.status(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Get('dragon-impact')
  dragonImpact(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.dragonImpact(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Get('lucky6-impact')
  lucky6Impact(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.lucky6Impact(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Get('s7-impact')
  s7Impact(
    @Headers('x-session-id') sessionId: string | undefined,
    @Res() res: any,
  ) {
    const { id, data } = this.baccaratService.s7Impact(sessionId ?? null);
    (res as Response).set('X-Session-Id', id);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate')
  simulate(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulate(hands);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate-s7')
  simulateS7(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulateS7(hands);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate-dragon')
  simulateDragon(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulateDragon(hands);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate-l6two')
  simulateL6Two(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulateL6Two(hands);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate-l6three')
  simulateL6Three(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulateL6Three(hands);
    return (res as Response).json(data);
  }

  @Public()
  @Post('simulate-l6combo')
  simulateL6Combo(@Body() body: any, @Res() res: any) {
    const hands = parseInt(body?.hands, 10) || 100;
    const data = this.baccaratService.simulateL6Combo(hands);
    return (res as Response).json(data);
  }
}

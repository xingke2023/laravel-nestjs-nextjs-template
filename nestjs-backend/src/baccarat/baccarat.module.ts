import { Module } from '@nestjs/common';
import { BaccaratService } from './baccarat.service';
import { BaccaratController } from './baccarat.controller';

@Module({
  controllers: [BaccaratController],
  providers: [BaccaratService],
})
export class BaccaratModule {}

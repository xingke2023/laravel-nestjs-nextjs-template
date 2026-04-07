import { IsNotEmpty, IsString } from 'class-validator';

export class GeminiDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

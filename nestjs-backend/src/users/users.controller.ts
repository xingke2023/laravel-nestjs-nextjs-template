import { Controller, Get, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from './user.entity';

interface AuthenticatedRequest extends Request {
  userId: number;
}

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    const user = await this.usersRepo.findOneBy({ id: req.userId });
    return {
      id: user!.id,
      name: user!.name,
      email: user!.email,
    };
  }
}

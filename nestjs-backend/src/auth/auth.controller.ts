import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { User } from '../users/user.entity';
import { SsoUser } from './sso-user.entity';
import { AuthCenterService } from './auth-center.service';
import { Public } from './public.decorator';

interface AuthenticatedRequest extends Request {
  userId: number;
}

class LoginDto {
  @IsString() identifier: string;
  @IsString() password: string;
}

class RegisterDto {
  @IsString() username: string;
  @IsString() @MinLength(8) password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

class LogoutDto {
  @IsString() refreshToken: string;
}

@Controller()
export class AuthController {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(SsoUser)
    private readonly ssoUsersRepo: Repository<SsoUser>,
    private readonly authCenter: AuthCenterService,
  ) {}

  @Public()
  @Post('auth/login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authCenter.login(dto.identifier, dto.password);
    const user = await this.syncUser(result.user);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: this.userResponse(user),
    };
  }

  @Public()
  @Post('auth/register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authCenter.register(dto.username, dto.password);
    const user = await this.syncUser(result.user);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: this.userResponse(user),
    };
  }

  @Public()
  @Post('token/refresh')
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authCenter.refreshToken(dto.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('token/logout')
  async logout(@Body() dto: LogoutDto) {
    await this.authCenter.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersRepo.findOneBy({ id: req.userId });
    if (!user) throw new UnauthorizedException();
    return { user: this.userResponse(user) };
  }

  private async syncUser(ssoUser: {
    id: number;
    username: string;
    name: string;
    email?: string;
  }): Promise<User> {
    const mapping = await this.ssoUsersRepo.findOneBy({ ssoUserId: ssoUser.id });

    if (mapping) {
      const user = await this.usersRepo.findOneBy({ id: mapping.localUserId });
      if (user) {
        user.username = ssoUser.username;
        user.name = ssoUser.name;
        user.email = ssoUser.email ?? user.email;
        return this.usersRepo.save(user);
      }
    }

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        username: ssoUser.username,
        name: ssoUser.name,
        email: ssoUser.email ?? null,
      }),
    );

    await this.ssoUsersRepo.save(
      this.ssoUsersRepo.create({ ssoUserId: ssoUser.id, localUserId: user.id }),
    );

    return user;
  }

  private userResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }
}

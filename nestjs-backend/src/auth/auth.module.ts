import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SsoUser } from './sso-user.entity';
import { JwtGuard } from './jwt.guard';
import { AuthController } from './auth.controller';
import { AuthCenterService } from './auth-center.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev_secret',
    }),
    TypeOrmModule.forFeature([User, SsoUser]),
  ],
  providers: [JwtGuard, AuthCenterService],
  controllers: [AuthController],
  exports: [JwtGuard, JwtModule],
})
export class AuthModule {}

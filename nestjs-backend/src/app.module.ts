import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';
import { BaccaratModule } from './baccarat/baccarat.module';
import { TranslateModule } from './translate/translate.module.js';
import { Post } from './posts/post.entity';
import { User } from './users/user.entity';
import { SsoUser } from './auth/sso-user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: parseInt(process.env.DB_PORT ?? '3306'),
      username: process.env.DB_USERNAME ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE ?? 'backend',
      entities: [User, Post, SsoUser],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([SsoUser]),
    AuthModule,
    PostsModule,
    UsersModule,
    BaccaratModule,
    TranslateModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}

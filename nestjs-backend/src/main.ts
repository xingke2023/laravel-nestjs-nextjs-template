import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // Disable NestJS built-in body parser so AdminJS formidable can read the stream
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.setGlobalPrefix('api', {
    // Exclude admin routes from the /api prefix
    exclude: ['/admin', '/admin/*path'],
  });

  // Re-add body parsing only for /api routes
  app.use('/api', bodyParser.json());
  app.use('/api', bodyParser.urlencoded({ extended: true }));

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
    exposedHeaders: ['X-Session-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = parseInt(process.env.PORT ?? '8068', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`NestJS backend running on http://0.0.0.0:${port}/api`);
  console.log(`AdminJS panel at http://0.0.0.0:${port}/admin`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
  });

  const port = Number(process.env.BACKEND_PORT ?? 4001);
  await app.listen(port, '0.0.0.0');

  console.log(`HRFlow backend running on http://localhost:${port}/graphql`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();

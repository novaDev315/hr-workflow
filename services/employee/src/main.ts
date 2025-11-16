import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  const port = process.env.SERVICE_PORT || 3001;
  await app.listen(port);

  console.log(`Employee Service running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}

bootstrap();

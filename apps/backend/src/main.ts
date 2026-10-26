import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import {
  formatValidationErrors,
  resolveAllowedOrigins,
  resolveJwtSecret,
} from './auth/runtime-config';

const JSON_BODY_LIMIT = '15mb';

async function bootstrap() {
  // Fail fast on unsafe configuration before any connection is opened.
  resolveJwtSecret(process.env.JWT_SECRET);
  const allowedOrigins = resolveAllowedOrigins(process.env.ALLOWED_ORIGINS);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  // Policy files are uploaded as base64 inside GraphQL JSON.
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

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
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(formatValidationErrors(errors)),
    }),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = Number(process.env.BACKEND_PORT ?? 4001);
  await app.listen(port, '0.0.0.0');

  console.log(`HRFlow backend running on http://localhost:${port}/graphql`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((error) => {
  console.error('HRFlow backend failed to start.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

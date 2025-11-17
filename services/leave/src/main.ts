import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.SERVICE_PORT || 3003;
  await app.listen(port, '0.0.0.0');

  console.log(`Leave Service running on http://localhost:${port}/graphql`);
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.SERVICE_PORT || 3007;
  await app.listen(port, '0.0.0.0');

  console.log(`Analytics Service running on http://localhost:${port}/graphql`);
}

bootstrap();

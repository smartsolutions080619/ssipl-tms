import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './app/common/filters/http-exception.filter';
import helmet from 'helmet';
import compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors();

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
  .setTitle('SSIPL TMS API')
  .setDescription('SSIPL Task Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 SSIPL TMS API running on: http://localhost:${port}/api/v1`);
console.log(`🔗 Swagger docs at: http://localhost:${port}/api/docs`);
}

bootstrap();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './app/common/filters/http-exception.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useWebSocketAdapter(new IoAdapter(app));

  // Helmet — disable crossOriginResourcePolicy so images load cross-origin
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(compression());

  // CORS — allow Netlify frontend
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Tenant-ID'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('SSIPL TMS API')
    .setDescription('SSIPL Task Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  // ── DB identity log ──
  // Prints exactly which physical database this running process is talking
  // to (no credentials). Compare this against whatever pgAdmin/Railway's
  // Query tab reports — if they don't match, the app and your manual
  // checks are hitting two different databases, which is the classic cause
  // of "I added the column and confirmed it exists, but the app still says
  // it doesn't."
  try {
    const dataSource = app.get(DataSource);
    const [identity] = await dataSource.query(
      `SELECT current_database() AS database, inet_server_addr()::text AS server_ip, current_setting('search_path') AS search_path`
    );
    console.log('🔎 DB identity (live app):', identity);
  } catch (err) {
    console.error('🔎 DB identity check failed:', (err as Error).message);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 SSIPL TMS API running on port ${port}`);
}

bootstrap();
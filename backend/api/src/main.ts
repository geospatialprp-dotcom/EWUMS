import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Survey imports (KML/SHP polygons) exceed the default 100kb JSON limit.
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.set('trust proxy', true);
  app.setGlobalPrefix(config.get('API_PREFIX', 'api/v1'));
  app.enableCors({
    origin: config.get('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Active-Division-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('EGIP API')
    .setDescription('Enterprise GIS Intelligence Platform REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`EGIP API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();

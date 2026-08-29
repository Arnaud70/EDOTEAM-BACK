import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateEnv } from './common/config/validate-env';

// Filet de sécurité : une erreur asynchrone isolée (ex. coupure momentanée de la base Neon)
// ne doit jamais arrêter le serveur.
process.on('unhandledRejection', (reason: any) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection] Le serveur continue de tourner :', reason?.message ?? reason);
});
process.on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException] Le serveur continue de tourner :', error?.message ?? error);
});

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  // Sécurité headers
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  // Cookie parser pour les refresh tokens
  app.use(cookieParser());

  // Compression des réponses HTTP (gzip) pour réduire la bande passante
  app.use(compression());

  // Serve static files from the uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // CORS pour le frontend : liste blanche explicite (aucun wildcard *.vercel.app avec credentials).
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const isProd = process.env.NODE_ENV === 'production';
  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(
    [
      frontendUrl,
      ...extraOrigins,
      ...(isProd
        ? []
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174']),
    ].filter(Boolean),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS bloqué pour: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filter et interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger : désactivé en production sauf si ENABLE_SWAGGER=true (évite d'exposer toute l'API).
  const swaggerEnabled = !isProd || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('EDOTEAM API')
      .setDescription('API de la plateforme de mise en relation EDOTEAM')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0'); // ← CRUCIAL pour Render

  console.log(`\n🚀 EDOTEAM API démarrée sur le port ${port}`);
  if (swaggerEnabled) console.log(`📚 Swagger UI: /api\n`);
}
bootstrap();
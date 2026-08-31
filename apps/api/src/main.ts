import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: 'http://localhost:5173' });
  // One global filter: every error response gets the contracted envelope.
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI reference built from the controllers' Swagger decorators.
  // The interactive UI is served at /api/docs; the raw JSON at /api/docs-json.
  const config = new DocumentBuilder()
    .setTitle('Staff Shift Scheduler API')
    .setDescription('Skills, employees, shifts, and schedule solves.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();

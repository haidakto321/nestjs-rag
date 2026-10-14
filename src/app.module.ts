import {
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AiModule } from './ai/ai.module.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AppExceptionFilter } from './common/filters/app-exception.filter.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { aiConfig, appConfig, authConfig, dbConfig, uploadConfig } from './config/app.config.js';
import { validateEnv } from './config/env.schema.js';
import { buildDataSourceOptions } from './database/typeorm-options.js';
import { DocumentsModule } from './documents/documents.module.js';
import { SearchModule } from './search/search.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, dbConfig, authConfig, aiConfig, uploadConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: (db: ConfigType<typeof dbConfig>) => ({
        ...buildDataSourceOptions(db),
        autoLoadEntities: true,
        // Pending migrations run at boot: one less manual step, and e2e tests get the schema.
        migrationsRun: true,
      }),
    }),
    AiModule.forRootAsync({
      isGlobal: true,
      inject: [aiConfig.KEY],
      useFactory: (ai: ConfigType<typeof aiConfig>) => ai,
    }),
    UsersModule,
    AuthModule,
    DocumentsModule,
    SearchModule,
    ChatModule,
    // Static files are served by Express directly, so the global JWT guard does not apply to them.
    ServeStaticModule.forRoot({ rootPath: join(import.meta.dirname, '..', 'public'), serveRoot: '/ui' }),
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    // APP_* providers are global but still built by DI, unlike app.useGlobalPipes(new ...).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
    // Registration order = nesting order: Timing wraps the serializer, so it measures it too.
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}

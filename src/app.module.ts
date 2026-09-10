import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DocumentModule } from './document/document.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MemoryModule } from './memory/memory.module';
import { ToolModule } from './tool/tool.module';

import { RequestIdMiddleware } from './common/request-id.middleware';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        return {
          type: 'postgres',

          host: configService.get<string>('DB_HOST'),

          port: Number(configService.get<string>('DB_PORT')),

          username: configService.get<string>('DB_USERNAME'),

          password: configService.get<string>('DB_PASSWORD'),

          database: configService.get<string>('DB_DATABASE'),

          autoLoadEntities: true,

          synchronize: true,
        };
      },
    }),

    DocumentModule,
    EmbeddingModule,
    KnowledgeModule,
    AuthModule,
    UserModule,
    MemoryModule,
    ToolModule,
    AiModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

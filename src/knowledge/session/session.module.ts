import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatSession } from '../entities/chat-session.entity';

import { SessionService } from './session.service';
import { SessionController } from './session.controller';

import { MemoryModule } from '../../memory/memory.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession]), MemoryModule],

  controllers: [SessionController],

  providers: [SessionService],

  exports: [SessionService],
})
export class SessionModule {}

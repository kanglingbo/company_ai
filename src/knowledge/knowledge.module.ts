import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

import { EmbeddingModule } from '../embedding/embedding.module';
import { DocumentModule } from '../document/document.module';
import { MemoryModule } from '../memory/memory.module';
import { ToolModule } from '../tool/tool.module';

import { ChatSession } from './entities/chat-session.entity';

import { SessionModule } from './session/session.module';
import { KnowledgeSearchService } from './knowledge-search.service';
import { DocumentChunk } from '../document/entities/document-chunk.entity';

@Module({
  imports: [
    EmbeddingModule,
    DocumentModule,
    MemoryModule,
    ToolModule,
    SessionModule,

    TypeOrmModule.forFeature([ChatSession, DocumentChunk]),
  ],

  controllers: [KnowledgeController],

  providers: [KnowledgeService, KnowledgeSearchService],
  exports: [KnowledgeSearchService],
})
export class KnowledgeModule {}

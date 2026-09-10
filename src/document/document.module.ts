import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { ChunkService } from './chunk/chunk.service';

import { EmbeddingModule } from '../embedding/embedding.module';

import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    EmbeddingModule,
  ],

  controllers: [DocumentController],

  providers: [DocumentService, ChunkService, KnowledgeSearchService],
  exports: [KnowledgeSearchService],
})
export class DocumentModule {}

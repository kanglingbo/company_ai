import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { LlmService } from './llm.service';

import { PromptService } from './prompt.service';

import { AiController } from './ai.controller';

import { EmbeddingModule } from '../embedding/embedding.module';

import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagService } from './rag.service';

@Module({
  imports: [ConfigModule, EmbeddingModule, KnowledgeModule],

  controllers: [AiController],

  providers: [LlmService, PromptService, RagService],

  exports: [LlmService, PromptService, RagService],
})
export class AiModule {}

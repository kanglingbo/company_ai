import { Injectable } from '@nestjs/common';

import { CompanyKnowledgeRetriever } from './knowledge-retriever';

import { EmbeddingService } from '../embedding/embedding.service';

import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';

import { LlmService } from './llm.service';

@Injectable()
export class RagService {
  constructor(
    private readonly embeddingService: EmbeddingService,

    private readonly knowledgeSearchService: KnowledgeSearchService,

    private readonly llmService: LlmService,
  ) {}

  async ask(question: string, department: string) {
    /**
     * 1. Retriever
     */
    const retriever = new CompanyKnowledgeRetriever(
      this.embeddingService,

      this.knowledgeSearchService,

      department,
    );

    /**
     * 2. Retrieval
     */
    const documents = await retriever.invoke(question);

    /**
     * 3. 将 Document 转成 Context
     */
    const context = documents
      .map((document) => document.pageContent)
      .join('\n\n');

    /**
     * 4. Prompt + Model
     */
    const answer = await this.llmService.chatWithContext(
      question,

      context,
    );

    return {
      answer,

      documents,
    };
  }
}

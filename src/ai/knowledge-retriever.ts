import { BaseRetriever } from '@langchain/core/retrievers';

import { Document } from '@langchain/core/documents';

import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';

import { EmbeddingService } from '../embedding/embedding.service';

import { CallbackManagerForRetrieverRun } from '@langchain/core/callbacks/manager';

export class CompanyKnowledgeRetriever extends BaseRetriever {
  lc_namespace = ['company_ai', 'retriever'];

  constructor(
    private readonly embeddingService: EmbeddingService,

    private readonly knowledgeSearchService: KnowledgeSearchService,

    private readonly department: string,
  ) {
    super();
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun,
  ): Promise<Document[]> {
    console.log('[LangChain Retriever] query =', JSON.stringify(query));

    if (typeof query !== 'string' || !query.trim()) {
      throw new Error(`Retriever query 为空: ${JSON.stringify(query)}`);
    }

    const queryEmbedding = await this.embeddingService.createEmbedding(query);

    const chunks = await this.knowledgeSearchService.search(
      queryEmbedding,
      5,
      this.department,
    );

    console.log('[LangChain Retriever] chunks =', chunks.length);

    return chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.content,

          metadata: {
            id: chunk.id,

            filename: chunk.filename,

            department: chunk.department,

            score: chunk.score,
          },
        }),
    );
  }
}

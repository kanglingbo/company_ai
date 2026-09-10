import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DocumentChunk } from '../document/entities/document-chunk.entity';

@Injectable()
export class KnowledgeSearchService {
  constructor(
    @InjectRepository(DocumentChunk)
    private readonly documentChunkRepository: Repository<DocumentChunk>,
  ) {}

  async search(
    queryEmbedding: number[],
    topK: number = 5,
    department?: string,
    minScore: number = 0.6,
  ) {
    const queryBuilder = this.documentChunkRepository
      .createQueryBuilder('chunk')
      .innerJoinAndSelect('chunk.document', 'document')
      .addSelect(
        'chunk.embedding <=> CAST(:queryEmbedding AS vector)',
        'distance',
      )
      .where('chunk.embedding IS NOT NULL')
      .setParameter('queryEmbedding', JSON.stringify(queryEmbedding));

    if (department) {
      queryBuilder.andWhere(
        '(document.department = :department OR document.department = :publicDepartment)',
        {
          department,
          publicDepartment: '公共',
        },
      );
    }

    const chunks = await queryBuilder
      .orderBy('distance', 'ASC')
      .limit(topK)
      .getMany();

    const results = chunks
      .map((chunk) => ({
        id: chunk.id,

        content: chunk.content,

        score: 1 - Number(chunk['distance']),

        filename: chunk.document?.filename,

        department: chunk.document?.department,
      }))
      .filter((chunk) => chunk.score >= minScore);

    return results;
  }
}

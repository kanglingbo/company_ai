import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { PDFParse } from 'pdf-parse';

import { ChunkService } from './chunk/chunk.service';

import { EmbeddingService } from '../embedding/embedding.service';

import { Document } from './entities/document.entity';

import { DocumentChunk } from './entities/document-chunk.entity';

interface UploadedPdfFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly chunkService: ChunkService,

    private readonly embeddingService: EmbeddingService,

    private readonly dataSource: DataSource,

    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    @InjectRepository(DocumentChunk)
    private readonly documentChunkRepository: Repository<DocumentChunk>,
  ) {}

  async processPdf(file: UploadedPdfFile, department: string) {
    // =========================
    // 1. 基础校验
    // =========================

    if (!file) {
      throw new BadRequestException('请上传 PDF 文件');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('上传的 PDF 文件为空');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('只支持 PDF 文件');
    }

    // =========================
    // 2. 解析 PDF
    // =========================

    const parser = new PDFParse({
      data: file.buffer,
    });

    let result;

    try {
      result = await parser.getText();
    } finally {
      await parser.destroy();
    }

    if (!result.text || result.text.trim().length === 0) {
      throw new BadRequestException('PDF 中没有可提取的文本内容');
    }

    // =========================
    // 3. 文本切分
    // =========================

    const chunks = this.chunkService.splitText(result.text);

    if (chunks.length === 0) {
      throw new BadRequestException('PDF 文本切分后没有有效内容');
    }

    console.log('Chunk 数量：', chunks.length);

    // =========================
    // 4. 数据库事务
    // =========================

    return this.dataSource.transaction(async (manager) => {
      // =========================
      // 5. 创建 Document
      // =========================

      const document = manager.create(Document, {
        filename: file.originalname,

        mimeType: file.mimetype,

        department,
      });

      const savedDocument = await manager.save(Document, document);

      console.log('Document 保存成功：', savedDocument.id);

      // =========================
      // 6. Chunk + Embedding
      // =========================

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        console.log(`正在处理 Chunk ${i + 1}/${chunks.length}`);

        // Embedding API
        const embedding = await this.embeddingService.createEmbedding(chunk);

        // 创建 DocumentChunk
        const documentChunk = manager.create(DocumentChunk, {
          document: savedDocument,

          chunkIndex: i,

          content: chunk,

          embedding,
        });

        // 保存 DocumentChunk
        await manager.save(DocumentChunk, documentChunk);
      }

      console.log('Document + Chunk 全部保存成功');

      // =========================
      // 7. 事务提交后的返回值
      // =========================

      return {
        documentId: savedDocument.id,

        filename: savedDocument.filename,

        textLength: result.text.length,

        chunkCount: chunks.length,
      };
    });
  }

  // =========================
  // 查询所有文档
  // =========================

  async findAll(department?: string) {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .orderBy('document.createdAt', 'DESC');

    if (department) {
      queryBuilder.where(
        '(document.department = :department OR document.department = :publicDepartment)',
        {
          department,
          publicDepartment: '公共',
        },
      );
    }

    return queryBuilder.getMany();
  }

  // =========================
  // 查询单个文档
  // =========================

  async findOne(id: number, department?: string) {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.id = :id', { id });

    if (department) {
      queryBuilder.andWhere(
        '(document.department = :department OR document.department = :publicDepartment)',
        {
          department,
          publicDepartment: '公共',
        },
      );
    }

    const document = await queryBuilder.getOne();

    if (!document) {
      throw new NotFoundException('文档不存在或无权访问');
    }

    return document;
  }

  // =========================
  // 删除文档
  // =========================

  async remove(id: number) {
    const document = await this.documentRepository.findOne({
      where: {
        id,
      },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    await this.documentRepository.remove(document);

    return {
      success: true,

      message: '文档删除成功',

      documentId: id,
    };
  }
}

import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Document } from '../document/entities/document.entity';

@Injectable()
export class ToolService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async getReimbursementPolicy(department: string) {
    const documents = await this.documentRepository
      .createQueryBuilder('document')
      .where(
        '(document.department = :department OR document.department = :publicDepartment)',
        {
          department,
          publicDepartment: '公共',
        },
      )
      .andWhere('document.filename LIKE :filename', {
        filename: '%财务%',
      })
      .orderBy('document.createdAt', 'DESC')
      .getMany();

    return {
      success: true,
      data: documents.map((document) => ({
        id: document.id,
        filename: document.filename,
        department: document.department,
      })),
    };
  }
}

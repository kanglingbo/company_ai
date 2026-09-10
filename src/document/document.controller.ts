import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import type { Request } from 'express';

import { DocumentService } from './document.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';

import { UploadDto } from './dto/upload.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    role: Role;
    department: string;
  };
}

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly embeddingService: EmbeddingService,
    private readonly knowledgeSearchService: KnowledgeSearchService,
  ) {}

  // =========================
  // 上传文档
  // employee / manager / admin
  // =========================

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @Req() req: AuthenticatedRequest,

    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },

    @Body()
    body: UploadDto,
  ) {
    let department: string;

    // admin 可以指定部门
    if (req.user.role === Role.ADMIN) {
      department = body.department || '公共';
    } else {
      // employee / manager
      // 只能上传到自己的部门
      department = req.user.department;
    }

    return this.documentService.processPdf(file, department);
  }

  // =========================
  // 向量搜索
  // =========================

  @Post('search')
  async search(
    @Req() req: AuthenticatedRequest,

    @Body()
    body: {
      question: string;
    },
  ) {
    const embedding = await this.embeddingService.createEmbedding(
      body.question,
    );

    return this.knowledgeSearchService.search(
      embedding,
      5,
      req.user.department,
    );
  }

  // =========================
  // 文档列表
  // =========================

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.documentService.findAll(req.user.department);
  }

  // =========================
  // 文档详情
  // =========================

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.documentService.findOne(id, req.user.department);
  }

  // =========================
  // 删除文档
  // manager / admin
  // =========================

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async remove(
    @Req() req: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    const document = await this.documentService.findOne(
      id,
      req.user.department,
    );

    // manager 不能删除公共文档
    if (req.user.role === Role.MANAGER && document.department === '公共') {
      throw new ForbiddenException('部门负责人不能删除公共文档');
    }

    return this.documentService.remove(id);
  }
}

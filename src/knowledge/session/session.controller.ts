import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

import { SessionService } from './session.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    role: string;
    department: string;
  };
}

@Controller('knowledge/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  // =========================
  // 创建会话
  // =========================

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      title?: string;
    },
  ) {
    return this.sessionService.create(req.user.id, body.title);
  }

  // =========================
  // 查询当前用户的会话列表
  // =========================

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.sessionService.findAll(req.user.id);
  }

  // =========================
  // 查询当前用户的单个会话
  // =========================

  @Get(':sessionId')
  async findOne(
    @Req() req: AuthenticatedRequest,

    @Param('sessionId')
    sessionId: string,
  ) {
    return this.sessionService.findOne(req.user.id, sessionId);
  }

  // =========================
  // 删除会话
  // =========================

  @Delete(':sessionId')
  async remove(
    @Req() req: AuthenticatedRequest,

    @Param('sessionId')
    sessionId: string,
  ) {
    return this.sessionService.remove(req.user.id, sessionId);
  }
}

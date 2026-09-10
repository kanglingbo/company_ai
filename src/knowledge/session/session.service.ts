import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ChatSession } from '../entities/chat-session.entity';

import { MemoryService } from '../../memory/memory.service';
import { randomUUID } from 'crypto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepository: Repository<ChatSession>,

    private readonly memoryService: MemoryService,
  ) {}

  // =========================
  // 创建会话
  // =========================

  async create(userId: number, title?: string) {
    const sessionId = crypto.randomUUID();

    const session = this.sessionRepository.create({
      sessionId,
      userId,
      title: title?.trim() || '新会话',
    });

    return this.sessionRepository.save(session);
  }

  // =========================
  // 查询当前用户的会话列表
  // =========================

  async findAll(userId: number) {
    return this.sessionRepository.find({
      where: {
        userId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // =========================
  // 查询当前用户的单个会话
  // =========================

  async findOne(userId: number, sessionId: string) {
    const session = await this.sessionRepository.findOne({
      where: {
        userId,
        sessionId,
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在或无权访问');
    }

    return session;
  }

  // =========================
  // 删除会话
  // =========================

  async remove(userId: number, sessionId: string) {
    const session = await this.findOne(userId, sessionId);

    await this.sessionRepository.remove(session);

    // 同时删除 Redis 中的聊天记录
    await this.memoryService.clear(userId, sessionId);

    return {
      success: true,
      message: '会话删除成功',
      sessionId,
    };
  }
}

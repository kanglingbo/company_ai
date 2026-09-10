import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';

import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';
import { ChatDto } from './dto/chat.dto';
import { SessionService } from './session/session.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    role: string;
    department: string;
  };
}

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('chat')
  async chat(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Body() body: ChatDto,
  ) {
    // =========================
    // 1. 验证 Session
    // =========================

    await this.sessionService.findOne(req.user.id, body.sessionId);

    // =========================
    // 2. SSE
    // =========================

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');

    res.setHeader('Cache-Control', 'no-cache');

    res.setHeader('Connection', 'keep-alive');

    // =========================
    // 3. 执行 AI Stream
    // =========================

    await this.knowledgeService.askStream(
      body.question,
      req.user.department,
      req.user.id,
      body.sessionId,
      (text) => {
        res.write(
          `data: ${JSON.stringify({
            type: 'content',
            content: text,
          })}\n\n`,
        );
      },
    );

    // =========================
    // 4. 结束
    // =========================

    res.write(
      `data: ${JSON.stringify({
        type: 'done',
      })}\n\n`,
    );

    res.end();
  }
}

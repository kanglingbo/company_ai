import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { RagService } from './rag.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { Role } from '../auth/role.enum';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    role: Role;
    department: string;
  };
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ragService: RagService) {}

  @Post('rag')
  async rag(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    body: {
      question: string;
    },
  ) {
    const result = await this.ragService.ask(
      body.question,
      req.user.department,
    );

    return {
      success: true,

      answer: result.answer,

      sources: result.documents.map((document) => document.metadata),
    };
  }
}

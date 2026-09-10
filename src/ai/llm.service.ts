import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { ChatOpenAI } from '@langchain/openai';

import { PromptService } from './prompt.service';

@Injectable()
export class LlmService {
  private readonly model: ChatOpenAI;

  constructor(
    private readonly configService: ConfigService,

    private readonly promptService: PromptService,
  ) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    this.model = new ChatOpenAI({
      model: 'deepseek-v4-flash',

      temperature: 0,

      apiKey,

      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    });
  }

  /**
   * 普通聊天
   */
  async chat(question: string) {
    const messages = await this.promptService.format(question, '');

    const response = await this.model.invoke(messages);

    return response.content;
  }

  /**
   * RAG
   */
  async chatWithContext(question: string, context: string) {
    const messages = await this.promptService.format(question, context);

    const response = await this.model.invoke(messages);

    return response.content;
  }

  /**
   * 暴露 Chat Model
   *
   * 后续 LangChain Agent
   * 可以直接复用。
   */
  getModel() {
    return this.model;
  }
}

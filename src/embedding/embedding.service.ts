import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BAILIAN_API_KEY');

    if (!apiKey) {
      throw new Error('BAILIAN_API_KEY 未配置');
    }

    this.client = new OpenAI({
      apiKey,

      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

      // 30 秒超时
      timeout: 30000,
    });
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error(`Embedding 输入文本为空: ${JSON.stringify(text)}`);
    }

    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // =========================
        // 1. 调用 Embedding API
        // =========================

        const response = await this.client.embeddings.create({
          model: 'text-embedding-v4',
          input: text,
        });

        const embedding = response.data[0]?.embedding;

        if (!embedding) {
          throw new Error('Embedding API 未返回向量数据');
        }

        console.log('Embedding 维度：', embedding.length);

        return embedding;
      } catch (error: any) {
        const status = error?.status;

        console.error(`Embedding 请求失败，第 ${attempt + 1} 次`, {
          status,
          message: error?.message,
        });

        // =========================
        // 2. 判断是否应该重试
        // =========================

        const retryable =
          !status || status === 408 || status === 429 || status >= 500;

        // =========================
        // 3. 不可重试
        // =========================

        if (!retryable) {
          throw error;
        }

        // =========================
        // 4. 达到最大重试次数
        // =========================

        if (attempt === maxRetries) {
          throw error;
        }

        // =========================
        // 5. 指数退避
        // =========================

        const delay = 1000 * Math.pow(2, attempt);

        console.log(`Embedding 将在 ${delay}ms 后重试`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Embedding 请求失败');
  }
}

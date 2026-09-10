import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class MemoryService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    });
  }

  private getKey(userId: number, sessionId: string) {
    return `chat:memory:${userId}:${sessionId}`;
  }

  async addMessage(
    userId: number,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    const key = this.getKey(userId, sessionId);

    await this.redis.rpush(
      key,
      JSON.stringify({
        role,
        content,
      }),
    );

    await this.redis.ltrim(key, -20, -1);

    await this.redis.expire(key, 60 * 60 * 24 * 30);
  }

  async getMessages(userId: number, sessionId: string) {
    const key = this.getKey(userId, sessionId);

    const messages = await this.redis.lrange(key, 0, -1);

    return messages.map((item) => JSON.parse(item));
  }

  async clear(userId: number, sessionId: string) {
    const key = this.getKey(userId, sessionId);

    await this.redis.del(key);
  }
}

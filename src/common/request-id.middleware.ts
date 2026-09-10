import { Injectable, NestMiddleware } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    /**
     * 优先使用客户端传递的 requestId
     *
     * 这样方便后续：
     * 网关 -> NestJS -> AI服务
     * 进行全链路追踪。
     */
    const requestId = req.headers['x-request-id'] ?? randomUUID();

    /**
     * Express Header 类型可能是：
     *
     * string | string[] | undefined
     *
     * 我们这里只需要字符串。
     */
    const requestIdString = Array.isArray(requestId) ? requestId[0] : requestId;

    /**
     * 保存到 request
     */
    (
      req as Request & {
        requestId: string;
      }
    ).requestId = requestIdString;

    /**
     * 返回给客户端
     */
    res.setHeader('X-Request-Id', requestIdString);

    next();
  }
}

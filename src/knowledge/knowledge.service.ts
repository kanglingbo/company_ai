import { Injectable, Logger } from '@nestjs/common';

import OpenAI from 'openai';

import { ConfigService } from '@nestjs/config';

import { EmbeddingService } from '../embedding/embedding.service';

import { KnowledgeSearchService } from './knowledge-search.service';

import { MemoryService } from '../memory/memory.service';

import { ToolService } from '../tool/tool.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  private readonly client: OpenAI;

  /**
   * 最多保留多少条历史消息
   *
   * 一轮对话：
   * user + assistant = 2 条
   *
   * 10 条 ≈ 5 轮对话
   */
  private readonly maxHistoryMessages = 10;

  /**
   * RAG Context 最大字符数
   *
   * 防止一次检索大量内容导致：
   * 1. Prompt 过长
   * 2. LLM 延迟增加
   * 3. Token 成本增加
   */
  private readonly maxContextLength = 8000;

  /**
   * 向量检索最多返回多少个 Chunk
   */
  private readonly topK = 5;

  constructor(
    private readonly configService: ConfigService,

    private readonly embeddingService: EmbeddingService,

    private readonly knowledgeSearchService: KnowledgeSearchService,

    private readonly memoryService: MemoryService,

    private readonly toolService: ToolService,
  ) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    this.client = new OpenAI({
      apiKey,

      baseURL: 'https://api.deepseek.com',

      timeout: 30000,
    });
  }

  /**
   * ================================
   * 构建 RAG Context
   * ================================
   */
  private async buildRagContext(
    question: string,

    department: string,

    userId: number,

    sessionId: string,
  ) {
    const startTime = Date.now();

    /**
     * 1. 获取历史消息
     */
    const history = await this.memoryService.getMessages(userId, sessionId);

    /**
     * 只保留最近 N 条消息
     */
    const limitedHistory = history.slice(-this.maxHistoryMessages);

    /**
     * 2. Query Embedding
     */
    const embeddingStart = Date.now();

    const queryEmbedding =
      await this.embeddingService.createEmbedding(question);

    const embeddingTime = Date.now() - embeddingStart;

    /**
     * 3. 向量检索
     */
    const searchStart = Date.now();

    const chunks = await this.knowledgeSearchService.search(
      queryEmbedding,

      this.topK,

      department,
    );

    const searchTime = Date.now() - searchStart;

    this.logger.log(
      `RAG检索完成 | ` +
        `embedding=${embeddingTime}ms | ` +
        `search=${searchTime}ms | ` +
        `chunks=${chunks.length}`,
    );

    /**
     * 4. 没有检索到知识
     */
    if (!chunks || chunks.length === 0) {
      const totalTime = Date.now() - startTime;

      this.logger.warn(`RAG未找到相关知识 | ` + `total=${totalTime}ms`);

      return {
        history: limitedHistory,

        chunks: [],

        context: '',

        hasContext: false,
      };
    }

    /**
     * 5. 构建 Context
     *
     * 控制最大长度，
     * 防止 Prompt 无限增长。
     */
    let context = '';

    for (const chunk of chunks) {
      const filename = chunk.filename ?? '未知文档';

      const departmentName = chunk.department ?? '未知部门';

      const content = chunk.content ?? '';

      const block =
        `【文档：${filename}】\n` +
        `【部门：${departmentName}】\n` +
        `${content}\n\n`;

      if (context.length + block.length > this.maxContextLength) {
        break;
      }

      context += block;
    }

    const totalTime = Date.now() - startTime;

    this.logger.log(
      `RAG Context构建完成 | ` +
        `total=${totalTime}ms | ` +
        `history=${limitedHistory.length} | ` +
        `chunks=${chunks.length} | ` +
        `context=${context.length} chars`,
    );

    return {
      history: limitedHistory,

      chunks,

      context,

      hasContext: context.length > 0,
    };
  }

  /**
   * ================================
   * LLM 调用 + Retry
   * ================================
   */
  private async createChatCompletionWithRetry(
    messages: any[],

    tools?: any[],
  ) {
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        const response = await this.client.chat.completions.create({
          model: 'deepseek-v4-flash',

          messages,

          ...(tools
            ? {
                tools,
                tool_choice: 'auto',
              }
            : {}),
        });

        const elapsed = Date.now() - startTime;

        this.logger.log(
          `LLM调用成功 | ` +
            `attempt=${attempt + 1} | ` +
            `elapsed=${elapsed}ms`,
        );

        return response;
      } catch (error: any) {
        const status = error?.status;

        const shouldRetry =
          !status || status === 408 || status === 429 || status >= 500;

        this.logger.warn(
          `LLM调用失败 | ` +
            `attempt=${attempt + 1} | ` +
            `status=${status ?? 'unknown'} | ` +
            `retry=${shouldRetry}`,
        );

        /**
         * 不需要 Retry
         *
         * 例如：
         * 400
         * 401
         * 403
         */
        if (!shouldRetry || attempt >= maxRetries) {
          throw error;
        }

        /**
         * 指数退避：
         *
         * 第一次：1 秒
         * 第二次：2 秒
         * 第三次：4 秒
         */
        const delay = 1000 * Math.pow(2, attempt);

        this.logger.warn(`等待 ${delay}ms 后重试 LLM`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('LLM调用失败');
  }

  /**
   * ================================
   * 普通问答
   * ================================
   */
  async ask(
    question: string,

    department: string,

    userId: number,

    sessionId: string,
  ) {
    const requestStart = Date.now();

    /**
     * 1. 构建 RAG Context
     */
    const rag = await this.buildRagContext(
      question,

      department,

      userId,

      sessionId,
    );

    /**
     * 2. 没有知识库内容
     */
    if (!rag.hasContext) {
      const answer = '知识库中暂未找到与该问题相关的信息。';

      await this.memoryService.addMessage(userId, sessionId, 'user', question);

      await this.memoryService.addMessage(
        userId,
        sessionId,
        'assistant',
        answer,
      );

      this.logger.warn(
        `知识库无结果 | ` + `total=${Date.now() - requestStart}ms`,
      );

      return {
        answer,

        sources: [],
      };
    }

    /**
     * 3. 定义 Tool
     *
     * 当前只保留一个：
     * getReimbursementPolicy
     */
    const tools = [
      {
        type: 'function',

        function: {
          name: 'getReimbursementPolicy',

          description: '查询当前登录用户有权限访问的公司报销制度和报销标准',

          parameters: {
            type: 'object',

            properties: {},

            required: [],
          },
        },
      },
    ];

    /**
     * 4. 构建 System Prompt
     */
    const systemPrompt = `

你是公司内部 AI 知识库助手。

你的回答必须遵守以下规则：

1. 优先使用公司知识库中的信息。
2. 不允许编造公司制度、流程、金额、政策。
3. 如果知识库中没有相关信息，应明确说明。
4. 可以结合用户历史对话理解上下文。
5. 当前用户所在部门为：${department}
6. 用户只能访问自己部门和“公共”知识。
7. 当用户询问报销制度、报销标准等问题时，可以使用 getReimbursementPolicy 工具。
8. 工具返回的信息也属于可信的公司内部数据。
9. 回答要直接、清晰、准确。
10. 不要输出与问题无关的信息。

`;

    /**
     * 5. 构建 Messages
     */
    const messages: any[] = [
      {
        role: 'system',

        content: systemPrompt,
      },
    ];

    /**
     * 6. 添加历史消息
     */
    for (const message of rag.history) {
      messages.push({
        role: message.role,

        content: message.content,
      });
    }

    /**
     * 7. 添加 RAG Context
     */
    messages.push({
      role: 'system',

      content: `以下是知识库检索结果：

${rag.context}`,
    });

    /**
     * 8. 当前用户问题
     */
    messages.push({
      role: 'user',

      content: question,
    });

    /**
     * 9. Agent Loop
     *
     * 最大执行 3 次
     */
    const maxToolLoops = 3;

    for (let loop = 0; loop < maxToolLoops; loop++) {
      this.logger.log(`Agent Loop | loop=${loop + 1}`);

      const response = await this.createChatCompletionWithRetry(
        messages,

        tools,
      );

      const assistantMessage = response.choices?.[0]?.message;

      if (!assistantMessage) {
        throw new Error('LLM未返回有效消息');
      }

      /**
       * 没有 Tool Call
       *
       * 直接返回最终答案。
       */
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        const answer =
          assistantMessage.content ?? '抱歉，我暂时无法回答这个问题。';

        /**
         * 保存用户消息
         */
        await this.memoryService.addMessage(
          userId,

          sessionId,

          'user',

          question,
        );

        /**
         * 保存 AI 消息
         */
        await this.memoryService.addMessage(
          userId,

          sessionId,

          'assistant',

          answer,
        );

        const totalTime = Date.now() - requestStart;

        this.logger.log(`AI问答完成 | ` + `total=${totalTime}ms`);

        return {
          answer,

          sources: rag.chunks.map((chunk) => ({
            id: chunk.id,

            filename: chunk.filename,

            department: chunk.department,

            score: chunk.score,
          })),
        };
      }

      /**
       * 处理 Tool Calls
       */
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        /**
         * 只处理 function 类型
         */
        if (toolCall.type !== 'function') {
          continue;
        }

        const toolName = toolCall.function.name;

        this.logger.log(`Tool调用 | name=${toolName}`);

        let toolResult;

        /**
         * 报销政策 Tool
         */
        if (toolName === 'getReimbursementPolicy') {
          toolResult =
            await this.toolService.getReimbursementPolicy(department);
        } else {
          toolResult = {
            success: false,

            message: `未知工具：${toolName}`,
          };
        }

        /**
         * Tool 返回结果
         */
        messages.push({
          role: 'tool',

          tool_call_id: toolCall.id,

          content: JSON.stringify(toolResult),
        });
      }
    }

    throw new Error('Agent Tool 调用超过最大次数');
  }

  /**
   * ================================
   * SSE 流式问答
   * ================================
   */
  async askStream(
    question: string,

    department: string,

    userId: number,

    sessionId: string,

    onToken: (token: string) => void,
  ) {
    const requestStart = Date.now();

    /**
     * 1. RAG
     */
    const rag = await this.buildRagContext(
      question,

      department,

      userId,

      sessionId,
    );

    /**
     * 2. 没找到知识
     */
    if (!rag.hasContext) {
      const answer = '知识库中暂未找到与该问题相关的信息。';

      onToken(answer);

      await this.memoryService.addMessage(
        userId,

        sessionId,

        'user',

        question,
      );

      await this.memoryService.addMessage(
        userId,

        sessionId,

        'assistant',

        answer,
      );

      this.logger.warn(
        `SSE知识库无结果 | ` + `total=${Date.now() - requestStart}ms`,
      );

      return;
    }

    /**
     * 3. System Prompt
     */
    const systemPrompt = `

你是公司内部 AI 知识库助手。

你的回答必须遵守以下规则：

1. 优先使用公司知识库中的信息。
2. 不允许编造公司制度、流程、金额、政策。
3. 如果知识库中没有相关信息，应明确说明。
4. 可以结合用户历史对话理解上下文。
5. 当前用户所在部门为：${department}
6. 用户只能访问自己部门和“公共”知识。
7. 回答必须基于提供的知识库内容。
8. 回答要直接、清晰、准确。

`;

    /**
     * 4. Messages
     */
    const messages: any[] = [
      {
        role: 'system',

        content: systemPrompt,
      },
    ];

    /**
     * 5. 历史消息
     */
    for (const message of rag.history) {
      messages.push({
        role: message.role,

        content: message.content,
      });
    }

    /**
     * 6. RAG Context
     */
    messages.push({
      role: 'system',

      content: `以下是知识库检索结果：

${rag.context}`,
    });

    /**
     * 7. 用户问题
     */
    messages.push({
      role: 'user',

      content: question,
    });

    /**
     * 8. Streaming LLM
     *
     * 当前 SSE 暂不接 Tool Calling，
     * 保持流式链路简单。
     */
    const stream = await this.client.chat.completions.create({
      model: 'deepseek-v4-flash',

      messages,

      stream: true,
    });

    let fullAnswer = '';

    /**
     * 9. 接收 Token
     */
    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content;

      if (!token) {
        continue;
      }

      fullAnswer += token;

      onToken(token);
    }

    /**
     * 10. 保存记忆
     */
    await this.memoryService.addMessage(
      userId,

      sessionId,

      'user',

      question,
    );

    await this.memoryService.addMessage(
      userId,

      sessionId,

      'assistant',

      fullAnswer,
    );

    const totalTime = Date.now() - requestStart;

    this.logger.log(
      `SSE问答完成 | ` +
        `total=${totalTime}ms | ` +
        `answer=${fullAnswer.length} chars`,
    );
  }
}

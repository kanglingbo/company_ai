import { Injectable } from '@nestjs/common';

import { ChatPromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class PromptService {
  private readonly prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `
你是一个企业内部 AI 助手。

请遵守以下规则：

1. 优先根据提供的知识库内容回答。
2. 不允许编造不存在的信息。
3. 如果知识库没有相关信息，要明确说明。
4. 回答要准确、简洁、易懂。
`,
    ],

    [
      'human',
      `
知识库内容：

{context}

用户问题：

{question}
`,
    ],
  ]);

  async format(question: string, context: string) {
    return this.prompt.formatMessages({
      question,
      context,
    });
  }
}

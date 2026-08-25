import { eq } from 'drizzle-orm';
import type { PoemPayload, WordPayload } from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { aiSettings } from '../db/schema.js';
import { decryptSecret } from '../lib/crypto.js';

type AiTeachingResponse = {
  summary: string;
  keyPoints: string[];
  practice: {
    question: string;
    answer: string;
  };
};

async function configuredClient() {
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1)).limit(1);
  if (!settings?.encryptedApiKey) {
    return null;
  }
  return {
    baseUrl: settings.baseUrl.replace(/\/$/, ''),
    model: settings.model,
    apiKey: decryptSecret(settings.encryptedApiKey),
  };
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? value) as AiTeachingResponse;
}

export async function generateTeachingResponse(input: {
  kind: 'word' | 'poem';
  payload: WordPayload | PoemPayload;
  mastery: number;
  previousAnswer: string;
  prompt: string;
}) {
  const client = await configuredClient();
  if (!client) {
    return null;
  }
  const response = await fetch(`${client.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${client.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是面向中国高中生的学习教练。只基于提供的教材内容讲解，目标是考试得分、延迟回忆和长期记忆。不要虚构教材出处。输出 JSON：summary 字符串，keyPoints 字符串数组，practice 包含 question 和 answer。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: input.prompt || '解释错误并生成一道同知识点变式题',
            kind: input.kind,
            content: input.payload,
            currentMastery: input.mastery,
            previousAnswer: input.previousAnswer,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}.`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }
  const parsed = extractJson(content);
  if (
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.keyPoints) ||
    typeof parsed.practice?.question !== 'string' ||
    typeof parsed.practice?.answer !== 'string'
  ) {
    throw new Error('AI provider returned an invalid response shape.');
  }
  return parsed;
}

export async function testAiConnection(input: { baseUrl: string; model: string; apiKey: string }) {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: 'user', content: '仅回复 OK' }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`连接失败（${response.status}）：${detail}`);
  }
  return true;
}

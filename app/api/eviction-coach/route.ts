import {
  analyzeEvictionWithClaude,
  CLAUDE_MODEL,
} from '@/lib/llm/evictionClaude';
import type { EvictionLlmResult } from '@/lib/llm/evictionPrompt';
import type { EvictionModelResult } from '@/types/case';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function runOne(
  fn: () => Promise<EvictionLlmResult>,
): Promise<EvictionModelResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      model: CLAUDE_MODEL,
      label: 'AI 명도코칭',
      ...result,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      model: CLAUDE_MODEL,
      label: 'AI 명도코칭',
      crisisFlag: false,
      crisisNote: null,
      resistLevel: 'mid',
      situationSummary: '',
      replyDrafts: [
        { tone: '차분한 톤', message: '' },
        { tone: '단호한 톤', message: '' },
      ],
      nextActions: [],
      speakerClarity: 'clear',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : '알 수 없는 오류',
    };
  }
}

function ndjsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: Request) {
  let body: { conversation?: string };
  try {
    body = (await req.json()) as { conversation?: string };
  } catch {
    return new Response(
      JSON.stringify({ type: 'error', error: '요청 본문이 올바르지 않습니다.' }) +
        '\n',
      {
        status: 400,
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      },
    );
  }

  const conversation = (body.conversation ?? '').trim().slice(0, 40_000);
  if (!conversation) {
    return new Response(
      JSON.stringify({ type: 'error', error: '대화 내용을 붙여넣어 주세요.' }) +
        '\n',
      {
        status: 400,
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(ndjsonLine(obj));
      };

      try {
        const result = await runOne(() =>
          analyzeEvictionWithClaude(conversation),
        );
        send({ type: 'result', result });
        send({ type: 'done', analyzedAt: new Date().toISOString() });
      } catch (err) {
        send({
          type: 'error',
          error:
            err instanceof Error
              ? err.message
              : '명도코칭 분석 중 서버 오류가 발생했습니다.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

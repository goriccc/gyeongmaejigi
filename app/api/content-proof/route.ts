import { NextResponse } from 'next/server';
import {
  draftContentProofWithClaude,
  CLAUDE_MODEL,
} from '@/lib/llm/contentProofClaude';
import type { ContentProofDraft } from '@/lib/llm/contentProofPrompt';

export const runtime = 'nodejs';
export const maxDuration = 120;

export type ContentProofModelResult = ContentProofDraft & {
  model: 'claude-opus-5' | 'deepseek-v4-pro';
  label: string;
  latencyMs?: number;
  error?: string;
};

async function runOne(
  fn: () => Promise<ContentProofDraft>,
): Promise<ContentProofModelResult> {
  const started = Date.now();
  try {
    const draft = await fn();
    return {
      model: CLAUDE_MODEL,
      label: 'AI 내용증명',
      ...draft,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      model: CLAUDE_MODEL,
      label: 'AI 내용증명',
      title: '',
      body: '',
      caution: '',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : '알 수 없는 오류',
    };
  }
}

export async function POST(req: Request) {
  let body: { conversation?: string };
  try {
    body = (await req.json()) as { conversation?: string };
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  const conversation = (body.conversation ?? '').trim().slice(0, 40_000);
  if (!conversation) {
    return NextResponse.json(
      { error: '대화 내용을 붙여넣어 주세요.' },
      { status: 400 },
    );
  }

  try {
    const result = await runOne(() =>
      draftContentProofWithClaude(conversation),
    );

    return NextResponse.json({
      result,
      /** 하위 호환: 기존 UI 필드 */
      claude: result,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : '내용증명 초안 작성 중 서버 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}

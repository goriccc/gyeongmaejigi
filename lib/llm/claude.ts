import {
  RIGHTS_SYSTEM_PROMPT,
  buildRightsUserPrompt,
  parseRightsAnalysisJson,
  type ParsedRightsAnalysis,
  type RightsLlmPayload,
} from './rightsPrompt';
import { fetchWithTimeout, LLM_TIMEOUT_MS } from './fetchTimeout';

const CLAUDE_MODEL = 'claude-opus-5';

type ClaudeContent =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: {
        type: 'base64';
        media_type: 'application/pdf';
        data: string;
      };
    };

/**
 * Claude Opus 5는 temperature 비기본값을 거부합니다(400).
 * 권리분석의 낮은 창의성은 effort: medium + thinking disabled로 근사합니다.
 */
export async function analyzeWithClaude(
  payload: RightsLlmPayload,
): Promise<ParsedRightsAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  }

  const content: ClaudeContent[] = [];

  for (const pdf of payload.pdfs ?? []) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdf.base64,
      },
    });
  }

  content.push({
    type: 'text',
    text: buildRightsUserPrompt(payload),
  });

  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        // temperature 사용 불가 → effort로 보수적 분석
        thinking: { type: 'disabled' },
        output_config: { effort: 'medium' },
        system: RIGHTS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    },
    LLM_TIMEOUT_MS,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Claude API 오류 (${res.status}): ${errText.slice(0, 280) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text)
    .join('\n');

  if (!text) {
    throw new Error('Claude 응답에 텍스트가 없습니다.');
  }

  return parseRightsAnalysisJson(text, payload.judgment);
}

export { CLAUDE_MODEL };

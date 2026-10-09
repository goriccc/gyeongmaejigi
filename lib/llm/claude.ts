import {
  RIGHTS_SYSTEM_PROMPT,
  buildRightsUserPrompt,
  parseRightsAnalysisJson,
  type ParsedRightsAnalysis,
  type RightsLlmPayload,
} from './rightsPrompt';
import { fetchWithTimeout, RIGHTS_LLM_TIMEOUT_MS } from './fetchTimeout';

const CLAUDE_MODEL = 'claude-sonnet-5-5';

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
 * Claude Sonnet 5.5는 temperature 비기본값을 거부합니다(400).
 * 권리분석은 adaptive thinking + effort high로 실행합니다.
 * thinking 토큰이 max_tokens에 포함되므로 응답 JSON보다 여유 있게 잡습니다.
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
        max_tokens: 16384,
        output_config: { effort: 'high' },
        system: RIGHTS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    },
    RIGHTS_LLM_TIMEOUT_MS,
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

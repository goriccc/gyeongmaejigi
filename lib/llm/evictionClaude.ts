import {
  EVICTION_SYSTEM_PROMPT,
  buildEvictionUserPrompt,
  parseEvictionJson,
  type EvictionLlmResult,
} from './evictionPrompt';
import { fetchWithTimeout, LLM_TIMEOUT_MS } from './fetchTimeout';

const CLAUDE_MODEL = 'claude-sonnet-5';

/**
 * Claude Sonnet 5는 temperature 비기본값을 거부합니다(400).
 * 명도코칭의 높은 창의성(요청 temperature 0.7)은 effort: high로 근사합니다.
 */
export async function analyzeEvictionWithClaude(
  conversation: string,
): Promise<EvictionLlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  }

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
        max_tokens: 4096,
        // temperature: 0.7 사용 불가 → adaptive thinking + high effort
        output_config: { effort: 'high' },
        system: EVICTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildEvictionUserPrompt(conversation),
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

  return parseEvictionJson(text);
}

export { CLAUDE_MODEL };

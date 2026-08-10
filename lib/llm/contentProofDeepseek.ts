import {
  CONTENT_PROOF_SYSTEM_PROMPT,
  buildContentProofUserPrompt,
  parseContentProofJson,
  type ContentProofDraft,
} from './contentProofPrompt';
import { fetchWithTimeout, LLM_TIMEOUT_MS } from './fetchTimeout';

const DEEPSEEK_MODEL = 'deepseek-v4-pro';

export async function draftContentProofWithDeepSeek(
  conversation: string,
): Promise<ContentProofDraft> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetchWithTimeout(
    'https://api.deepseek.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.7,
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        stream: false,
        messages: [
          { role: 'system', content: CONTENT_PROOF_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildContentProofUserPrompt(conversation),
          },
        ],
      }),
    },
    LLM_TIMEOUT_MS,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `DeepSeek API 오류 (${res.status}): ${errText.slice(0, 280) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('DeepSeek 응답에 content가 없습니다.');
  }

  return parseContentProofJson(text);
}

export { DEEPSEEK_MODEL };

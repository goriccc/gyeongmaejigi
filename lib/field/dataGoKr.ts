export function dataGoKrServiceKey(): string {
  const raw = process.env.DATA_GO_KR_SERVICE_KEY?.trim() ?? '';
  if (!raw) return '';
  try {
    return raw.includes('%') ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
}

export type DataGoKrItem = Record<string, string>;

function asItemList(raw: unknown): DataGoKrItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((row) => stringifyRow(row));
  }
  if (typeof raw === 'object') return [stringifyRow(raw)];
  return [];
}

function stringifyRow(row: unknown): DataGoKrItem {
  const out: DataGoKrItem = {};
  if (!row || typeof row !== 'object') return out;
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v).trim();
  }
  return out;
}

function parseXmlItems(xml: string): DataGoKrItem[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return blocks.map((block) => {
    const row: DataGoKrItem = {};
    const re = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
      row[m[1]] = m[2].trim();
    }
    return row;
  });
}

export async function fetchDataGoKrItems(
  endpoint: string,
  params: Record<string, string>,
): Promise<{ items: DataGoKrItem[]; error?: string }> {
  const serviceKey = dataGoKrServiceKey();
  if (!serviceKey) {
    return { items: [], error: 'missing-key' };
  }

  const url = new URL(endpoint);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('_type', 'json');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
  const text = await res.text();
  if (!res.ok) {
    return { items: [], error: `http-${res.status}` };
  }

  if (text.trimStart().startsWith('<') || text.includes('<item>')) {
    return { items: parseXmlItems(text) };
  }

  try {
    const json = JSON.parse(text) as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: { items?: { item?: unknown } | string };
      };
    };
    const code = json.response?.header?.resultCode;
    if (code && code !== '00' && code !== '000') {
      return {
        items: [],
        error: json.response?.header?.resultMsg || code,
      };
    }
    const itemsRaw = json.response?.body?.items;
    if (!itemsRaw || typeof itemsRaw === 'string') return { items: [] };
    return { items: asItemList(itemsRaw.item) };
  } catch {
    return { items: parseXmlItems(text) };
  }
}

export function pickField(row: DataGoKrItem, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v) return v;
  }
  return '';
}

export function parseManAmount(raw: string): number | null {
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

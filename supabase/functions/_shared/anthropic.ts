import { logError } from './log.ts';

/**
 * Claude via the Anthropic API (spec 8). The key exists only as a function secret
 * (ANTHROPIC_API_KEY), never in the app. A fast, inexpensive model is the default;
 * override with the ANTHROPIC_MODEL secret.
 */
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const TIMEOUT_MS = 20_000;

export interface ClaudeRequest {
  system: string;
  prompt: string;
  maxTokens: number;
}

export function aiConfigured(): boolean {
  return Boolean(Deno.env.get('ANTHROPIC_API_KEY'));
}

/** The text of Claude's answer, or null when AI is not configured or the call fails (callers fall back). */
export async function askClaude(request: ClaudeRequest): Promise<string | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });
    if (!response.ok) {
      logError('anthropic', `HTTP ${response.status}`, { body: (await response.text()).slice(0, 300) });
      return null;
    }
    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (body.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    return text || null;
  } catch (error) {
    logError('anthropic', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

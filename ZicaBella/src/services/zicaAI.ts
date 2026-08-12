// ──────────────────────────────────────────────────
// Zica AI Service — Unified Mobile Integration
// ──────────────────────────────────────────────────
// Single service for all customer-facing Zica AI requests.
// Routes through the webstore's /api/zica-ai endpoint — the same backend
// used by the webstore widget — ensuring consistent behavior, system prompts,
// user profiling, and trend data.
// ──────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';
const ZICA_AI_ENDPOINT = `${APP_URL}/api/zica-ai`;

/**
 * Non-streaming call to the /api/zica-ai endpoint.
 * Returns the full response text.
 */
export async function sendZicaAIMessage(
  messages: ChatMessage[]
): Promise<string> {
  // Strip image content blocks — the /api/zica-ai endpoint expects simple text messages
  const sanitizedMessages = messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ') || 'Describe this for me'
        : String(msg.content),
  }));

  const response = await fetch(ZICA_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': APP_URL,
      'Referer': `${APP_URL}/`,
    },
    body: JSON.stringify({ messages: sanitizedMessages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to reach Zica AI');
  }

  const data = await response.json();
  return data.message as string;
}

/**
 * Simulated streaming call to /api/zica-ai.
 * Fetches the full response, then delivers it word-by-word via onToken callbacks
 * to preserve the smooth streaming UX the app already has.
 */
export function callZicaAIStream({
  messages,
  onToken,
  onError,
  onComplete,
}: {
  messages: ChatMessage[];
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string) => void;
}) {
  const abortController = new AbortController();

  // Strip image content blocks for the text-based endpoint
  const sanitizedMessages = messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ') || 'Describe this for me'
        : String(msg.content),
  }));

  fetch(ZICA_AI_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': APP_URL,
      'Referer': `${APP_URL}/`,
    },
    body: JSON.stringify({ messages: sanitizedMessages }),
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Zica AI is temporarily unavailable. Please try again.');
      }
      return response.json();
    })
    .then((data) => {
      const text = data.message || data.response || '';
      if (text) {
        // Simulate token-by-token delivery for smooth UX (chunk by words)
        const words = text.split(' ');
        let delivered = '';
        let i = 0;
        const interval = setInterval(() => {
          if (abortController.signal.aborted) {
            clearInterval(interval);
            return;
          }
          if (i < words.length) {
            const chunk = (i === 0 ? '' : ' ') + words[i];
            delivered += chunk;
            onToken(chunk);
            i++;
          } else {
            clearInterval(interval);
            onComplete(delivered);
          }
        }, 15); // Fast word-by-word delivery
      } else {
        onError(new Error('Zica AI returned an empty response.'));
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      onError(new Error(err.message || 'Zica AI is temporarily unavailable.'));
    });

  // Return cancel handler
  return () => {
    abortController.abort();
  };
}

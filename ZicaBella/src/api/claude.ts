// ──────────────────────────────────────────────────
// Claude AI Service — Mobile Integration
// ──────────────────────────────────────────────────
// Dedicated service scoped exclusively to the customer-facing Zica AI screen.
// Utilizes isolated credentials and system prompt configurations to guarantee 
// data separation and prevent operational leakage.
//
// Strategy:
//   1. Try direct streaming via Anthropic API (fast, real-time token streaming)
//   2. If API key is missing or direct call fails, fallback to server-side
//      /api/zica-ai route which proxies through the backend securely
// ──────────────────────────────────────────────────

import { ZICA_AI_CONFIG } from '../constants/aiConfig';

const SERVER_ENDPOINT =
  (process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com') + '/api/zica-ai';

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | any[];
}

/**
 * Standard fetch call for Claude (fallback, non-streaming)
 */
export async function callClaude({
  systemPrompt,
  userMessage,
  conversationHistory = [],
}: {
  systemPrompt?: string;
  userMessage: string;
  conversationHistory?: Message[];
}) {
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage }
  ];

  // If no API key is available, use server-side proxy
  if (!ZICA_AI_CONFIG.CLAUDE_API_KEY) {
    return callClaudeViaServer(messages);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ZICA_AI_CONFIG.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ZICA_AI_CONFIG.MODEL,
      max_tokens: ZICA_AI_CONFIG.MAX_TOKENS,
      system: systemPrompt || ZICA_AI_CONFIG.SYSTEM_PROMPT,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'AI service error. Please try again.');
  }

  const data = await response.json();
  return data;
}

/**
 * Fallback: call the server-side /api/zica-ai endpoint (non-streaming)
 */
async function callClaudeViaServer(messages: Message[]) {
  // Strip image content blocks for server fallback — server route expects simple text messages
  const sanitizedMessages = messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ') || 'Describe this for me'
        : String(msg.content),
  }));

  const response = await fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: sanitizedMessages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || 'Zica AI is temporarily unavailable.');
  }

  const data = await response.json();
  // Normalize to match Anthropic API response shape
  return {
    content: [{ type: 'text', text: data.message }],
  };
}

/**
 * SSE Streaming call for Claude using XMLHttpRequest (native, robust React Native iOS compatibility)
 *
 * Falls back to server-side non-streaming endpoint if the API key is missing
 * or if the streaming call encounters a non-recoverable error.
 */
export function callClaudeStream({
  messages,
  systemPrompt,
  onToken,
  onError,
  onComplete,
}: {
  messages: Message[];
  systemPrompt?: string;
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string) => void;
}) {
  // ── Guard: if no API key, use server-side fallback ──
  if (!ZICA_AI_CONFIG.CLAUDE_API_KEY) {
    return callClaudeStreamFallback({ messages, systemPrompt, onToken, onError, onComplete });
  }

  let cancelled = false;
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.anthropic.com/v1/messages', true);

  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', ZICA_AI_CONFIG.CLAUDE_API_KEY);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');
  xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');

  const payload = {
    model: ZICA_AI_CONFIG.MODEL,
    max_tokens: ZICA_AI_CONFIG.MAX_TOKENS,
    system: systemPrompt || ZICA_AI_CONFIG.SYSTEM_PROMPT,
    stream: true,
    messages: messages,
  };

  let processedLinesCount = 0;
  let fullText = '';
  let receivedAnyToken = false;

  xhr.onreadystatechange = () => {
    if (cancelled) return;

    if (xhr.readyState === 3 || xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        const text = xhr.responseText;
        const lines = text.split('\n');
        
        // Use all lines if request is finished, otherwise slice off the last potentially incomplete line
        const completeLines = xhr.readyState === 4 ? lines : lines.slice(0, -1);

        for (let i = processedLinesCount; i < completeLines.length; i++) {
          const line = completeLines[i].trim();
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const token = parsed.delta.text;
                fullText += token;
                receivedAnyToken = true;
                onToken(token);
              }
              // Handle streaming API-level errors (e.g., overloaded_error)
              if (parsed.type === 'error') {
                const errMsg = parsed.error?.message || 'Streaming error from Zica AI.';
                onError(new Error(errMsg));
                return;
              }
            } catch (e) {
              // Ignore incomplete SSE chunks parsing
            }
          }
        }
        processedLinesCount = completeLines.length;

        if (xhr.readyState === 4) {
          if (receivedAnyToken) {
            onComplete(fullText);
          } else {
            // Stream completed but no tokens received — likely a silent failure, fallback
            console.warn('[Zica AI] Streaming completed with no tokens, falling back to server.');
            callClaudeStreamFallback({ messages, onToken, onError, onComplete });
          }
        }
      } else {
        if (xhr.readyState === 4) {
          let errMsg = 'Failed to load response from Zica AI.';
          let isAuthError = false;
          try {
            const responseObj = JSON.parse(xhr.responseText);
            if (responseObj?.error?.message) {
              errMsg = responseObj.error.message;
            }
            // Detect auth/model errors that would benefit from server fallback
            if (xhr.status === 401 || xhr.status === 403 || xhr.status === 404) {
              isAuthError = true;
            }
          } catch (e) {
            // Ignore parse errors
          }

          if (isAuthError) {
            // API key invalid or model not found — try server-side fallback
            console.warn('[Zica AI] Direct API failed (status ' + xhr.status + '), falling back to server.');
            callClaudeStreamFallback({ messages, onToken, onError, onComplete });
          } else {
            onError(new Error(errMsg));
          }
        }
      }
    }
  };

  xhr.onerror = () => {
    if (cancelled) return;
    // Network error — try server-side fallback
    console.warn('[Zica AI] Network error on direct API, falling back to server.');
    callClaudeStreamFallback({ messages, onToken, onError, onComplete });
  };

  xhr.send(JSON.stringify(payload));

  // Return cancel handler
  return () => {
    cancelled = true;
    xhr.abort();
  };
}

/**
 * Server-side fallback for streaming — delivers full response at once via the backend proxy.
 * Used when the direct Anthropic API is unreachable (missing key, auth error, network issue).
 */
function callClaudeStreamFallback({
  messages,
  systemPrompt,
  onToken,
  onError,
  onComplete,
}: {
  messages: Message[];
  systemPrompt?: string;
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string) => void;
}) {
  // Strip image content blocks for server fallback
  const sanitizedMessages = messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ') || 'Describe this for me'
        : String(msg.content),
  }));

  const abortController = new AbortController();

  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: sanitizedMessages, systemPrompt }),
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
      const text = data.message || '';
      if (text) {
        // Simulate token-by-token delivery for smoother UX (chunk by words)
        const words = text.split(' ');
        let delivered = '';
        let i = 0;
        const interval = setInterval(() => {
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

  return () => {
    abortController.abort();
  };
}

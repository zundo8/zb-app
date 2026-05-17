// ──────────────────────────────────────────────────
// Claude AI Service — Mobile Integration
// ──────────────────────────────────────────────────
// Dedicated service scoped exclusively to the customer-facing Zica AI screen.
// Utilizes isolated credentials and system prompt configurations to guarantee 
// data separation and prevent operational leakage.
// ──────────────────────────────────────────────────

import { ZICA_AI_CONFIG } from '../constants/aiConfig';

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
 * SSE Streaming call for Claude using XMLHttpRequest (native, robust React Native iOS compatibility)
 */
export function callClaudeStream({
  messages,
  onToken,
  onError,
  onComplete,
}: {
  messages: Message[];
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string) => void;
}) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.anthropic.com/v1/messages', true);

  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', ZICA_AI_CONFIG.CLAUDE_API_KEY);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');
  xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');

  const payload = {
    model: ZICA_AI_CONFIG.MODEL,
    max_tokens: ZICA_AI_CONFIG.MAX_TOKENS,
    system: ZICA_AI_CONFIG.SYSTEM_PROMPT,
    stream: true,
    messages: messages,
  };

  let processedLinesCount = 0;
  let fullText = '';

  xhr.onreadystatechange = () => {
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
                onToken(token);
              }
            } catch (e) {
              // Ignore incomplete SSE chunks parsing
            }
          }
        }
        processedLinesCount = completeLines.length;

        if (xhr.readyState === 4) {
          onComplete(fullText);
        }
      } else {
        if (xhr.readyState === 4) {
          let errMsg = 'Failed to load response from Zica AI.';
          try {
            const responseObj = JSON.parse(xhr.responseText);
            if (responseObj?.error?.message) {
              errMsg = responseObj.error.message;
            }
          } catch (e) {
            // Ignore parse errors
          }
          onError(new Error(errMsg));
        }
      }
    }
  };

  xhr.onerror = () => {
    onError(new Error('Network error when calling Zica AI.'));
  };

  xhr.send(JSON.stringify(payload));

  // Return cancel handler
  return () => {
    xhr.abort();
  };
}

// ──────────────────────────────────────────────────
// OpenAI AI Service — Mobile Integration
// ──────────────────────────────────────────────────
// Dedicated user-side API service scoped exclusively to the customer-facing Zica AI screen.
// Strictly routed via the Next.js secure backend proxy to prevent API key exposure.
// ──────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant';
  content: string | any[];
}

/**
 * SSE Streaming call for OpenAI using XMLHttpRequest (native, robust React Native iOS & Android compatibility)
 * Routed entirely via the secure backend proxy at /api/app/openai
 */
export function callOpenAIStream({
  messages,
  sessionId,
  userId,
  orderIdContext,
  onToken,
  onError,
  onComplete,
}: {
  messages: Message[];
  sessionId?: string | null;
  userId?: string | null;
  orderIdContext?: string | null;
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string, newSessionId?: string) => void;
}) {
  const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';
  const SERVER_ENDPOINT = `${APP_URL}/api/app/openai`;

  let cancelled = false;
  const xhr = new XMLHttpRequest();
  xhr.open('POST', SERVER_ENDPOINT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');

  // Strip image base64 blocks if they aren't parsed as simple base64 standard URLs to keep payload optimized
  const sanitizedMessages = messages.map(msg => {
    // If msg.content is an array (multipart image prompt), pass it through
    if (Array.isArray(msg.content)) {
      return {
        role: msg.role,
        content: msg.content
      };
    }
    return {
      role: msg.role,
      content: String(msg.content)
    };
  });

  const payload = {
    messages: sanitizedMessages,
    sessionId: sessionId || undefined,
    userContext: userId ? { id: userId } : undefined,
    orderIdContext: orderIdContext || undefined
  };

  let processedLinesCount = 0;
  let fullText = '';
  let receivedAnyToken = false;
  let resolvedSessionId: string | undefined = undefined;

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
              if (parsed.sessionId) {
                resolvedSessionId = parsed.sessionId;
              }
              // Handle streaming API-level errors
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
            onComplete(fullText, resolvedSessionId);
          } else {
            console.warn('[Zica OpenAI] Streaming completed but no tokens received.');
            onError(new Error('Failed to load response from Zica AI.'));
          }
        }
      } else {
        if (xhr.readyState === 4) {
          let errMsg = 'Failed to load response from Zica AI.';
          try {
            const responseObj = JSON.parse(xhr.responseText);
            if (responseObj?.error) {
              errMsg = typeof responseObj.error === 'string' ? responseObj.error : responseObj.error.message;
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
    if (cancelled) return;
    onError(new Error('Network error. Failed to connect to Zica AI server.'));
  };

  xhr.send(JSON.stringify(payload));

  // Return cancel handler (supports user interruption/cancelling)
  return () => {
    cancelled = true;
    xhr.abort();
  };
}

// ──────────────────────────────────────────────────
// Claude AI Service — Mobile Integration
// ──────────────────────────────────────────────────

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

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
  content: string;
}

export async function callClaude({
  systemPrompt,
  userMessage,
  tools = [],
  conversationHistory = [],
}: {
  systemPrompt: string;
  userMessage: string;
  tools?: ClaudeTool[];
  conversationHistory?: Message[];
}) {
  const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
  
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: [
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ],
    }),
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }
  
  return response.json();
}

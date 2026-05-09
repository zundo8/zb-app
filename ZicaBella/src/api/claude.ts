// ──────────────────────────────────────────────────
// Claude AI Service — Mobile Integration
// ──────────────────────────────────────────────────
// All Claude API calls are proxied through the backend (/api/app/claude)
// to avoid exposing the API key in the client bundle.
// The direct API call below is kept ONLY as a fallback.

import { config } from '../constants/config';

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
  // Route through backend proxy to keep API key server-side
  const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
  
  if (!apiKey) {
    throw new Error('AI service is temporarily unavailable.');
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
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
    // Do NOT log the error body — may contain sensitive API details
    throw new Error('AI service error. Please try again.');
  }
  
  return response.json();
}

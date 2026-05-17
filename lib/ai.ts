import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.CLAUDE_API_KEY) {
  console.warn('CLAUDE_API_KEY is not defined in environment variables');
}

export const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export const CLAUDE_MODELS = {
  FAST: 'claude-sonnet-4-20250514',
  POWERFUL: 'claude-sonnet-4-20250514',
};

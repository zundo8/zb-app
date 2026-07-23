/**
 * lib/ai/claudeClient.ts
 * Consolidated Anthropic Claude client with:
 * - Singleton client with key resolution (env → DB)
 * - Retry logic: 404→next model, 429/529→exponential backoff, 401→throw immediately
 * - AbortSignal.timeout on every call
 * - Hard cap on agentic tool-use loops (MAX_TOOL_LOOPS)
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';
import { getModelChain, type ModelEntry } from './models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum tool-use round-trips before forcing end_turn */
export const MAX_TOOL_LOOPS = 8;

/** Timeout per single Claude API call (ms) */
const CALL_TIMEOUT_MS = 30_000;

/** Max retries for rate-limit / overloaded (per model) */
const MAX_RATE_LIMIT_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 250;

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
let _resolvedKey: string | null = null;

/**
 * Resolve the Anthropic API key.  Priority:
 * 1. ANTHROPIC_API_KEY env var (preferred)
 * 2. CLAUDE_API_KEY env var (legacy)
 * 3. Shop.claudeApiKey from DB
 */
async function resolveApiKey(): Promise<string> {
  if (_resolvedKey) return _resolvedKey;

  const envKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (envKey && envKey.startsWith('sk-ant-')) {
    _resolvedKey = envKey;
    return envKey;
  }

  try {
    const shop = await prisma.shop.findFirst({
      select: { claudeApiKey: true },
    });
    if (shop?.claudeApiKey && shop.claudeApiKey.startsWith('sk-ant-')) {
      _resolvedKey = shop.claudeApiKey;
      return shop.claudeApiKey;
    }
  } catch (err) {
    console.error('[ClaudeClient] Failed to fetch key from DB:', err);
  }

  throw new Error('[ClaudeClient] No valid Anthropic API key configured');
}

/** Reset cached client — used when key changes via admin UI */
export function resetClient(): void {
  _client = null;
  _resolvedKey = null;
}

async function getClient(): Promise<Anthropic> {
  if (_client) return _client;
  const apiKey = await resolveApiKey();
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeCallOptions {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  /** Override max_tokens (default: model's maxTokens from registry) */
  maxTokens?: number;
  /** Override model chain (default: PRIMARY → FALLBACK) */
  modelChain?: ModelEntry[];
  /** AbortSignal from caller (merged with internal timeout) */
  signal?: AbortSignal;
}

export interface ClaudeCallResult {
  response: Anthropic.Message;
  modelUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Core call with fallback + retry
// ---------------------------------------------------------------------------

/**
 * Call Claude with automatic model fallback and retry logic.
 *
 * Retry strategy per model in the chain:
 * - 404 (not_found_error)      → skip to next model immediately
 * - 401 (authentication_error) → throw immediately, never retry
 * - 429 / 529 (rate limit)     → exponential backoff, up to MAX_RATE_LIMIT_RETRIES, then next model
 * - Other errors               → throw immediately
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const chain = opts.modelChain ?? getModelChain();
  const startTime = Date.now();

  let lastError: Error | null = null;

  for (let modelIdx = 0; modelIdx < chain.length; modelIdx++) {
    const model = chain[modelIdx];
    const isFirstModel = modelIdx === 0;

    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        const client = await getClient();

        const maxTokens = opts.maxTokens ?? model.maxTokens;

        // Build request params
        const params: Anthropic.MessageCreateParamsNonStreaming = {
          model: model.id,
          max_tokens: maxTokens,
          system: opts.systemPrompt,
          messages: opts.messages,
        };

        if (opts.tools && opts.tools.length > 0) {
          params.tools = opts.tools;
        }

        const response = await client.messages.create(params, {
          timeout: CALL_TIMEOUT_MS,
          signal: opts.signal,
        });

        // Warn if response was truncated
        if (response.stop_reason === 'max_tokens') {
          console.warn(
            `[ClaudeClient] Response truncated at max_tokens (${maxTokens}) for model ${model.id}`
          );
        }

        return {
          response,
          modelUsed: model.id,
          fallbackUsed: !isFirstModel,
          latencyMs: Date.now() - startTime,
        };
      } catch (error: any) {
        lastError = error;
        const status = error?.status ?? error?.error?.status;
        const errorType = error?.error?.type ?? error?.type;

        // 401 — never retry, bad key
        if (status === 401 || errorType === 'authentication_error') {
          console.error(`[ClaudeClient] Auth error — API key is invalid.`);
          resetClient(); // Clear cached key
          throw error;
        }

        // 404 — model not found, skip to next model
        if (status === 404 || errorType === 'not_found_error') {
          console.warn(
            `[ClaudeClient] Model ${model.id} returned 404 — skipping to next model`
          );
          break; // exit retry loop, try next model
        }

        // 429 / 529 — rate limited / overloaded
        if (status === 429 || status === 529 || errorType === 'rate_limit_error') {
          if (attempt < MAX_RATE_LIMIT_RETRIES) {
            const delay = BACKOFF_BASE_MS * Math.pow(4, attempt) + Math.random() * 200;
            console.warn(
              `[ClaudeClient] Rate limited on ${model.id}, retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES} in ${Math.round(delay)}ms`
            );
            await sleep(delay);
            continue;
          }
          // Exhausted retries for this model, try next
          console.warn(
            `[ClaudeClient] Rate limit retries exhausted for ${model.id} — trying next model`
          );
          break;
        }

        // Any other error — throw immediately
        throw error;
      }
    }
  }

  // All models exhausted
  console.error('[ClaudeClient] All models in chain exhausted');
  throw lastError ?? new Error('[ClaudeClient] All models exhausted — no response');
}

// ---------------------------------------------------------------------------
// Streaming variant
// ---------------------------------------------------------------------------

export interface ClaudeStreamOptions {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
  /** Only use the primary model for streaming (no fallback mid-stream) */
  modelId?: string;
}

export async function streamClaude(opts: ClaudeStreamOptions) {
  const client = await getClient();
  const chain = getModelChain();
  const model = opts.modelId ?? chain[0].id;
  const maxTokens = opts.maxTokens ?? chain[0].maxTokens;

  const params: Anthropic.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    system: opts.systemPrompt,
    messages: opts.messages,
    stream: true,
  };

  if (opts.tools && opts.tools.length > 0) {
    params.tools = opts.tools;
  }

  return client.messages.create(params, {
    timeout: CALL_TIMEOUT_MS * 2, // Streaming needs more time
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simple health check — sends a minimal message and checks for a response.
 * Returns { ok, latencyMs, error? } for each model.
 */
export async function checkModelHealth(
  modelId: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const client = await getClient();
    await client.messages.create(
      {
        model: modelId,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      },
      { timeout: 10_000 }
    );
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: error?.message || String(error),
    };
  }
}

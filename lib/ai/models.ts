/**
 * lib/ai/models.ts
 * Central model ID registry for Anthropic Claude API.
 *
 * All model IDs are pinned (no `-latest` aliases) to avoid silent breakage
 * when Anthropic retires aliases. Every ID is env-overridable so a model
 * deprecation can be hot-fixed without redeploying.
 */

/** Model roles used across the application */
export type ModelRole = 'PRIMARY' | 'FALLBACK' | 'FAST';

export interface ModelEntry {
  role: ModelRole;
  id: string;
  maxTokens: number;
  /** Rough cost tier for logging/budgeting: 1 = cheapest, 3 = most expensive */
  costTier: 1 | 2 | 3;
}

/**
 * Pinned model IDs — verified against docs.anthropic.com/en/docs/about-claude/models
 * as of July 2026.
 *
 * PRIMARY  → claude-sonnet-5          (current flagship, best balance)
 * FALLBACK → claude-haiku-4-5-20251001 (fast mid-tier)
 * FAST     → claude-haiku-4-5-20251001 (cost-optimized, high-volume)
 */
const MODEL_ENTRIES: ModelEntry[] = [
  {
    role: 'PRIMARY',
    id: process.env.CLAUDE_MODEL_PRIMARY || 'claude-sonnet-5',
    maxTokens: 4096,
    costTier: 3,
  },
  {
    role: 'FALLBACK',
    id: process.env.CLAUDE_MODEL_FALLBACK || 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    costTier: 1,
  },
  {
    role: 'FAST',
    id: process.env.CLAUDE_MODEL_FAST || 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    costTier: 1,
  },
];

/** Get the ordered fallback chain: PRIMARY → FALLBACK */
export function getModelChain(): ModelEntry[] {
  return MODEL_ENTRIES.filter((m) => m.role === 'PRIMARY' || m.role === 'FALLBACK');
}

/** Get a specific model by role */
export function getModel(role: ModelRole): ModelEntry {
  const entry = MODEL_ENTRIES.find((m) => m.role === role);
  if (!entry) throw new Error(`[AI Models] Unknown model role: ${role}`);
  return entry;
}

/** Get the fast/cheap model (for high-volume, low-stakes tasks) */
export function getFastModel(): ModelEntry {
  return getModel('FAST');
}

/** Get all model IDs for health checks */
export function getAllModelIds(): string[] {
  return [...new Set(MODEL_ENTRIES.map((m) => m.id))];
}

/**
 * lib/ai/outputGuard.ts
 * Final output scanner for customer-facing AI messages.
 *
 * Checks for leaked internals: other customers' IDs, myshopify.com URLs,
 * API keys, vendor names, manufacturing keywords, cost/margin data.
 *
 * On hit: replaces with safe fallback and logs HIGH-severity event.
 */

// ---------------------------------------------------------------------------
// Patterns that must NEVER appear in customer-facing output
// ---------------------------------------------------------------------------

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // API keys / secrets
  { pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/gi, label: 'anthropic_api_key' },
  { pattern: /sk-proj-[a-zA-Z0-9_-]{10,}/gi, label: 'openai_api_key' },
  { pattern: /rzp_(live|test)_[a-zA-Z0-9]{10,}/gi, label: 'razorpay_key' },
  { pattern: /shpat_[a-zA-Z0-9]{10,}/gi, label: 'shopify_token' },

  // Shopify admin / internal URLs
  { pattern: /myshopify\.com/gi, label: 'shopify_domain' },
  { pattern: /admin\.shopify\.com/gi, label: 'shopify_admin' },
  { pattern: /\/admin\/api\//gi, label: 'shopify_admin_api' },

  // Manufacturing / internal operations
  { pattern: /\b(cutting|stitching|embroidery|wash\s*cost|qc_passed|qc_reject|quality\s*check)\b/gi, label: 'manufacturing_stage' },
  { pattern: /\bcost\s*per\s*(meter|unit|piece)\b/gi, label: 'cost_data' },
  { pattern: /\b(wholesale|margin|markup|profit)\s*(price|cost|percentage|%)\b/gi, label: 'margin_data' },
  { pattern: /\bvendor\s*(name|id|contact)\b/gi, label: 'vendor_info' },
  { pattern: /\bsupplier\s*(name|id)\b/gi, label: 'supplier_info' },
  { pattern: /\bwarehouse\s*(id|location|code)\b/gi, label: 'warehouse_info' },

  // Dashboard & Admin URLs / Internal Tools
  { pattern: /\/dashboard\b/gi, label: 'dashboard_url' },
  { pattern: /\/api\/admin\//gi, label: 'admin_api_url' },
  { pattern: /\bdeveloper@zicabella\.com\b/gi, label: 'internal_dev_email' },
  { pattern: /\b(system\s*prompt|internal\s*tool(ing)?|admin\s*dashboard)\b/gi, label: 'internal_tooling_or_prompt' },

  // Internal IDs that shouldn't leak
  { pattern: /\bcuid_[a-z0-9]{20,}\b/gi, label: 'internal_cuid' },
  { pattern: /\binventoryItemId\b/gi, label: 'inventory_item_id' },
];

/**
 * Safe fallback message shown to customers when the guard trips.
 */
const SAFE_FALLBACK =
  "I'm sorry, I wasn't able to complete that request properly. Please try rephrasing your question, or contact our support team for help.";

// ---------------------------------------------------------------------------
// Guard function
// ---------------------------------------------------------------------------

export interface GuardResult {
  safe: boolean;
  message: string;
  /** Labels of patterns that triggered the guard */
  triggeredLabels: string[];
}

/**
 * Scan a customer-facing message for leaked internal data.
 *
 * @param message   The AI-generated message to scan
 * @param channel   For logging: 'app' | 'support' | 'whatsapp'
 * @returns GuardResult with safe=true if clean, or safe=false with fallback message
 */
export function guardOutput(message: string, channel: string = 'app'): GuardResult {
  if (!message || typeof message !== 'string') {
    return { safe: true, message: message || '', triggeredLabels: [] };
  }

  const triggeredLabels: string[] = [];

  for (const { pattern, label } of BLOCKED_PATTERNS) {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      triggeredLabels.push(label);
    }
  }

  if (triggeredLabels.length > 0) {
    console.error(
      `[OutputGuard] BLOCKED — channel=${channel}, triggers=[${triggeredLabels.join(',')}]`
    );
    return {
      safe: false,
      message: SAFE_FALLBACK,
      triggeredLabels,
    };
  }

  return { safe: true, message, triggeredLabels: [] };
}

/**
 * Apply the output guard to a message. Returns the safe message (original or fallback).
 */
export function applyOutputGuard(message: string, channel: string = 'app'): string {
  const result = guardOutput(message, channel);
  return result.message;
}

/**
 * Unit tests for validateWebhookSignature
 * 
 * Self-contained — duplicates the validation logic to avoid Prisma dependency.
 * Run with: npx tsx scripts/test-webhook-sig.ts
 */
import * as crypto from 'crypto';

// ─── Inline copy of validateWebhookSignature (avoids Prisma import) ─────
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  provider: 'delhivery' | 'shiprocket' | 'generic' = 'generic',
  /** Override for testing — defaults to process.env.DELHIVERY_WEBHOOK_MODE */
  modeOverride?: string
): boolean {
  if (!secret || !signature) return false;

  try {
    const cleanSignature = signature
      .replace(/^sha256=/i, '')
      .replace(/^Bearer\s+/i, '')
      .replace(/^Token\s+/i, '')
      .trim();
    const cleanSecret = secret.trim();

    if (provider === 'delhivery') {
      const mode = (modeOverride ?? process.env.DELHIVERY_WEBHOOK_MODE ?? 'token').trim().toLowerCase();
      if (mode === 'token') {
        const sigBuf = Buffer.from(cleanSignature);
        const secretBuf = Buffer.from(cleanSecret);

        if (sigBuf.length !== secretBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, secretBuf);
      }
    }

    // HMAC-SHA256 comparison for shiprocket/generic or delhivery in hmac mode
    const expectedSignature = crypto
      .createHmac('sha256', cleanSecret)
      .update(payload)
      .digest('hex');

    if (cleanSignature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
// ─── End inline copy ────────────────────────────────────────────────────

// Test runner
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  validateWebhookSignature — Unit Tests                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const TOKEN = 'c82d8f7d564741aec53416706e08698efe27ed708e66ec922f3f3537156fa5f9';
const WRONG_SECRET = 'a70060748d8cc056b1cf78452c91535b7795552574df54ef9791570b490afedf';
const PAYLOAD = JSON.stringify({
  Shipment: {
    AWB: '84527810000033',
    ReferenceNo: '1001',
    Status: { Status: 'In Transit', StatusDateTime: '2026-08-05T00:00:00Z' },
  },
});

// ── 1. Delhivery token mode ──
console.log('\n── 1. Delhivery: token mode (default) ──');
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, TOKEN, 'delhivery') === true,
  'Token match → true'
);
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, WRONG_SECRET, 'delhivery') === false,
  'Token mismatch (stored differs from received) → false'
);

// ── 2. Tampered / wrong-length tokens ──
console.log('\n── 2. Tampered tokens ──');
assert(
  validateWebhookSignature(PAYLOAD, 'short_tampered', TOKEN, 'delhivery') === false,
  'Short tampered token → false'
);
assert(
  validateWebhookSignature(PAYLOAD, TOKEN + '_extra', TOKEN, 'delhivery') === false,
  'Longer tampered token → false'
);
assert(
  validateWebhookSignature(PAYLOAD, '', TOKEN, 'delhivery') === false,
  'Empty signature → false'
);

// ── 3. Prefix stripping ──
console.log('\n── 3. Prefix stripping (Bearer/Token/sha256=) ──');
assert(
  validateWebhookSignature(PAYLOAD, `Bearer ${TOKEN}`, TOKEN, 'delhivery') === true,
  'Bearer prefix stripped → match'
);
assert(
  validateWebhookSignature(PAYLOAD, `Token ${TOKEN}`, TOKEN, 'delhivery') === true,
  'Token prefix stripped → match'
);
assert(
  validateWebhookSignature(PAYLOAD, `sha256=${TOKEN}`, TOKEN, 'delhivery') === true,
  'sha256= prefix stripped → match'
);
assert(
  validateWebhookSignature(PAYLOAD, `  ${TOKEN}  `, TOKEN, 'delhivery') === true,
  'Whitespace trimmed → match'
);

// ── 4. Delhivery HMAC mode override ──
console.log('\n── 4. Delhivery: hmac mode (env override) ──');
const hmacOfPayload = crypto.createHmac('sha256', WRONG_SECRET).update(PAYLOAD).digest('hex');
assert(
  validateWebhookSignature(PAYLOAD, hmacOfPayload, WRONG_SECRET, 'delhivery', 'hmac') === true,
  'HMAC mode: correct HMAC digest → true'
);
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, WRONG_SECRET, 'delhivery', 'hmac') === false,
  'HMAC mode: static token (not an HMAC) → false'
);
assert(
  validateWebhookSignature(PAYLOAD, hmacOfPayload, TOKEN, 'delhivery', 'hmac') === false,
  'HMAC mode: wrong secret produces wrong digest → false'
);

// ── 5. Shiprocket/generic stays HMAC ──
console.log('\n── 5. Shiprocket / generic: always HMAC-SHA256 ──');
const genericHmac = crypto.createHmac('sha256', WRONG_SECRET).update(PAYLOAD).digest('hex');
assert(
  validateWebhookSignature(PAYLOAD, genericHmac, WRONG_SECRET, 'generic') === true,
  'Generic HMAC match → true'
);
assert(
  validateWebhookSignature(PAYLOAD, genericHmac, WRONG_SECRET, 'shiprocket') === true,
  'Shiprocket HMAC match → true'
);
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, WRONG_SECRET, 'generic') === false,
  'Generic: static token rejected → false'
);
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, WRONG_SECRET, 'shiprocket') === false,
  'Shiprocket: static token rejected → false'
);

// ── 6. Edge cases ──
console.log('\n── 6. Edge cases ──');
assert(
  validateWebhookSignature(PAYLOAD, TOKEN, '', 'delhivery') === false,
  'Missing secret → false'
);
assert(
  validateWebhookSignature(PAYLOAD, '', WRONG_SECRET, 'delhivery') === false,
  'Missing signature → false'
);
assert(
  validateWebhookSignature('', TOKEN, TOKEN, 'delhivery') === true,
  'Token mode: empty payload irrelevant (token match still succeeds)'
);

// ── Summary ──
console.log('\n' + '═'.repeat(60));
if (failed > 0) {
  console.error(`❌ ${failed} test(s) FAILED, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`🎉 All ${passed} tests PASSED`);
  process.exit(0);
}

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { stripMarkdown } from '../lib/ai/formatSanitizer';
import { getRelevantKnowledgeContext } from '../lib/ai/knowledgeBase';
import { applyOutputGuard } from '../lib/ai/outputGuard';

async function runTests() {
  console.log('====================================================');
  console.log('ZICA AI SUPPORT OVERHAUL — VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ✗ ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // Test 1: Markdown Sanitizer / Stripper
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Plain Text Formatting Sanitizer (stripMarkdown) ---');
  const sampleMarkdown = `## Order Status Update
Your order **ZB-99182** is currently **Processing**.

### Item Summary:
- Acid Wash Oversized Tee (Size: L) - Qty: 1
- Baggy Acid Denim (Size: 32) - Qty: 1

For exchange rules, visit [Zica Bella Exchange](zicabella://collection/all).
Note: \`Tracking ID: DEL123456\` will be shared via SMS.`;

  const cleanText = stripMarkdown(sampleMarkdown);
  console.log('Sanitized Output:\n' + cleanText + '\n');

  assert(!cleanText.includes('**'), 'No raw asterisks (**) in output');
  assert(!cleanText.includes('##'), 'No raw hashtags (##) in output');
  assert(!cleanText.includes('`'), 'No raw backticks (`) in output');
  assert(!cleanText.includes('- Acid Wash'), 'No raw hyphen list items (- item) in output');
  assert(cleanText.includes('• Acid Wash'), 'Hyphen list items converted to clean bullets (•)');
  assert(cleanText.includes('Order Status Update'), 'Header text preserved without # symbols');

  // -----------------------------------------------------------------
  // Test 2: Dynamic Knowledge Base Retrieval
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Knowledge Base Retrieval ---');
  const kbContext = await getRelevantKnowledgeContext('I want to exchange my size. How does self pickup work?');
  console.log('KB Context Excerpt:\n' + kbContext.slice(0, 350) + '...\n');

  assert(kbContext.includes('OFFICIAL ZICA BELLA KNOWLEDGE BASE'), 'Knowledge Base section header present');
  assert(kbContext.includes('Self-Pickup vs Self-Ship Rules') || kbContext.includes('reverse pickup'), 'Self-pickup vs self-ship rules present');
  assert(kbContext.includes('+91 98765 43210') || kbContext.includes('support@zicabella.com'), 'Support contact info present in KB');

  // -----------------------------------------------------------------
  // Test 3: Data Security Boundary & Leaked Internals (OutputGuard)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Security Boundary & Leak Prevention (OutputGuard) ---');
  const leakedResponse1 = 'The fabric wash cost per meter was ₹250 and vendor name is Sourcing India Ltd.';
  const safeResult1 = applyOutputGuard(leakedResponse1, 'support');
  assert(safeResult1.includes("sorry, I wasn't able to complete that request"), 'Blocked manufacturing cost / vendor leak');

  const leakedResponse2 = 'You can track on https://admin.shopify.com/store/zica-bella or myshopify.com';
  const safeResult2 = applyOutputGuard(leakedResponse2, 'support');
  assert(safeResult2.includes("sorry, I wasn't able to complete that request"), 'Blocked shopify admin URL leak');

  const cleanCustomerResponse = 'Your order ZB81000 is Shipped and expected to deliver by Friday.';
  const safeResult3 = applyOutputGuard(cleanCustomerResponse, 'support');
  assert(safeResult3 === cleanCustomerResponse, 'Allowed valid customer order update');

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

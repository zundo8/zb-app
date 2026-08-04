import { validateWebhookSignature } from '../lib/services/logistics';
import * as crypto from 'crypto';

function runTests() {
  console.log('--- RUNNING WEBHOOK SIGNATURE & LOGISTICS REGRESSION TESTS ---');
  
  let failed = false;
  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  };

  const realToken = 'c82d8f7d564741aec53416706e08698efe27ed708e66ec922f3f3537156fa5f9';
  const realSecret = 'a70060748d8cc056b1cf78452c91535b7795552574df54ef9791570b490afedf';
  const samplePayload = JSON.stringify({
    Shipment: {
      AWB: '84527810000033',
      ReferenceNo: '1001',
      Status: { Status: 'In Transit', StatusDateTime: '2026-08-05T00:00:00Z' }
    }
  });

  // Test 1: Real values static token comparison (matching secret token)
  assert(
    validateWebhookSignature(samplePayload, realToken, realToken, 'delhivery') === true,
    'Test 1a: Delhivery static token validation succeeds when stored secret matches incoming header token'
  );
  assert(
    validateWebhookSignature(samplePayload, realToken, realSecret, 'delhivery') === false,
    'Test 1b: Delhivery static token validation returns false when stored secret differs from header token'
  );

  // Test 2: Tampered / short token -> returns false
  assert(
    validateWebhookSignature(samplePayload, 'short_tampered_token', realToken, 'delhivery') === false,
    'Test 2a: Short/tampered token fails static token validation'
  );
  assert(
    validateWebhookSignature(samplePayload, 'c82d8f7d564741aec53416706e08698efe27ed708e66ec922f3f3537156fa5f9_invalid', realToken, 'delhivery') === false,
    'Test 2b: Mismatched length token fails static token validation'
  );

  // Test 3: Token with prefixes (Bearer/Token) and whitespace
  assert(
    validateWebhookSignature(samplePayload, `Bearer ${realToken} `, realToken, 'delhivery') === true,
    'Test 3a: Header with Bearer prefix and trailing space validates correctly'
  );
  assert(
    validateWebhookSignature(samplePayload, `Token ${realToken}`, realToken, 'delhivery') === true,
    'Test 3b: Header with Token prefix validates correctly'
  );

  // Test 4: DELHIVERY_WEBHOOK_MODE env override ('hmac')
  process.env.DELHIVERY_WEBHOOK_MODE = 'hmac';
  const delhiveryHmac = crypto.createHmac('sha256', realSecret).update(samplePayload).digest('hex');
  assert(
    validateWebhookSignature(samplePayload, delhiveryHmac, realSecret, 'delhivery') === true,
    'Test 4a: Delhivery HMAC mode override validates computed HMAC-SHA256'
  );
  assert(
    validateWebhookSignature(samplePayload, realToken, realSecret, 'delhivery') === false,
    'Test 4b: Delhivery HMAC mode override rejects static token when expecting HMAC'
  );
  delete process.env.DELHIVERY_WEBHOOK_MODE; // Reset to default ('token')

  // Test 5: Shiprocket / Generic provider (remains HMAC-SHA256)
  const genericHmac = crypto.createHmac('sha256', realSecret).update(samplePayload).digest('hex');
  assert(
    validateWebhookSignature(samplePayload, genericHmac, realSecret, 'generic') === true,
    'Test 5a: Generic provider validates HMAC-SHA256 correctly'
  );
  assert(
    validateWebhookSignature(samplePayload, realToken, realSecret, 'generic') === false,
    'Test 5b: Generic provider rejects static token'
  );

  // Test 6: Missing secret or missing signature handling
  assert(
    validateWebhookSignature(samplePayload, '', realSecret, 'delhivery') === false,
    'Test 6a: Missing signature returns false'
  );
  assert(
    validateWebhookSignature(samplePayload, realToken, '', 'delhivery') === false,
    'Test 6b: Missing secret returns false'
  );

  if (failed) {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL WEBHOOK SIGNATURE TESTS PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runTests();

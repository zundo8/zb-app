import { validateWebhookSignature } from '../lib/services/logistics';
import * as crypto from 'crypto';

function runTests() {
  console.log('--- RUNNING WEBHOOK SIGNATURE REGRESSION TESTS ---');
  
  const payload = JSON.stringify({ test: 'data', amount: 100 });
  const secret = 'super-secret-key-123';
  
  // Generate correct signature
  const correctHmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  let failed = false;

  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  };

  // Case 1: Valid HMAC-SHA256 signature -> returns true
  assert(
    validateWebhookSignature(payload, correctHmac, secret, 'generic') === true,
    'Valid HMAC signature should validate'
  );

  // Case 2: Tampered payload with valid-for-original-payload signature -> returns false
  const tamperedPayload = JSON.stringify({ test: 'data', amount: 999 });
  assert(
    validateWebhookSignature(tamperedPayload, correctHmac, secret, 'generic') === false,
    'Tampered payload should fail validation'
  );

  // Case 3: Signature with sha256= prefix -> still validates correctly after stripping
  assert(
    validateWebhookSignature(payload, `sha256=${correctHmac}`, secret, 'generic') === true,
    'Signature with sha256= prefix should validate'
  );

  // Case 4: Signature with Bearer prefix -> still validates correctly after stripping (specifically Delhivery plain comparison)
  assert(
    validateWebhookSignature('', `Bearer ${secret}`, secret, 'delhivery') === true,
    'Delhivery validation with Bearer prefix should validate'
  );

  // Case 5: Delhivery plain signature -> validates
  assert(
    validateWebhookSignature('', secret, secret, 'delhivery') === true,
    'Delhivery validation without prefix should validate'
  );

  // Case 6: Missing secret or missing signature -> returns false without throwing
  try {
    assert(
      validateWebhookSignature(payload, correctHmac, '', 'generic') === false,
      'Missing secret should return false'
    );
    assert(
      validateWebhookSignature(payload, '', secret, 'generic') === false,
      'Missing signature should return false'
    );
  } catch (err: any) {
    assert(false, `Missing secret/signature threw an error: ${err.message}`);
  }

  // Case 7: Invalid/mismatched signature lengths or formats should not throw
  try {
    assert(
      validateWebhookSignature(payload, 'short-sig', secret, 'generic') === false,
      'Mismatched signature length should return false without throwing'
    );
  } catch (err: any) {
    assert(false, `Mismatched signature length threw an error: ${err.message}`);
  }

  if (failed) {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runTests();

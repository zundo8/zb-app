/**
 * Razorpay singleton instance with startup validation.
 *
 * PRODUCTION CHECKLIST:
 * - Switch from rzp_test_ to rzp_live_ keys
 * - Set webhook URL in Razorpay Dashboard → Webhooks
 * - Enable events: payment.captured, payment.failed, refund.created
 * - Set RAZORPAY_WEBHOOK_SECRET from Dashboard
 * - Test with ₹1 live transaction before go-live
 */
import Razorpay from 'razorpay';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error(
    '⚠️  RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables.\n' +
    '   Payment routes will fail until these are configured.\n' +
    '   Set them in .env.local or your deployment environment.'
  );
}

const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

export { razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET };

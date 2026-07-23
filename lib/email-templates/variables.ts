/**
 * Canonical variable registry for email templates.
 *
 * Every variable that can appear inside a {{...}} token in an email template
 * is listed here with its group, human-readable label, and a sample value
 * used for live preview rendering.
 */

export interface EmailVariable {
  key: string;
  label: string;
  group: string;
  sampleValue: string;
}

// ── Sample HTML blocks used for preview ─────────────────────────────────────

const SAMPLE_ITEMS_HTML = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
  <tr>
    <td width="88" valign="top" style="padding-right:16px;">
      <div style="width:88px; height:88px; background:#1a1a1a; border-radius:1px;"></div>
    </td>
    <td valign="middle" style="color:rgba(255,255,255,0.55); font-family:'DM Mono','Courier New',monospace;">
      <p style="margin:0 0 4px; font-size:11px; color:rgba(255,255,255,0.85);">Oversized Obsidian Blazer</p>
      <p style="margin:0 0 4px; font-size:10px; color:rgba(255,255,255,0.4);">Size M</p>
      <p style="margin:0; font-size:10px; color:rgba(255,255,255,0.4);">Qty: 1 &nbsp;·&nbsp; ₹4,500</p>
    </td>
  </tr>
</table>
<div style="height:1px; background:rgba(255,255,255,0.05); margin-bottom:16px;"></div>`;

const SAMPLE_PRODUCTS_GRID = `<p style="color:rgba(255,255,255,0.3); font-family:'DM Mono',monospace; font-size:11px;">Collection preview loads on send.</p>`;

// ── Variable definitions ────────────────────────────────────────────────────

export const EMAIL_VARIABLES: EmailVariable[] = [
  // Customer
  { key: 'customerName', label: 'Customer Name', group: 'Customer', sampleValue: 'Aria' },
  { key: 'customerEmail', label: 'Customer Email', group: 'Customer', sampleValue: 'aria@example.com' },

  // Order
  { key: 'orderId', label: 'Order ID', group: 'Order', sampleValue: 'ZB-10294' },
  { key: 'orderDate', label: 'Order Date', group: 'Order', sampleValue: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }) },
  { key: 'orderStatusUrl', label: 'Order Status URL', group: 'Order', sampleValue: 'https://zicabella.com/orders/ZB-10294' },

  // Money
  { key: 'totalPrice', label: 'Total Price', group: 'Money', sampleValue: '₹4,500' },
  { key: 'total', label: 'Total (with currency)', group: 'Money', sampleValue: '₹4,500 INR' },
  { key: 'subtotal', label: 'Subtotal', group: 'Money', sampleValue: '₹4,200' },
  { key: 'shipping', label: 'Shipping Cost', group: 'Money', sampleValue: '₹300' },
  { key: 'amount', label: 'Amount', group: 'Money', sampleValue: '₹4,500' },

  // Items
  { key: 'itemsHtml', label: 'Items Block (HTML)', group: 'Items', sampleValue: SAMPLE_ITEMS_HTML },

  // Variants
  { key: 'variants', label: 'Variants (size/color)', group: 'Variants', sampleValue: 'Size M / Obsidian' },

  // Payment
  { key: 'paymentMethod', label: 'Payment Method', group: 'Payment', sampleValue: 'Prepaid' },

  // Shipping / Tracking
  { key: 'trackingUrl', label: 'Tracking URL', group: 'Shipping', sampleValue: 'https://zicabella.com/track?id=TRACK123' },
  { key: 'trackingNumber', label: 'Tracking Number', group: 'Shipping', sampleValue: 'TRACK123' },
  { key: 'courier', label: 'Courier', group: 'Shipping', sampleValue: 'Delhivery' },
  { key: 'carrier', label: 'Carrier', group: 'Shipping', sampleValue: 'Delhivery' },

  // Address
  { key: 'shippingAddress', label: 'Full Shipping Address', group: 'Address', sampleValue: '42 MG Road, Indiranagar\nBangalore, KA 560038\nIndia' },
  { key: 'shippingAddressLine1', label: 'Address Line 1', group: 'Address', sampleValue: '42 MG Road, Indiranagar' },
  { key: 'shippingCity', label: 'City', group: 'Address', sampleValue: 'Bangalore' },
  { key: 'shippingState', label: 'State', group: 'Address', sampleValue: 'Karnataka' },
  { key: 'shippingZip', label: 'ZIP / Postal Code', group: 'Address', sampleValue: '560038' },
  { key: 'shippingCountry', label: 'Country', group: 'Address', sampleValue: 'India' },

  // Returns
  { key: 'reason', label: 'Return/Cancel Reason', group: 'Returns', sampleValue: 'Requested by customer' },
  { key: 'reviewUrl', label: 'Review URL', group: 'Returns', sampleValue: 'https://zicabella.com/reviews' },

  // Marketing / Collection
  { key: 'collectionName', label: 'Collection Name', group: 'Marketing', sampleValue: 'Midnight Mirage' },
  { key: 'collectionEditorialLine', label: 'Editorial Line', group: 'Marketing', sampleValue: 'Effortless warmth, considered detail.' },
  { key: 'collectionUrl', label: 'Collection URL', group: 'Marketing', sampleValue: 'https://zicabella.com/collections/midnight-mirage' },
  { key: 'productsGrid', label: 'Products Grid (HTML)', group: 'Marketing', sampleValue: SAMPLE_PRODUCTS_GRID },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a map of variable key → sampleValue for fast lookup. */
function buildSampleMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of EMAIL_VARIABLES) {
    map[v.key] = v.sampleValue;
  }
  return map;
}

const sampleMap = buildSampleMap();

/**
 * Render preview HTML by replacing all known {{variable}} tokens with their
 * sample values, then stripping any remaining unresolved {{...}} tokens.
 *
 * This is the single shared implementation used by both the Create and Edit
 * modals, as well as the TemplatePreviewModal.
 */
export function renderPreviewHtml(html: string): string {
  let result = html;

  // Replace all known variables with their sample values
  for (const [key, value] of Object.entries(sampleMap)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Also handle courierName alias (present in TemplatePreviewModal)
  result = result.replace(/\{\{courierName\}\}/g, sampleMap['courier'] || '');

  // Strip any remaining unresolved {{...}} tokens
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

/**
 * Return unique group names in the order they first appear in EMAIL_VARIABLES.
 */
export function getVariableGroups(): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const v of EMAIL_VARIABLES) {
    if (!seen.has(v.group)) {
      seen.add(v.group);
      groups.push(v.group);
    }
  }
  return groups;
}

/**
 * Return variables filtered by group.
 */
export function getVariablesByGroup(group: string): EmailVariable[] {
  return EMAIL_VARIABLES.filter(v => v.group === group);
}

/**
 * Extract {{...}} tokens from an HTML string and return a list of unresolved
 * variable keys (i.e. keys NOT in the canonical registry, or keys that have
 * no value supplied).
 */
export function findUnresolvedVariables(
  html: string,
  suppliedValues: Record<string, string> = {}
): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const found: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const key = match[1].trim();
    if (!suppliedValues[key]) {
      found.push(key);
    }
  }
  return Array.from(new Set(found));
}

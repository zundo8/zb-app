/**
 * Shared automation trigger definitions.
 *
 * Moved here from TemplatesTab.tsx so both TemplatesTab and AutomationsTab
 * (and any future consumer) import from a single source of truth.
 */

export interface AutomationTrigger {
  value: string;
  label: string;
  description: string;
}

export const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  { value: '', label: 'None (Manual Send Only)', description: 'No automatic trigger — template is only sent manually via Compose.' },
  { value: 'ORDER_CONFIRMATION', label: 'Order Confirmation', description: 'Auto-send when a new order is placed.' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled', description: 'Auto-send when an order is cancelled.' },
  { value: 'PAYMENT_FAILED', label: 'Payment Failed', description: 'Auto-send when a payment attempt fails.' },
  { value: 'WELCOME', label: 'Welcome Email', description: 'Auto-send when a new customer signs up.' },
  { value: 'ORDER_SHIPPED', label: 'Order Shipped', description: 'Auto-send when an order is marked as shipped.' },
  { value: 'ORDER_DELIVERED', label: 'Order Delivered', description: 'Auto-send when an order is delivered.' },
  { value: 'RETURN_REFUND', label: 'Return & Refund', description: 'Auto-send when a return/refund is processed.' },
  { value: 'PASSWORD_RESET', label: 'Password Reset', description: 'Auto-send when a password reset is requested.' },
];

/** Only the triggers that actually map to automated lifecycle events (excludes the empty "None" entry). */
export const ACTIVE_TRIGGERS = AUTOMATION_TRIGGERS.filter(t => t.value !== '');

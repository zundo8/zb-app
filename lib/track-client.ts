/**
 * Client-side helper to post event tracking to our backend API
 */
export async function trackStorefrontEvent(eventName: string, data: {
  customerId?: string | null;
  customerPhone?: string | null;
  orderId?: string | null;
  productId?: string | null;
  metadata?: any;
}) {
  try {
    // Check if a Click-to-WhatsApp Click ID (ctwa_clid) is saved in local storage or cookies
    let ctwa_clid = '';
    if (typeof window !== 'undefined') {
      ctwa_clid = localStorage.getItem('ctwa_clid') || '';
    }

    const payload = {
      eventName,
      customerId: data.customerId || null,
      customerPhone: data.customerPhone || null,
      orderId: data.orderId || null,
      productId: data.productId || null,
      eventSource: 'web',
      metadata: {
        ...data.metadata,
        ctwa_clid: ctwa_clid || undefined
      }
    };

    fetch('/api/whatsapp-events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('[Tracker Client] Event log delivery failed:', err.message));
  } catch (e: any) {
    console.warn('[Tracker Client] Event queueing error:', e.message);
  }
}

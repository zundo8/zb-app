import prisma from '@/lib/db';
import { createOrder, createCustomer } from '@/lib/shopify-admin';

export interface SyncResult {
  success: boolean;
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  error?: string;
}

/**
 * Syncs a local Order to Shopify Admin API.
 * Ensures partially_paid status, upfront deposit transaction (₹99 for COD),
 * sanitized customer email, and proper tags/note_attributes.
 */
export async function syncOrderToShopify(orderId: string): Promise<SyncResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      return { success: false, error: `Order ${orderId} not found` };
    }

    // Skip if already synced to Shopify (real numeric id)
    if (order.shopifyOrderId && /^\d+$/.test(String(order.shopifyOrderId))) {
      return {
        success: true,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderName: order.shopifyOrderName || undefined,
      };
    }

    const isCod = (order.paymentMethod || '').toLowerCase().trim() === 'cod' ||
      order.paymentStatus === 'partially_paid' ||
      order.paymentStatus === 'cod_upfront_paid' ||
      (order.tags || '').toLowerCase().includes('cod');

    const universalOrderNumber = order.internalOrderNumber || `ZB${order.id.slice(-6).toUpperCase()}`;

    // Parse shipping address
    let shippingAddress: any = {};
    try {
      shippingAddress = typeof order.shippingAddress === 'string'
        ? JSON.parse(order.shippingAddress)
        : order.shippingAddress || {};
    } catch {
      shippingAddress = {};
    }

    // Resolve or sync Shopify customer
    let shopifyCustomerId = order.customer?.shopifyId;
    if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_') || shopifyCustomerId.startsWith('apple_') || shopifyCustomerId.startsWith('mobile_')) {
      try {
        const customerName = order.customer?.name || shippingAddress?.name || 'Customer';
        const nameParts = String(customerName).trim().split(' ');
        const customerEmail = order.customer?.email || shippingAddress?.email || '';
        const customerPhone = order.customer?.phone || shippingAddress?.phone || '';

        const sCustomer = await createCustomer({
          first_name: nameParts[0] || 'Customer',
          last_name: nameParts.slice(1).join(' ') || '.',
          ...(customerEmail && customerEmail.includes('@') ? { email: customerEmail } : {}),
          ...(customerPhone ? { phone: customerPhone } : {}),
          verified_email: Boolean(customerEmail && customerEmail.includes('@')),
        });

        shopifyCustomerId = sCustomer.id.toString();
        if (order.customerId) {
          await prisma.customer.update({
            where: { id: order.customerId },
            data: { shopifyId: shopifyCustomerId },
          });
        }
      } catch (custErr: any) {
        console.warn(`[ShopifyOrderSync] Customer creation fallback skipped: ${custErr.message}`);
      }
    }

    // Format line items
    const shopifyLineItems = (order.items || []).map((item: any) => {
      const sku = item.sku || '';
      const m = sku.match(/variant:(\d+)/i);
      if (m?.[1]) {
        return {
          variant_id: parseInt(m[1], 10),
          quantity: item.quantity,
        };
      }

      const rawId = sku.split('/').pop() || '';
      if (/^\d+$/.test(rawId)) {
        return {
          variant_id: parseInt(rawId, 10),
          quantity: item.quantity,
        };
      }

      return {
        title: item.title,
        quantity: item.quantity,
        price: Number(item.price || 0).toFixed(2),
        requires_shipping: true,
      };
    });

    const parsedCustomerId = shopifyCustomerId && /^\d+$/.test(shopifyCustomerId)
      ? parseInt(shopifyCustomerId, 10)
      : null;

    const codUpfrontPaid = Number(order.codUpfrontPaid) || 99;
    const codBalanceDue = Math.max(0, Number(order.totalPrice || 0) - codUpfrontPaid);
    const resolvedMethodTag = isCod ? 'COD' : 'Prepaid, Razorpay';
    const emailToUse = order.customer?.email || shippingAddress?.email || '';

    const shopifyOrderPayload: any = {
      line_items: shopifyLineItems,
      ...(emailToUse && emailToUse.includes('@') ? { email: emailToUse } : {}),
      send_receipt: false,
      send_fulfillment_receipt: false,
      financial_status: isCod ? 'partially_paid' : (order.paymentStatus === 'paid' ? 'paid' : 'pending'),
      note: isCod
        ? `COD Order from Web Store - ₹${codUpfrontPaid} upfront fee paid via Razorpay (Payment ID: ${order.razorpayPaymentId || 'N/A'}) | InternalOrderId: ${order.id}`
        : `Paid via Razorpay from Web Store (Payment ID: ${order.razorpayPaymentId || 'N/A'}) | InternalOrderId: ${order.id}`,
      tags: `WebStoreOrder, WebStore, ${resolvedMethodTag}, zb-order-${universalOrderNumber}`,
      note_attributes: [
        { name: 'internal_order_number', value: universalOrderNumber },
        { name: 'payment_method', value: isCod ? 'COD' : 'PREPAID' },
        { name: 'razorpay_payment_id', value: order.razorpayPaymentId || '' },
        ...(isCod ? [
          { name: 'cod_upfront_fee', value: String(codUpfrontPaid) },
          { name: 'cod_balance_due', value: codBalanceDue.toFixed(2) },
        ] : []),
      ],
      total_tax: 0,
      currency: order.currency || 'INR',
    };

    if (shippingAddress?.name || shippingAddress?.street || shippingAddress?.address1) {
      const nameParts = String(shippingAddress.name || order.customer?.name || '').trim().split(' ');
      const addrPayload = {
        first_name: nameParts[0] || 'Customer',
        last_name: nameParts.slice(1).join(' ') || '.',
        address1: shippingAddress.street || shippingAddress.address1 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.state || shippingAddress.province || '',
        zip: shippingAddress.zip || shippingAddress.pincode || '',
        country: shippingAddress.country || 'India',
        phone: shippingAddress.phone || order.customer?.phone || '',
      };
      shopifyOrderPayload.shipping_address = addrPayload;
      shopifyOrderPayload.billing_address = addrPayload;
    }

    if (shippingAddress?.phone || order.customer?.phone) {
      shopifyOrderPayload.phone = shippingAddress.phone || order.customer?.phone;
    }

    if (parsedCustomerId) {
      shopifyOrderPayload.customer = { id: parsedCustomerId };
    }

    // Add transactions
    if (isCod) {
      shopifyOrderPayload.transactions = [{
        kind: 'sale',
        status: 'success',
        amount: codUpfrontPaid.toFixed(2),
        currency: order.currency || 'INR',
        gateway: 'razorpay',
        authorization: order.razorpayPaymentId || `cod_upfront_${Date.now()}`,
      }];
    } else if (order.paymentStatus === 'paid') {
      shopifyOrderPayload.transactions = [{
        kind: 'sale',
        status: 'success',
        amount: Number(order.totalPrice || 0).toFixed(2),
        currency: order.currency || 'INR',
        gateway: 'razorpay',
        authorization: order.razorpayPaymentId || `razorpay_${Date.now()}`,
      }];
    }

    // Add discount code if present
    if (order.discountCode && Number(order.discountAmount) > 0) {
      shopifyOrderPayload.discount_codes = [{
        code: order.discountCode,
        amount: Number(order.discountAmount).toFixed(2),
        type: 'fixed_amount',
      }];
    }

    const createdOrder = await createOrder(shopifyOrderPayload);
    const shopifyOrderId = String(createdOrder.id);
    const shopifyOrderName = createdOrder.name || null;

    // Update local Order
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyOrderId,
        shopifyOrderName,
        shopifySyncStatus: 'synced',
        shopifySyncError: null,
      },
    });

    // Update WebStoreOrder
    await prisma.webStoreOrder.updateMany({
      where: {
        OR: [
          { orderNumber: universalOrderNumber },
          ...(order.razorpayOrderId ? [{ razorpayOrderId: order.razorpayOrderId }] : []),
        ],
      },
      data: {
        notes: `Shopify: ${shopifyOrderName || shopifyOrderId} | Local: ${order.id}`,
      },
    });

    console.log(`[ShopifyOrderSync] Successfully synced order ${order.id} (${universalOrderNumber}) -> Shopify ${shopifyOrderName || shopifyOrderId}`);

    return {
      success: true,
      shopifyOrderId,
      shopifyOrderName: shopifyOrderName || undefined,
    };
  } catch (err: any) {
    console.error(`[ShopifyOrderSync] Failed to sync order ${orderId} to Shopify:`, err.message);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopifySyncStatus: 'failed',
        shopifySyncError: err.message,
      },
    }).catch(() => {});

    return {
      success: false,
      error: err.message,
    };
  }
}

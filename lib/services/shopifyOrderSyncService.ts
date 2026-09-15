import prisma from '@/lib/db';
import { createOrder, createCustomer, findShopifyOrderByInternalNumber } from '@/lib/shopify-admin';

export interface SyncOptions {
  extraTags?: string[];
  preserveAppTags?: boolean;
}

export interface SyncResult {
  success: boolean;
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  error?: string;
  skippedDuplicate?: boolean;
}

/**
 * Syncs a local Order to Shopify Admin API.
 * 
 * Guarantees:
 * - Atomic compare-and-set claim on shopifySyncStatus ('syncing') to prevent concurrent duplicate syncs.
 * - Stale claim auto-recovery (> 5 minutes).
 * - Pre-creation existence check in Shopify (findShopifyOrderByInternalNumber) to prevent re-creation.
 * - Shopify-side idempotency key via universal internalOrderNumber.
 * - Always releases the 'syncing' lock in finally (synced on success, failed on error).
 */
export async function syncOrderToShopify(orderId: string, options?: SyncOptions): Promise<SyncResult> {
  // 1. Fast path: check if already synced (real numeric id)
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shopifyOrderId: true,
      shopifyOrderName: true,
      shopifySyncStatus: true,
    },
  });

  if (!existing) {
    return { success: false, error: `Order ${orderId} not found` };
  }

  if (existing.shopifyOrderId && /^\d+$/.test(String(existing.shopifyOrderId))) {
    return {
      success: true,
      shopifyOrderId: existing.shopifyOrderId,
      shopifyOrderName: existing.shopifyOrderName || undefined,
    };
  }

  // 2. ATOMIC CLAIM: Only one caller can flip status -> 'syncing' while shopifyOrderId is null.
  // Stale claim recovery: if an order got stuck in 'syncing' > 5 minutes ago, allow reclaiming.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const claim = await prisma.order.updateMany({
    where: {
      id: orderId,
      shopifyOrderId: null,
      OR: [
        { shopifySyncStatus: { not: 'syncing' } },
        { updatedAt: { lt: fiveMinutesAgo } },
      ],
    },
    data: {
      shopifySyncStatus: 'syncing',
      shopifySyncError: null,
    },
  });

  if (claim.count === 0) {
    // Another process is syncing (or just finished). Re-read to return winner's result if done.
    const after = await prisma.order.findUnique({
      where: { id: orderId },
      select: { shopifyOrderId: true, shopifyOrderName: true },
    });
    if (after?.shopifyOrderId && /^\d+$/.test(String(after.shopifyOrderId))) {
      return {
        success: true,
        shopifyOrderId: after.shopifyOrderId,
        shopifyOrderName: after.shopifyOrderName || undefined,
      };
    }
    return {
      success: false,
      error: 'Order sync already in progress (claimed by another process)',
      skippedDuplicate: true,
    };
  }

  // 3. We won the atomic claim. Proceed to build payload and sync.
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found after claiming`);
    }

    const universalOrderNumber = order.internalOrderNumber || `ZB${order.id.slice(-6).toUpperCase()}`;

    // 4. FIX 4: Pre-create existence check in Shopify (self-heal linking)
    const existingShopifyOrder = await findShopifyOrderByInternalNumber(universalOrderNumber);
    if (existingShopifyOrder && existingShopifyOrder.id) {
      const foundShopifyOrderId = String(existingShopifyOrder.id);
      const foundShopifyOrderName = existingShopifyOrder.name || null;

      await prisma.order.update({
        where: { id: order.id },
        data: {
          shopifyOrderId: foundShopifyOrderId,
          shopifyOrderName: foundShopifyOrderName,
          shopifySyncStatus: 'synced',
          shopifySyncError: null,
        },
      });

      console.log(`[ShopifyOrderSync] Self-healed & linked pre-existing Shopify order ${foundShopifyOrderName || foundShopifyOrderId} for order ${order.id} (${universalOrderNumber})`);

      return {
        success: true,
        shopifyOrderId: foundShopifyOrderId,
        shopifyOrderName: foundShopifyOrderName || undefined,
      };
    }

    const isCod = (order.paymentMethod || '').toLowerCase().trim() === 'cod' ||
      order.paymentStatus === 'partially_paid' ||
      order.paymentStatus === 'cod_upfront_paid' ||
      (order.tags || '').toLowerCase().includes('cod');

    const isApp = order.orderType === 'APP' ||
      (order.tags || '').includes('AppOrder') ||
      (order.tags || '').includes('MobileApp') ||
      Boolean(options?.preserveAppTags);

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
    if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_') || shopifyCustomerId.startsWith('apple_') || shopifyCustomerId.startsWith('mobile_') || shopifyCustomerId.startsWith('GUEST_')) {
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

    // Build consolidated tags
    const mergedTags = new Set<string>();
    const baseSource = isApp ? 'AppOrder, MobileApp' : 'WebStoreOrder, WebStore';
    baseSource.split(',').map(t => t.trim()).filter(Boolean).forEach(t => mergedTags.add(t));
    resolvedMethodTag.split(',').map(t => t.trim()).filter(Boolean).forEach(t => mergedTags.add(t));
    mergedTags.add(`zb-order-${universalOrderNumber}`);
    mergedTags.add(`zb_uid:${universalOrderNumber}`);

    if (order.status === 'approved' || options?.preserveAppTags) {
      mergedTags.add('Approved');
    }
    if (options?.extraTags) {
      options.extraTags.forEach((t: string) => mergedTags.add(t));
    }
    if (order.tags) {
      order.tags.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => {
        if (!t.startsWith('zb-order-') && !t.startsWith('zb_uid:')) {
          mergedTags.add(t);
        }
      });
    }

    const shopifyOrderPayload: any = {
      line_items: shopifyLineItems,
      ...(emailToUse && emailToUse.includes('@') ? { email: emailToUse } : {}),
      send_receipt: false,
      send_fulfillment_receipt: false,
      financial_status: isCod ? 'partially_paid' : (order.paymentStatus === 'paid' ? 'paid' : 'pending'),
      note: isCod
        ? `COD Order from ${isApp ? 'Mobile App' : 'Web Store'} - ₹${codUpfrontPaid} upfront fee paid via Razorpay (Payment ID: ${order.razorpayPaymentId || 'N/A'}) | InternalOrderId: ${order.id}`
        : `Paid via Razorpay from ${isApp ? 'Mobile App' : 'Web Store'} (Payment ID: ${order.razorpayPaymentId || 'N/A'}) | InternalOrderId: ${order.id}`,
      tags: Array.from(mergedTags).join(', '),
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
    } else if (order.paymentStatus === 'paid' || (order.paymentMethod !== 'COD' && order.paymentMethod !== 'cod' && Number(order.totalPrice || 0) > 0)) {
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

    const createdOrder = await createOrder(shopifyOrderPayload, {
      idempotencyKey: universalOrderNumber,
    });
    const shopifyOrderId = String(createdOrder.id);
    const shopifyOrderName = createdOrder.name || null;

    // Update local Order to synced
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyOrderId,
        shopifyOrderName,
        shopifySyncStatus: 'synced',
        shopifySyncError: null,
      },
    });

    // Update WebStoreOrder notes if applicable
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

    // FIX 4: Self-heal check on error in case the order actually got created in Shopify before network timeout
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { internalOrderNumber: true },
      });
      const orderNum = order?.internalOrderNumber;
      if (orderNum) {
        const found = await findShopifyOrderByInternalNumber(orderNum);
        if (found && found.id) {
          const recoveredId = String(found.id);
          const recoveredName = found.name || null;
          await prisma.order.update({
            where: { id: orderId },
            data: {
              shopifyOrderId: recoveredId,
              shopifyOrderName: recoveredName,
              shopifySyncStatus: 'synced',
              shopifySyncError: null,
            },
          });
          console.log(`[ShopifyOrderSync] Self-healed after catch error: linked Shopify order ${recoveredName || recoveredId}`);
          return {
            success: true,
            shopifyOrderId: recoveredId,
            shopifyOrderName: recoveredName || undefined,
          };
        }
      }
    } catch (healErr: any) {
      console.warn(`[ShopifyOrderSync] Post-error self-heal check failed:`, healErr.message);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopifySyncStatus: 'failed',
        shopifySyncError: err.message?.slice(0, 500),
      },
    }).catch(() => {});

    return {
      success: false,
      error: err.message,
    };
  } finally {
    // Guarantees an order is NEVER stranded in 'syncing' status
    try {
      const check = await prisma.order.findUnique({
        where: { id: orderId },
        select: { shopifySyncStatus: true, shopifyOrderId: true },
      });
      if (check && check.shopifySyncStatus === 'syncing') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            shopifySyncStatus: check.shopifyOrderId ? 'synced' : 'failed',
            shopifySyncError: check.shopifyOrderId ? null : 'Sync exited unexpectedly while syncing',
          },
        });
      }
    } catch (_) {}
  }
}

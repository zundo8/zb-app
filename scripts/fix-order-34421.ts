import prisma, { getShopSettings } from '../lib/db';

async function fixOrder34421() {
  console.log('--- Starting Fix for Order ZB-2608-34421 ---');

  const orderNumber = 'ZB-2608-34421';
  const razorpayPaymentId = 'pay_TLmMFnNfmlUuzq';
  const razorpayOrderId = 'order_TLmM5q1q4zwDnE';
  const upfrontAmount = '99';

  // 1. Fix WebStoreOrder
  const wsOrder = await prisma.webStoreOrder.findFirst({
    where: { OR: [{ orderNumber }, { razorpayOrderId }] }
  });

  if (wsOrder) {
    const updatedWs = await prisma.webStoreOrder.update({
      where: { id: wsOrder.id },
      data: {
        paymentStatus: 'cod_upfront_paid',
        paymentMethod: 'cod',
        codUpfrontPaid: upfrontAmount,
        codUpfrontPaymentId: razorpayPaymentId,
        razorpayPaymentId: razorpayPaymentId,
        notes: `COD Order (₹${upfrontAmount} upfront fee paid via Razorpay) | Shopify: 7306861445401 | Local: cmsey47d304yw0ua8ze5u1uuk`
      }
    });
    console.log('✅ WebStoreOrder updated successfully:', updatedWs.id, updatedWs.orderNumber);
  } else {
    console.warn('⚠️ WebStoreOrder not found for orderNumber:', orderNumber);
  }

  // 2. Fix main Order table
  const mainOrder = await prisma.order.findFirst({
    where: { internalOrderNumber: orderNumber }
  });

  if (mainOrder) {
    // Clean tags: remove "payment_pending" and "Order creation in process"
    const cleanedTags = (mainOrder.tags || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => Boolean(t) && t !== 'payment_pending' && t !== 'Order creation in process')
      .concat(['cod_upfront_paid'])
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');

    const updatedMain = await prisma.order.update({
      where: { id: mainOrder.id },
      data: {
        paymentStatus: 'cod_upfront_paid',
        paymentMethod: 'cod',
        razorpayPaymentId: razorpayPaymentId,
        tags: cleanedTags,
        note: `COD Order (₹${upfrontAmount} upfront fee paid via Razorpay - Payment ID: ${razorpayPaymentId}) | InternalOrderId: ${mainOrder.id}`
      }
    });
    console.log('✅ Main Order updated successfully:', updatedMain.id, updatedMain.internalOrderNumber);
  } else {
    console.warn('⚠️ Main Order not found for orderNumber:', orderNumber);
  }

  // 3. Update Shopify Order 7306861445401 (#ZB71912)
  const shopSettings = await getShopSettings();
  const shopifyDomain = shopSettings.domain;
  const accessToken = shopSettings.accessToken;

  if (shopifyDomain && accessToken) {
    try {
      const shopifyOrderId = '7306861445401';
      // Fetch current shopify order
      const getRes = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
      });
      const shopifyData = await getRes.json();
      const currentTags = shopifyData.order?.tags || '';

      const newTags = currentTags
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => Boolean(t) && t !== 'payment_pending' && t !== 'Order creation in process')
        .concat(['cod_upfront_paid'])
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        .join(', ');

      const updateRes = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order: {
            id: shopifyOrderId,
            tags: newTags,
            note: `COD Order - ₹${upfrontAmount} upfront fee paid via Razorpay (Payment ID: ${razorpayPaymentId}) | InternalOrderNumber: ${orderNumber}`
          }
        })
      });

      if (updateRes.ok) {
        console.log('✅ Shopify Order #ZB71912 tags and notes updated successfully!');
      } else {
        const errBody = await updateRes.text();
        console.error('❌ Shopify Order update failed:', updateRes.status, errBody);
      }
    } catch (sErr: any) {
      console.error('❌ Shopify API error:', sErr.message);
    }
  } else {
    console.error('❌ Missing shopify credentials to update shopify order');
  }

  console.log('--- Fix Completed ---');
}

fixOrder34421().catch(console.error).finally(() => process.exit(0));

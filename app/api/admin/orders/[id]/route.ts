import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

function extractSize(orderItem: any): string {
  const sizes = ['XXXL', 'XXL', 'XL', 'XS', 'S', 'M', 'L']; // match longer sizes first (e.g. XXL before L)
  
  // 1. Try to extract from title
  if (orderItem.title) {
    const upperTitle = orderItem.title.toUpperCase();
    
    // Check if there is a ' - ' pattern
    const titleParts = upperTitle.split(' - ');
    if (titleParts.length > 1) {
      const variantPart = titleParts[titleParts.length - 1].trim();
      // If variantPart is something like "BLACK / M"
      const slashParts = variantPart.split('/');
      const finalPart = slashParts[slashParts.length - 1].trim();
      for (const size of sizes) {
        if (finalPart === size || finalPart === `SIZE ${size}`) {
          return size;
        }
      }
    }
    
    // Fallback: check if title ends with size or has "size X" or " - X"
    for (const size of sizes) {
      if (
        upperTitle.endsWith(` ${size}`) || 
        upperTitle.endsWith(`-${size}`) || 
        upperTitle.endsWith(`/${size}`) ||
        upperTitle.includes(` SIZE ${size} `) ||
        upperTitle.endsWith(` SIZE ${size}`)
      ) {
        return size;
      }
    }
  }

  // 2. Try to extract from Shopify SKU (e.g. "HOODIE-M" or "ZB-SWEATER-L")
  if (orderItem.sku) {
    const skuParts = orderItem.sku.split('-');
    const lastPart = skuParts[skuParts.length - 1].toUpperCase().trim();
    if (sizes.includes(lastPart)) {
      return lastPart;
    }
  }

  return '';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    let order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        shipments: {
          orderBy: { createdAt: 'desc' }
        },
        payments: true,
        cartSession: true,
      },
    });

    if (!order) {
      // Check if it's a mobile order
      const mobileOrder = await prisma.mobileOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (mobileOrder) {
        // If the mobile order is already synced, try to find the synced Order
        if (mobileOrder.shopifyOrderId) {
          const syncedOrder = await prisma.order.findFirst({
            where: { shopifyOrderId: mobileOrder.shopifyOrderId },
            include: {
              customer: true,
              items: true,
              shipments: {
                orderBy: { createdAt: 'desc' }
              },
              payments: true,
              cartSession: true,
            }
          });
          if (syncedOrder) {
            return NextResponse.json({ success: true, order: syncedOrder });
          }
        }

        // Format the unsynced MobileOrder to match OrderDetail schema
        const mappedOrder = {
          id: mobileOrder.id,
          shopId: mobileOrder.customer.shopId,
          shopifyOrderId: mobileOrder.shopifyOrderId,
          customerId: mobileOrder.customerId,
          status: mobileOrder.status,
          totalPrice: mobileOrder.totalPrice,
          subtotalPrice: mobileOrder.subtotalPrice || mobileOrder.totalPrice,
          totalTax: mobileOrder.totalTax || 0,
          currency: mobileOrder.currency,
          paymentStatus: mobileOrder.paymentStatus,
          fulfillmentStatus: mobileOrder.fulfillmentStatus,
          deliveryStatus: mobileOrder.deliveryStatus,
          shippingAddress: mobileOrder.shippingAddress,
          billingAddress: mobileOrder.billingAddress,
          note: mobileOrder.note,
          createdAt: mobileOrder.createdAt,
          updatedAt: mobileOrder.updatedAt,
          orderType: 'MOBILE',
          tags: mobileOrder.tags,
          aiRiskRecommendation: null,
          codConfirmationMethod: null,
          codConfirmationStatus: null,
          codConfirmedAt: null,
          paymentCapturedAt: null,
          paymentMethod: mobileOrder.paymentMethod,
          razorpayOrderId: null,
          razorpayPaymentId: mobileOrder.paymentId,
          rtoRiskFactors: null,
          rtoRiskScore: null,
          discountAmount: mobileOrder.discountAmount,
          discountCode: mobileOrder.discountCode,
          customer: mobileOrder.customer,
          items: mobileOrder.items.map((item: any) => ({
            id: item.id,
            orderId: item.mobileOrderId,
            productId: item.productId,
            variantId: item.variantId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            image: item.image || item.product?.featuredImage || null,
          })),
          payments: [],
          shipments: [],
          delhivery_awb: null,
          tracking_status: null,
          internalOrderNumber: mobileOrder.orderNumber,
          shopifyOrderName: mobileOrder.shopifyOrderId ? `#${mobileOrder.shopifyOrderId}` : null,
          shopifySyncStatus: mobileOrder.shopifyOrderId ? 'synced' : 'pending',
          shopifySyncError: null,
          refundStatus: 'not_applicable',
          refundError: null,
          refundAttempts: 0,
        };
        return NextResponse.json({ success: true, order: mappedOrder });
      }
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('[Admin Order Detail API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    let isMobileOrder = false;
    let oldOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true, deliveryStatus: true, customerId: true, paymentStatus: true }
    });

    if (!oldOrder) {
      const oldMobileOrder = await prisma.mobileOrder.findUnique({
        where: { id },
        select: { status: true, deliveryStatus: true, customerId: true, paymentStatus: true }
      });
      if (oldMobileOrder) {
        oldOrder = oldMobileOrder as any;
        isMobileOrder = true;
      }
    }

    if (!oldOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Handle individual OrderItem SKU updates if provided
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.id && 'sku' in item) {
          // Fetch the OrderItem or MobileOrderItem to validate
          const orderItem = isMobileOrder
            ? await prisma.mobileOrderItem.findUnique({ where: { id: item.id } })
            : await prisma.orderItem.findUnique({ where: { id: item.id } });
          
          if (!orderItem) {
            return NextResponse.json({ success: false, error: 'Order item not found' }, { status: 404 });
          }

          const oldSku = orderItem.sku;
          const newSku = item.sku ? item.sku.trim() : '';

          // If changing SKU (restoring previous SKU or swapping)
          if (oldSku && oldSku.trim().toUpperCase() !== newSku.toUpperCase()) {
            const normalizedOldSku = oldSku.trim().toUpperCase();
            try {
              // Find if the old SKU exists in product_skus
              const oldSkuRecords: any[] = await prisma.$queryRawUnsafe(
                `SELECT * FROM product_skus WHERE UPPER(sku) = $1`,
                normalizedOldSku
              );
              
              if (oldSkuRecords.length > 0) {
                const skuRec = oldSkuRecords[0];
                // Restore old SKU status to IN_STOCK and quantity to 1
                await prisma.$executeRawUnsafe(
                  `UPDATE product_skus SET status = 'IN_STOCK', quantity = 1 WHERE id = $1`,
                  skuRec.id
                );
                
                // Increment Shopify & local product inventory by 1
                const dbProduct = await prisma.product.findUnique({
                  where: { id: skuRec.product_id },
                  include: { inventory: true }
                });
                
                if (dbProduct && dbProduct.inventoryItemId) {
                  try {
                    const { adjustInventoryLevel, fetchLocations } = await import('@/lib/shopify-admin');
                    const locations = await fetchLocations();
                    const activeLocation = locations.find((l) => l.active) || locations[0];
                    const locationId = activeLocation ? String(activeLocation.id) : null;
                    
                    if (locationId) {
                      const updatedLevel = await adjustInventoryLevel(dbProduct.inventoryItemId, locationId, 1);
                      
                      // Sync local inventory count
                      const localInv = dbProduct.inventory[0];
                      if (localInv) {
                        await prisma.inventory.update({
                          where: { id: localInv.id },
                          data: { stockQuantity: updatedLevel.available ?? (localInv.stockQuantity + 1) }
                        });
                      }
                    }
                  } catch (shopifyErr) {
                    console.error('[Order Patch Old SKU Restore Shopify Error]:', shopifyErr);
                  }
                }
              }
            } catch (dbRestoreErr) {
              console.error('[Order Patch Old SKU Restore DB Error]:', dbRestoreErr);
            }
          }

          // If assigning a new SKU
          if (newSku) {
            const normalizedSku = newSku.toUpperCase();
            
            // Find if this SKU exists in product_skus
            try {
              const skuRecords: any[] = await prisma.$queryRawUnsafe(
                `SELECT * FROM product_skus WHERE UPPER(sku) = $1`,
                normalizedSku
              );
              
              if (skuRecords.length > 0) {
                const skuRec = skuRecords[0];
                
                // 1. Validate Product Mismatch
                if (orderItem.productId !== skuRec.product_id) {
                  const p = await prisma.product.findUnique({ where: { id: skuRec.product_id } });
                  return NextResponse.json({
                    success: false,
                    error: `Product Mismatch: Scanned SKU belongs to "${p?.title || 'a different product'}", not this order item.`
                  }, { status: 400 });
                }
                
                // 2. Validate Size Mismatch
                const itemSize = extractSize(orderItem);
                if (itemSize && itemSize.toUpperCase() !== skuRec.size.toUpperCase()) {
                  return NextResponse.json({
                    success: false,
                    error: `Size Mismatch: Scanned SKU size is "${skuRec.size}", but this order item requires size "${itemSize}".`
                  }, { status: 400 });
                }

                // 3. Validate Status (Prevent double selling)
                if (skuRec.status === 'SOLD') {
                  return NextResponse.json({
                    success: false,
                    error: `SKU Sold: This specific price tag SKU (${newSku}) has already been shipped/sold.`
                  }, { status: 400 });
                }

                // Mark SKU as SOLD in inventory
                await prisma.$executeRawUnsafe(
                  `UPDATE product_skus SET status = 'SOLD', quantity = 0 WHERE id = $1`,
                  skuRec.id
                );
                
                // Decrement overall Shopify & local product inventory by 1
                const dbProduct = await prisma.product.findUnique({
                  where: { id: skuRec.product_id },
                  include: { inventory: true }
                });
                
                if (dbProduct && dbProduct.inventoryItemId) {
                  try {
                    const { adjustInventoryLevel, fetchLocations } = await import('@/lib/shopify-admin');
                    const locations = await fetchLocations();
                    const activeLocation = locations.find((l) => l.active) || locations[0];
                    const locationId = activeLocation ? String(activeLocation.id) : null;
                    
                    if (locationId) {
                      const updatedLevel = await adjustInventoryLevel(dbProduct.inventoryItemId, locationId, -1);
                      
                      // Sync local inventory count
                      const localInv = dbProduct.inventory[0];
                      if (localInv) {
                        await prisma.inventory.update({
                          where: { id: localInv.id },
                          data: { stockQuantity: updatedLevel.available ?? (localInv.stockQuantity - 1) }
                        });
                      }
                    }
                  } catch (shopifyErr) {
                    console.error('[Order Patch Shopify Sync Error]:', shopifyErr);
                  }
                }

                // Record scan activity for ORDER_OUT
                try {
                  await prisma.scanRecord.create({
                    data: {
                      productId: skuRec.product_id,
                      productTitle: dbProduct?.title || 'Order Item SKU Assignment',
                      variantInfo: `Size ${skuRec.size}`,
                      sku: skuRec.sku,
                      actionType: 'ORDER_OUT',
                      quantity: 1,
                      beforeStock: dbProduct ? (dbProduct.inventory[0]?.stockQuantity || 1) : 1,
                      afterStock: dbProduct ? Math.max(0, (dbProduct.inventory[0]?.stockQuantity || 1) - 1) : 0,
                      locationId: 'LOCAL',
                      staffName: 'Admin (Auto)'
                    }
                  });
                } catch (e) {
                  console.error('[Scan Record Create Error]:', e);
                }
              } else {
                return NextResponse.json({
                  success: false,
                  error: `Invalid SKU: The scanned SKU (${newSku}) was not found in the printed tags database.`
                }, { status: 400 });
              }
            } catch (dbErr) {
              console.error('[Order Patch SKU Local DB Query Error]:', dbErr);
              return NextResponse.json({ success: false, error: 'Database verification failed.' }, { status: 500 });
            }
          }

          // Update the OrderItem/MobileOrderItem SKU in database
          if (isMobileOrder) {
            await prisma.mobileOrderItem.update({
              where: { id: item.id },
              data: { sku: item.sku || null }
            });
          } else {
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { sku: item.sku || null }
            });
          }
        }
      }
      delete body.items; // Remove items so they are not updated on Order object directly
    }

    // Auto-cancel sub-statuses if status is set to cancelled
    if (body.status === 'cancelled' && oldOrder.status !== 'cancelled') {
      const deliveryStatusLower = (oldOrder.deliveryStatus || '').toLowerCase();
      const isShippedOrDelivered = ['shipped', 'delivered', 'in transit', 'out for delivery'].includes(deliveryStatusLower);
      
      if (isShippedOrDelivered) {
        return NextResponse.json({ success: false, error: 'Cannot cancel order that is already shipped or delivered' }, { status: 400 });
      }

      body.paymentStatus = oldOrder.paymentStatus === 'paid' ? 'paid' : 'cancelled';
      body.fulfillmentStatus = 'cancelled';
      body.deliveryStatus = 'cancelled';
      body.cancelledAt = new Date();
      body.cancelledBy = 'admin';
      
      if (!isMobileOrder) {
        const order = await prisma.order.findUnique({ where: { id } });
        if (order && order.shopifyOrderId && !order.shopifyOrderId.startsWith('#') && !order.shopifyOrderId.startsWith('app_pending_')) {
          try {
            const { cancelOrder } = await import('@/lib/shopify-admin');
            await cancelOrder(order.shopifyOrderId);
          } catch (shopifyErr) {
            console.error('[Admin Order PATCH] Failed to cancel order in Shopify:', shopifyErr);
          }
        }
      } else {
        const mobOrder = await prisma.mobileOrder.findUnique({ where: { id } });
        if (mobOrder && mobOrder.shopifyOrderId && !mobOrder.shopifyOrderId.startsWith('local_') && !mobOrder.shopifyOrderId.startsWith('app_')) {
          try {
            const { cancelOrder } = await import('@/lib/shopify-admin');
            await cancelOrder(mobOrder.shopifyOrderId);
          } catch (shopifyErr) {
            console.error('[Admin Mobile Order PATCH] Failed to cancel order in Shopify:', shopifyErr);
          }
        }
      }
    }

    let updated;
    if (isMobileOrder) {
      updated = await prisma.mobileOrder.update({
        where: { id },
        data: body,
      });
    } else {
      updated = await prisma.order.update({
        where: { id },
        data: body,
      });
    }

    // Trigger auto refund if order status was set to cancelled
    if (body.status === 'cancelled' && !isMobileOrder) {
      try {
        const { processOrderRefund } = await import('@/lib/services/refundService');
        await processOrderRefund(id);
      } catch (refundErr) {
        console.error('[Admin Order PATCH] Refund processing failed:', refundErr);
      }

      // Restore all custom SKUs assigned to this order's items back to IN_STOCK
      try {
        const { restoreOrderSkus } = await import('@/lib/services/skuService');
        const restoredCount = await restoreOrderSkus(id, 'CANCEL_RESTORE', 'Admin (Cancel)');
        if (restoredCount > 0) {
          console.log(`[Admin Order PATCH] Restored ${restoredCount} SKU(s) for cancelled order ${id}`);
        }
      } catch (skuErr) {
        console.error('[Admin Order PATCH] SKU restoration on cancel failed:', skuErr);
      }
    }

    // Send push notification if status changed
    if (oldOrder && updated.customerId) {
      const statusChanged = body.status && body.status !== oldOrder.status;
      const deliveryChanged = body.deliveryStatus && body.deliveryStatus !== oldOrder.deliveryStatus;

      if (statusChanged || deliveryChanged) {
        try {
          const { NotificationService } = await import('@/lib/services/notification.service');
          let message = 'Your order status has been updated';
          if (deliveryChanged && updated.deliveryStatus === 'delivered') message = 'Your order has been delivered!';
          else if (deliveryChanged && updated.deliveryStatus === 'out_for_delivery') message = 'Your order is out for delivery!';
          else if (statusChanged && updated.status === 'approved') message = 'Your order has been approved and is being processed';

          await NotificationService.sendToUser(
            updated.customerId,
            'Zica Bella Order Update',
            message,
            { orderId: updated.id, status: updated.status, deliveryStatus: updated.deliveryStatus }
          );
          console.log(`[Admin Order PATCH] Push notification sent to user ${updated.customerId}`);
        } catch (pushErr) {
          console.error('[Admin Order PATCH] Push notification failed:', pushErr);
        }

        // Module 3: Automatic Order Email Webhook Trigger (Non-blocking / Fire-and-forget)
        try {
          const localApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com'}/api/orders/status-update`;
          const apiSecret = process.env.INTERNAL_API_SECRET || 'ZB_INTERNAL_SECRET_987654321';
          
          prisma.order.findUnique({
            where: { id: updated.id },
            include: {
              customer: true,
              items: true,
              shipments: { orderBy: { createdAt: 'desc' } }
            }
          }).then((fullOrder: any) => {
            if (fullOrder && fullOrder.customer && fullOrder.customer.email) {
              const latestShipment = fullOrder.shipments?.[0];
              const resolvedStatus = statusChanged ? fullOrder.status : fullOrder.deliveryStatus;
              
              const payload = {
                orderId: fullOrder.id,
                newStatus: resolvedStatus,
                customerEmail: fullOrder.customer.email,
                customerName: fullOrder.customer.name || 'Valued Customer',
                paymentMethod: fullOrder.paymentMethod || undefined,
                items: fullOrder.items.map((i: any) => ({
                  name: i.title,
                  size: i.sku?.split('-')?.pop() || 'M',
                  quantity: i.quantity,
                  price: i.price,
                  image: i.image || null,
                })),
                total: fullOrder.totalPrice,
                currency: fullOrder.currency || 'INR',
                trackingNumber: latestShipment?.trackingNumber || undefined,
                courier: latestShipment?.courier || undefined,
              };

              fetch(localApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-secret': apiSecret,
                },
                body: JSON.stringify(payload),
              })
              .then(res => res.json())
              .then(resData => console.log('[Admin Order Status Trigger] Email status webhook success:', resData))
              .catch((err: any) => console.error('[Admin Order Status Trigger] Email status webhook fetch error:', err));
            }
          }).catch((err: any) => console.error('[Admin Order Status Trigger] Error loading full order for email:', err));
        } catch (emailErr) {
          console.error('[Admin Order Status Trigger] Background email trigger failed:', emailErr);
        }
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { recoverOrphanedRazorpayOrder } from '@/lib/services/razorpayRecoveryService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpayOrderId, razorpayPaymentId, adminCustomItems, customerNote } = body;

    if (!razorpayOrderId) {
      return NextResponse.json(
        { error: 'Missing razorpayOrderId in request body' },
        { status: 400 }
      );
    }

    const result = await recoverOrphanedRazorpayOrder({
      razorpayOrderId,
      razorpayPaymentId,
      adminCustomItems,
      customerNote,
      triggerSource: 'admin_manual',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to recover orphaned payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order created successfully from Razorpay payment',
      orderId: result.orderId,
      internalOrderNumber: result.internalOrderNumber,
    });
  } catch (error: any) {
    console.error('[Admin Recovery Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during order recovery' },
      { status: 500 }
    );
  }
}

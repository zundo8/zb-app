import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processOrderRefund } from '@/lib/services/refundService';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Get session to log email and verify role
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email || 'admin';
    const role = (session.user as any).role;
    
    // Permission check
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const ordersPermission = (session.user as any).permissions?.find((p: any) => p.module === 'ORDERS');
    const canEditOrders = isSuperAdmin || !!ordersPermission?.canEdit;

    if (!canEditOrders) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.status.toLowerCase() !== 'cancelled') {
      return NextResponse.json({ success: false, error: 'Only cancelled orders can be refunded' }, { status: 400 });
    }

    console.log(`[Admin Refund Retry] Manual refund retry triggered by ${email} for Order ${id}`);
    const result = await processOrderRefund(id, email);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message || 'Refund successfully processed' });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Refund execution failed' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Admin Refund Retry API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

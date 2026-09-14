import { NextResponse } from 'next/server';
import { fetchWaybill } from '@/lib/delhivery';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await requireAdmin('LOGISTICS', 'edit');

    const data = await fetchWaybill();
    const waybill = data?.waybill || data;

    await logAudit({
      action: 'WAYBILL_FETCHED',
      module: 'LOGISTICS',
      metadata: { waybill },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Delhivery response might be { waybill: "..." } or similar
    return NextResponse.json({ success: true, waybill });
  } catch (error: any) {
    if (error instanceof Error && (error.message === '401' || error.message === '403')) {
      return handleAuthError(error);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

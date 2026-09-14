import { NextResponse } from 'next/server';
import { getShippingLabel } from '@/lib/delhivery';
import { requireAdmin, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const labelsPayloadSchema = z.object({
  waybills: z.array(z.string().min(1, 'Waybill cannot be empty')).min(1, 'No waybills provided'),
});

export async function POST(req: Request) {
  try {
    await requireAdmin('LOGISTICS', 'edit');

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = labelsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { waybills } = parsed.data;

    // Delhivery supports comma-separated waybills
    const result = await getShippingLabel(waybills, true);
    
    // The response structure might vary slightly, but usually it's result.pdf_url or result.packages[0].pdf_url
    const labelUrl = result.packages_url || result.packages?.[0]?.pdf_download_link || result.packages?.[0]?.pdf_url || result.pdf_download_link || result.pdf_url;

    if (labelUrl) {
      await logAudit({
        action: 'SHIPPING_LABELS_GENERATED',
        module: 'LOGISTICS',
        targetId: waybills.join(','),
        metadata: { waybillCount: waybills.length, labelUrl },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      });

      return NextResponse.json({ success: true, labelUrl });
    } else {
      return NextResponse.json({ success: false, error: 'Label generation failed', details: result });
    }
  } catch (error: any) {
    if (error instanceof Error && (error.message === '401' || error.message === '403')) {
      return handleAuthError(error);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

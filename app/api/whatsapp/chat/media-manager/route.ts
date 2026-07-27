import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET — Fetch all WhatsApp chat media records
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('MARKETING', 'view');

    const { searchParams } = new URL(req.url);
    const mediaType = searchParams.get('type')?.trim().toLowerCase();
    const direction = searchParams.get('direction')?.trim().toLowerCase();
    const phone = searchParams.get('phone')?.trim();
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    const where: any = {
      OR: [
        { mediaUrl: { not: null } },
        { mediaType: { not: null } },
        { body: { contains: '[Media:' } },
        { body: { contains: 'http' } }
      ]
    };

    if (mediaType && mediaType !== 'all') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { mediaType: { contains: mediaType, mode: 'insensitive' } },
            { body: { contains: `[Media: ${mediaType}]`, mode: 'insensitive' } }
          ]
        }
      ];
    }

    if (direction && ['inbound', 'outbound'].includes(direction)) {
      where.direction = direction;
    }

    if (phone) {
      where.phoneNumber = { contains: phone.replace(/\D/g, '').slice(-10) };
    }

    if (search) {
      where.OR = [
        { body: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { waMessageId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, messages] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      })
    ]);

    // Fetch customer details for matched phone numbers
    const last10List: string[] = Array.from(new Set(messages.map((m: any) => m.phoneNumber.replace(/\D/g, '').slice(-10)).filter((p: any) => p && String(p).length === 10))) as string[];
    const customers = last10List.length > 0
      ? await prisma.customer.findMany({
          where: { OR: last10List.map(digit => ({ phone: { contains: digit } })) },
          select: { id: true, name: true, phone: true, email: true }
        }).catch(() => [])
      : [];

    const enrichedMessages = messages.map((m: any) => {
      const conv10 = m.phoneNumber.replace(/\D/g, '').slice(-10);
      const cust = customers.find((c: any) => c.phone && c.phone.replace(/\D/g, '').endsWith(conv10));

      let mUrl = m.mediaUrl || '';
      let mType = m.mediaType || '';

      if (!mUrl && m.body) {
        if (m.body.startsWith('http')) {
          mUrl = m.body.split(/\s+/)[0];
        } else if (m.body.startsWith('[Media:')) {
          const parts = m.body.split(' ');
          if (parts.length > 2 && parts[2].startsWith('http')) {
            mUrl = parts[2];
          }
        }
      }

      if (!mUrl && m.waMessageId) {
        mUrl = `/api/whatsapp/chat/media?mediaId=${m.waMessageId}`;
      }

      if (!mType && mUrl) {
        if (/\.(jpeg|jpg|png|gif|webp)/i.test(mUrl) || mUrl.startsWith('data:image/')) mType = 'image';
        else if (/\.(mp4|mov|avi|webm)/i.test(mUrl)) mType = 'video';
        else if (/\.(mp3|ogg|wav|m4a)/i.test(mUrl)) mType = 'audio';
        else mType = 'document';
      }

      return {
        id: m.id,
        waMessageId: m.waMessageId,
        phoneNumber: m.phoneNumber,
        customerName: cust?.name || 'Customer',
        customerEmail: cust?.email || null,
        direction: m.direction,
        body: m.body,
        mediaUrl: mUrl,
        mediaType: mType || 'media',
        status: m.status,
        createdAt: m.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      media: enrichedMessages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * DELETE — Delete a WhatsApp media message or clear media from record
 */
export async function DELETE(req: NextRequest) {
  try {
    await requirePermission('MARKETING', 'edit');

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing message ID' }, { status: 400 });
    }

    const message = await prisma.whatsAppMessage.findUnique({
      where: { id }
    });

    if (!message) {
      return NextResponse.json({ error: 'Media message not found' }, { status: 404 });
    }

    await prisma.whatsAppMessage.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Media record deleted successfully' });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * PUT — Update WhatsApp media message caption or details
 */
export async function PUT(req: NextRequest) {
  try {
    await requirePermission('MARKETING', 'edit');

    const { id, body, mediaUrl, mediaType } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing message ID' }, { status: 400 });
    }

    const updated = await prisma.whatsAppMessage.update({
      where: { id },
      data: {
        body: typeof body === 'string' ? body : undefined,
        mediaUrl: typeof mediaUrl === 'string' ? mediaUrl : undefined,
        mediaType: typeof mediaType === 'string' ? mediaType : undefined,
      }
    });

    return NextResponse.json({ success: true, media: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}

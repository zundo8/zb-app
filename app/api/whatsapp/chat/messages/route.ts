/**
 * WhatsApp Chat Messages API Route
 * Location: app/api/whatsapp/chat/messages/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

export const dynamic = 'force-dynamic';

/**
 * GET — Get thread history for a phone number
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone number parameter' }, { status: 400 });
    }

    // Fetch message history
    const messages = await prisma.whatsAppMessage.findMany({
      where: { phoneNumber: phone },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark any unread inbound messages as read
    await prisma.whatsAppMessage.updateMany({
      where: {
        phoneNumber: phone,
        direction: 'inbound',
        status: { not: 'read' }
      },
      data: { status: 'read' }
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('[WhatsApp Messages API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Send a message (text, media, or template) to customer
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, text, mediaUrl, mediaType, templateName, components } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 });
    }

    const formattedPhone = WhatsAppService.formatPhone(phone);
    let waMessageId = null;
    let messageBody = text || '';

    if (templateName) {
      // 1. Send template message
      const result = await WhatsAppService.sendTemplateMessage(formattedPhone, templateName, 'en', components || []);
      waMessageId = result?.messages?.[0]?.id || null;
      messageBody = `[Template: ${templateName}] ${text || ''}`;
    } else if (mediaUrl && mediaType) {
      // 2. Send media message
      const result = await WhatsAppService.sendMediaMessage(formattedPhone, mediaType, mediaUrl, text || undefined);
      waMessageId = result?.messages?.[0]?.id || null;
      messageBody = text ? `[Media: ${mediaType}] ${text}` : `[Media: ${mediaType}] ${mediaUrl}`;
    } else if (text) {
      // 3. Send standard text message
      const result = await WhatsAppService.sendTextMessage(formattedPhone, text);
      waMessageId = result?.messages?.[0]?.id || null;
    } else {
      return NextResponse.json({ error: 'Missing message parameters (text, media, or template)' }, { status: 400 });
    }

    // Retrieve userId if customer exists
    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: phone.slice(-10) } }
    });

    // Log outbound message to DB
    const newMessage = await prisma.whatsAppMessage.create({
      data: {
        direction: 'outbound',
        waMessageId,
        phoneNumber: phone,
        userId: customer?.id || null,
        templateName: templateName || null,
        body: messageBody,
        status: 'sent',
        sentAt: new Date()
      }
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('[WhatsApp Messages API] POST error:', error);
    // If it is a Meta API error, return detailed feedback
    const message = error.response?.data?.error?.message || error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

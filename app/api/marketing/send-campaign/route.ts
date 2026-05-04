import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { EmailService } from '@/lib/services/email.service';
import { SmsService } from '@/lib/services/sms.service';
import { WhatsAppService } from '@/lib/services/whatsapp.service';
// Assuming NotificationService has a way to send, or we just call the existing /api/notifications/send-manual
import { fetchAllCustomers } from '@/lib/shopify-admin';

export async function POST(req: Request) {
  try {
    const { channel, targetAudience, subject, messageBody, templateId } = await req.json();

    if (!channel || !targetAudience || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch target customers
    let targetCustomers = await db.customer.findMany({
      where: {
        ...(channel === 'email' ? { emailOptedOut: false, email: { not: null } } : {}),
        ...(channel === 'whatsapp' ? { whatsappOptedOut: false, phone: { not: null } } : {}),
        ...(channel === 'sms' ? { smsOptedOut: false, phone: { not: null } } : {}),
      }
    });

    if (targetAudience === 'vip') {
      targetCustomers = targetCustomers.filter(c => c.totalOrders > 2 || c.totalSpent > 10000);
    }

    if (targetCustomers.length === 0) {
      return NextResponse.json({ error: 'No valid customers found for this audience and channel.' }, { status: 404 });
    }

    let successCount = 0;
    let failedCount = 0;

    // 2. Dispatch Campaign
    if (channel === 'email') {
      const emails = targetCustomers.map(c => c.email).filter(Boolean) as string[];
      try {
        await EmailService.sendEmail(emails, subject || 'Zica Bella Exclusive', messageBody);
        successCount = emails.length;
      } catch (e) {
        failedCount = emails.length;
      }
    } 
    
    else if (channel === 'sms') {
      for (const customer of targetCustomers) {
        if (!customer.phone) continue;
        try {
          await SmsService.sendSms(customer.phone, messageBody, templateId);
          successCount++;
        } catch (e) {
          failedCount++;
        }
      }
    }
    
    else if (channel === 'whatsapp') {
      for (const customer of targetCustomers) {
        if (!customer.phone) continue;
        try {
          // If we have a templateId, we send a template. Otherwise a plain text message.
          if (templateId) {
             await WhatsAppService.sendTemplateMessage(customer.phone, templateId);
          } else {
             await WhatsAppService.sendTextMessage(customer.phone, messageBody);
          }
          successCount++;
        } catch (e) {
          failedCount++;
        }
      }
    }

    // 3. Log Analytics Event
    if (successCount > 0) {
      await db.campaignAnalyticsEvent.create({
        data: {
          campaignId: `camp_${Date.now()}`, // Simple mock ID
          channel,
          eventType: 'sent',
          metadata: JSON.stringify({ successCount, failedCount, targetAudience })
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failedCount,
      message: `Successfully sent to ${successCount} customers.`
    });

  } catch (error: any) {
    console.error('Campaign Dispatch Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch campaign' }, { status: 500 });
  }
}

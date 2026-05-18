import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { extractVariables } from '@/lib/email-templates';

// Helper to seed default templates if database has none or if refreshed
async function seedDefaultTemplates() {
  const templatesToSeed = [
    { file: 'welcome.html', name: 'Welcome', category: 'transactional', subject: 'Welcome to Zica Bella', trigger: 'WELCOME' },
    { file: 'order-confirmation.html', name: 'Order Confirmation', category: 'transactional', subject: 'Your order #{{orderId}} is confirmed', trigger: 'ORDER_CONFIRMATION' },
    { file: 'order-shipped.html', name: 'Order Shipped', category: 'transactional', subject: 'Your order is on its way', trigger: 'ORDER_SHIPPED' },
    { file: 'payment-failed.html', name: 'Payment Failed', category: 'transactional', subject: 'Action required — payment unsuccessful', trigger: 'PAYMENT_FAILED' },
    { file: 'order-cancelled.html', name: 'Order Cancelled', category: 'transactional', subject: 'Your order has been cancelled', trigger: 'ORDER_CANCELLED' },
    { file: 'order-delivered.html', name: 'Order Delivered', category: 'transactional', subject: 'Your order has arrived', trigger: 'ORDER_DELIVERED' },
    { file: 'return-refund.html', name: 'Return & Refund', category: 'transactional', subject: 'Your return has been accepted', trigger: 'RETURN_REFUND' },
    { file: 'new-drop.html', name: 'New Drop', category: 'marketing', subject: '{{collectionName}} — Members Only Drop', trigger: null },
    { file: 'password-reset.html', name: 'Password Reset', category: 'transactional', subject: 'Reset your Zica Bella password', trigger: 'PASSWORD_RESET' }
  ];

  for (const t of templatesToSeed) {
    const filePath = path.join(process.cwd(), 'lib', 'email-templates', t.file);
    let htmlBody = '';
    if (fs.existsSync(filePath)) {
      htmlBody = fs.readFileSync(filePath, 'utf8');
    }
    
    const variables = extractVariables(htmlBody);

    await prisma.emailTemplate.create({
      data: {
        name: t.name,
        category: t.category,
        subject: t.subject,
        htmlBody,
        variables,
        isActive: true,
        createdBy: 'system',
        automationTrigger: t.trigger
      }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    let templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // Auto-seed if empty
    if (templates.length === 0) {
      console.log('[Templates] Database has no templates. Seeding default templates...');
      await seedDefaultTemplates();
      templates = await prisma.emailTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }
    
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Fetch templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // If setting an automation trigger, remove it from other templates first to ensure 1-to-1 mapping
    if (data.automationTrigger) {
      await prisma.emailTemplate.updateMany({
        where: { automationTrigger: data.automationTrigger },
        data: { automationTrigger: null }
      });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        category: data.category || data.type || 'transactional', // support both category/type
        subject: data.subject,
        htmlBody: data.htmlBody,
        variables: data.variables || extractVariables(data.htmlBody || ''),
        automationTrigger: data.automationTrigger || null,
      },
    });
    
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Delete all templates in DB to force a complete re-seed when requested!
    await prisma.emailTemplate.deleteMany({});
    await seedDefaultTemplates();
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


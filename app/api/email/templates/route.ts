import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { baseEmailLayout } from '@/lib/email-templates/base';

// Helper to seed default templates if database has none
async function seedDefaultTemplates() {
  const defaultTemplates = [
    {
      name: 'New User Welcome',
      category: 'transactional',
      subject: 'Welcome to Zica Bella — Unveiling Premium Style Concierge',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 20px 0; font-family: Georgia, serif; font-size: 22px; font-weight: normal; color: #000000; text-align: center;">
          Welcome to the Zica Bella Circle
        </h2>
        <p>Dear {{customerName}},</p>
        <p>It is our absolute pleasure to welcome you to <strong>Zica Bella</strong>. You have joined an exclusive community of style connoisseurs who value meticulous craftsmanship, premium fabrics, and bespoke design.</p>
        <p>As a member, you now have access to our live style concierge, personalized design portfolios, and first access to our limited-run seasonal collection drops.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="{{appDownloadUrl}}" class="cta-button" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 4px; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">
            Download Zica App
          </a>
        </div>
        <p>Should you need anything from size consultations to direct style requests, our AI-powered concierge and human master tailors are at your service.</p>
        <p style="margin-top: 30px; font-style: italic;">Warmest regards,<br>The Zica Bella Team</p>
      `, 'Welcome to Zica Bella'),
      variables: { customerName: 'Recipient name', appDownloadUrl: 'Link to download iOS/Android app' }
    },
    {
      name: 'Order Confirmed',
      category: 'transactional',
      subject: 'Thank you for your order! - {{orderId}}',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 20px 0; font-family: Georgia, serif; font-size: 22px; font-weight: normal; color: #000000; text-align: center;">
          Order Confirmed
        </h2>
        <p>Dear {{customerName}},</p>
        <p>We are delighted to confirm that your order <strong>#{{orderId}}</strong> has been received and is currently being processed by our manufacturing atelier.</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin: 25px 0; border: 1px solid #eaeaea;">
          <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eaeaea; padding-bottom: 8px;">Order Summary</h3>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 2;">
            <tr>
              <td style="color: #666666;">Order ID:</td>
              <td align="right" style="font-weight: bold; font-family: monospace;">{{orderId}}</td>
            </tr>
            <tr>
              <td style="color: #666666;">Total Amount:</td>
              <td align="right" style="font-weight: bold;">INR {{totalAmount}}</td>
            </tr>
            <tr>
              <td style="color: #666666;">Status:</td>
              <td align="right" style="color: #1e7e34; font-weight: bold;">PREPARING FOR CUTTING</td>
            </tr>
          </table>
        </div>

        <p>Every piece at Zica Bella is handcrafted in our smart manufacturing center, ensuring perfect quality and fit. We will update you as your garment advances from cutting to tailoring and washing stages.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{loginUrl}}" class="cta-button" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 4px; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
            Track Order In App
          </a>
        </div>
      `, 'Your Zica Bella order is confirmed'),
      variables: { customerName: 'Recipient name', orderId: 'Unique order identifier', totalAmount: 'Total order cost', loginUrl: 'Link to view order history' }
    },
    {
      name: 'Order Shipped',
      category: 'transactional',
      subject: 'Your Zica Bella order has been shipped - {{orderId}}',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 20px 0; font-family: Georgia, serif; font-size: 22px; font-weight: normal; color: #000000; text-align: center;">
          Your Order is on the Way
        </h2>
        <p>Dear {{customerName}},</p>
        <p>Exciting news! Your custom Zica Bella order <strong>#{{orderId}}</strong> has successfully passed our final 12-point quality check and is now with our logistics partner.</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin: 25px 0; border: 1px solid #eaeaea; text-align: center;">
          <p style="margin-top: 0; font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Shipment Tracking</p>
          <a href="{{trackingUrl}}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0;">
            Track Package Live
          </a>
          <p style="margin-bottom: 0; font-size: 11px; color: #666666; font-family: monospace;">Courier Partner: Delhivery Express</p>
        </div>

        <p>Please note that it can take up to 12 hours for tracking updates to appear live on the courier terminal. We hope you love the fit and touch of your new Zica Bella garment!</p>
      `, 'Your order has been shipped'),
      variables: { customerName: 'Recipient name', orderId: 'Unique order identifier', trackingUrl: 'Live courier tracking link' }
    },
    {
      name: 'Low Stock Alert',
      category: 'operational',
      subject: '⚠️ Low Stock Alert: Items below threshold',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 20px 0; font-family: Georgia, serif; font-size: 22px; font-weight: normal; color: #ff3b30; text-align: center;">
          Inventory Level Warning
        </h2>
        <p>Attention Operations & Design Team,</p>
        <p>Our automation logs indicate that certain premium fabrics or raw items have dropped below their designated reorder threshold. To prevent production downtime, please verify and place purchase orders immediately.</p>
        
        <div style="background-color: #fcf8e3; padding: 20px; border-radius: 6px; margin: 25px 0; border: 1px solid #faebcc; color: #8a6d3b;">
          <strong>Action Required:</strong> Log in to the Manufacturing Dashboard > Fabrics to initiate re-orders with verified vendors.
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://app.zicabella.com/dashboard/manufacturing/fabric" class="cta-button" style="display: inline-block; background-color: #ff3b30; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 4px; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
            Review Fabric Levels
          </a>
        </div>
      `, 'Operational low stock warning'),
      variables: {}
    }
  ];

  for (const t of defaultTemplates) {
    await prisma.emailTemplate.create({
      data: {
        name: t.name,
        category: t.category,
        subject: t.subject,
        htmlBody: t.htmlBody,
        variables: t.variables,
        isActive: true,
        createdBy: 'system'
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
    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        subject: data.subject,
        htmlBody: data.htmlBody,
        variables: data.variables || {},
      },
    });
    
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

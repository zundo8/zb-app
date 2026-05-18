import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { baseEmailLayout } from '@/lib/email-templates/base';

// Helper to seed default templates if database has none or if refreshed
async function seedDefaultTemplates() {
  const defaultTemplates = [
    {
      name: 'New User Welcome',
      category: 'transactional',
      subject: 'Welcome to Zica Bella — Elevating Personal Luxury',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 18px; font-weight: 600; color: #ffffff; text-align: center; letter-spacing: -0.01em;">
          Welcome to Zica Bella
        </h2>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #C9A96E; text-align: center; margin-top: 0; font-weight: 600;">Membership Activated</p>
        
        <p style="margin-top: 25px;">Dear {{customerName}},</p>
        <p>It is our absolute pleasure to welcome you to the exclusive community of <strong>Zica Bella</strong>. You have joined a selective circle of style connoisseurs who value meticulous design, high-quality fabrics, and clean luxury silhouettes.</p>
        <p>As a member, you now have access to our personal style recommendations, custom collections, and priority notifications for our limited-edition streetwear drops.</p>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="{{appDownloadUrl}}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 14px 32px; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 12px rgba(255,255,255,0.15);">
            Download Concierge App
          </a>
        </div>
        
        <p>Should you require any assistance, size consultations, or custom style advice, our personal client concierge team is ready to serve you.</p>
        <p style="margin-top: 35px; font-size: 11px; font-style: italic; color: #55555d;">Warmest regards,<br>The Zica Bella Team</p>
      `, 'Welcome to the Zica Bella Circle'),
      variables: { customerName: 'Recipient name', appDownloadUrl: 'Link to download concierge app' }
    },
    {
      name: 'Order Confirmed',
      category: 'transactional',
      subject: 'Thank you for your order! - {{orderId}}',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 18px; font-weight: 600; color: #ffffff; text-align: center; letter-spacing: -0.01em;">
          Order Confirmed
        </h2>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #C9A96E; text-align: center; margin-top: 0; font-weight: 600;">Your Silhouette is Confirmed</p>
        
        <p style="margin-top: 25px;">Dear {{customerName}},</p>
        <p>Thank you for your purchase. We are pleased to confirm that your order <strong>#{{orderId}}</strong> has been received and is now being carefully prepared by our dispatch specialists.</p>
        
        <!-- Product Photo Detail Row -->
        <div style="margin: 30px 0; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 20px; border-radius: 12px;">
          <p style="margin: 0 0 15px 0; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #C9A96E; border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 8px;">Items In Your Order</p>
          
          <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td width="75" style="vertical-align: top; padding-right: 15px;">
                <img src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=160&auto=format&fit=crop" width="60" height="60" style="border-radius: 6px; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.08);" alt="Heavy Box T-Shirt" />
              </td>
              <td style="vertical-align: middle;">
                <h4 style="margin: 0; font-size: 12px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">Premium Box Tee</h4>
                <p style="margin: 3px 0 0 0; font-size: 10px; color: #8e8e93;">Size: L | Onyx Heavy Cotton</p>
              </td>
              <td align="right" style="vertical-align: middle; font-weight: bold; font-size: 12px; color: #C9A96E; font-family: monospace;">
                INR {{totalAmount}}
              </td>
            </tr>
          </table>
        </div>

        <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); padding: 20px; border-radius: 12px; margin: 25px 0;">
          <h3 style="margin-top: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 8px; color: #ffffff; font-weight: bold;">Order Ledger</h3>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 2;">
            <tr>
              <td style="color: #8e8e93;">Order Code:</td>
              <td align="right" style="font-weight: bold; color: #ffffff; font-family: monospace;">{{orderId}}</td>
            </tr>
            <tr>
              <td style="color: #8e8e93;">Status:</td>
              <td align="right" style="color: #30d158; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">PREPARING DISPATCH</td>
            </tr>
          </table>
        </div>

        <p>Our concierge team is currently preparing your package. We will send you an email with the tracking information as soon as it has been dispatched from our showroom.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{loginUrl}}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 28px; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 12px rgba(255,255,255,0.15);">
            View Order In App
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
        <h2 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 18px; font-weight: 600; color: #ffffff; text-align: center; letter-spacing: -0.01em;">
          Order Dispatched
        </h2>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #C9A96E; text-align: center; margin-top: 0; font-weight: 600;">Your Silhouette is on its Way</p>
        
        <p style="margin-top: 25px;">Dear {{customerName}},</p>
        <p>Exciting news! Your custom Zica Bella order <strong>#{{orderId}}</strong> has successfully passed final quality control and has been handed over to our premium courier partner for delivery.</p>
        
        <!-- Product Photo Detail Row -->
        <div style="margin: 30px 0; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 20px; border-radius: 12px;">
          <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td width="75" style="vertical-align: top; padding-right: 15px;">
                <img src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=160&auto=format&fit=crop" width="60" height="60" style="border-radius: 6px; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.08);" alt="Heavy Box T-Shirt" />
              </td>
              <td style="vertical-align: middle;">
                <h4 style="margin: 0; font-size: 12px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">Premium Box Tee</h4>
                <p style="margin: 3px 0 0 0; font-size: 10px; color: #8e8e93;">Shipped in custom luxury matte casing</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 24px; border-radius: 12px; margin: 25px 0; text-align: center;">
          <p style="margin-top: 0; font-size: 9px; color: #8e8e93; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Tracking Details</p>
          <a href="{{trackingUrl}}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 28px; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin: 10px 0; border-radius: 8px; box-shadow: 0 4px 12px rgba(255,255,255,0.15);">
            Track Package Live
          </a>
          <p style="margin-bottom: 0; font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace;">Courier Partner: Delhivery Express Premium</p>
        </div>

        <p>Please note that tracking scans can take up to 12 hours to update online. We hope you appreciate the structure, drape, and precision of your new Zica Bella garment!</p>
      `, 'Your order has been shipped'),
      variables: { customerName: 'Recipient name', orderId: 'Unique order identifier', trackingUrl: 'Live courier tracking link' }
    },
    {
      name: 'Order Failed',
      category: 'transactional',
      subject: 'Action Required: Transaction Declined for Order #{{orderId}}',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 18px; font-weight: 600; color: #ff453a; text-align: center; letter-spacing: -0.01em;">
          Transaction Failed
        </h2>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #ff453a; text-align: center; margin-top: 0; font-weight: 600;">Alert: Action Required</p>
        
        <p style="margin-top: 25px;">Dear {{customerName}},</p>
        <p>We are writing to let you know that the transaction processing for your order <strong>#{{orderId}}</strong> was unsuccessful, and your order processing has been temporarily paused.</p>
        
        <!-- Product Photo Detail Row -->
        <div style="margin: 30px 0; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 69, 58, 0.2); padding: 20px; border-radius: 12px;">
          <table width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td width="75" style="vertical-align: top; padding-right: 15px;">
                <img src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=160&auto=format&fit=crop" width="60" height="60" style="border-radius: 6px; object-fit: cover; border: 1px solid rgba(255, 69, 58, 0.3);" alt="Heavy Box T-Shirt" />
              </td>
              <td style="vertical-align: middle;">
                <h4 style="margin: 0; font-size: 12px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">Premium Box Tee</h4>
                <p style="margin: 3px 0 0 0; font-size: 10px; color: #8e8e93;">Onyx Heavy Cotton Silhouette</p>
              </td>
              <td align="right" style="vertical-align: middle; font-weight: bold; font-size: 12px; color: #ff453a; font-family: monospace;">
                INR {{totalAmount}}
              </td>
            </tr>
          </table>
        </div>

        <div style="background: rgba(255, 69, 58, 0.05); border: 1px solid rgba(255, 69, 58, 0.2); padding: 20px; border-radius: 8px; margin: 25px 0; color: #ff453a; font-size: 11px; line-height: 1.6;">
          <strong>Declined Transaction:</strong> Your payment declined at checkout. If any amount was debited from your card or account, rest assured it will be automatically refunded by your payment gateway within 3-5 business days.
        </div>

        <p>To complete your order, please click below to securely retry checkout using Razorpay or UPI:</p>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="{{retryUrl}}" style="display: inline-block; background-color: #ff453a; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 12px rgba(255,69,58,0.3);">
            Retry Checkout Securely
          </a>
        </div>
      `, 'Your Zica Bella transaction requires attention'),
      variables: { customerName: 'Recipient name', orderId: 'Unique order identifier', totalAmount: 'Total order cost', retryUrl: 'Secure checkout retry link' }
    },
    {
      name: 'Low Stock Alert',
      category: 'operational',
      subject: '⚠️ Inventory Alert: Low Stock Warning',
      htmlBody: baseEmailLayout(`
        <h2 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 18px; font-weight: 600; color: #ff9f0a; text-align: center; letter-spacing: -0.01em;">
          Inventory Alert
        </h2>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #ff9f0a; text-align: center; margin-top: 0; font-weight: 600;">Warehouse Quantity Advisory</p>
        
        <p style="margin-top: 25px;">Attention Operations & Supply Chain Team,</p>
        <p>This is an automated operational notice that certain boutique inventory items or materials have dropped below their safety threshold.</p>
        
        <div style="background: rgba(255, 159, 10, 0.05); border: 1px solid rgba(255, 159, 10, 0.2); padding: 20px; border-radius: 8px; margin: 25px 0; color: #ff9f0a; font-size: 11px;">
          <strong>Action Required:</strong> Log in to the Zica Bella inventory manager to review item velocity and initiate restock orders.
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://app.zicabella.com/dashboard/inventory" style="display: inline-block; background-color: #ff9f0a; color: #000000; text-decoration: none; padding: 14px 30px; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 12px rgba(255,159,10,0.15);">
            Review Stock Levels
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
    // Proactive check: if any template contains 'cutting', 'stitching', or 'atelier', delete them all and force a re-seed!
    const oldTemplates = await prisma.emailTemplate.findMany({
      where: {
        OR: [
          { htmlBody: { contains: 'cutting' } },
          { htmlBody: { contains: 'stitching' } },
          { htmlBody: { contains: 'atelier' } },
          { name: { contains: 'Atelier' } }
        ]
      }
    });

    if (oldTemplates.length > 0) {
      console.log('[Templates] Detected legacy manufacturing templates in SQLite DB. Wiping and reseeding...');
      await prisma.emailTemplate.deleteMany({});
    }

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

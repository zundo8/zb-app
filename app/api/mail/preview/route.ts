import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const sampleData: Record<string, string> = {
  customerName: 'Priya Sharma',
  orderId: '#ZB-10042',
  customerEmail: 'priya@example.com',
  totalPrice: '₹4,200',
  orderStatusUrl: '#',
  trackingNumber: 'IN123456789XX',
  courierName: 'Delhivery',
  courier: 'Delhivery',
  carrier: 'Delhivery',
  trackingUrl: '#',
  deliveryAddress: '14 Lodhi Colony, New Delhi, DL 110003',
  reviewUrl: '#',
  collectionName: 'Summer Edit',
  collectionEditorialLine: 'Effortless warmth, considered detail.',
  collectionUrl: '#',
  productsGrid: '<p style="color:rgba(255,255,255,0.3); font-family:\'DM Mono\',monospace; font-size:11px;">Collection preview loads on send.</p>',
  itemsHtml: `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td width="88" valign="top" style="padding-right:16px;">
          <div style="width:88px; height:88px; background:#1a1a1a; border-radius:1px;"></div>
        </td>
        <td valign="middle" style="color:rgba(255,255,255,0.55); font-family:'DM Mono','Courier New',monospace;">
          <p style="margin:0 0 4px; font-size:11px; color:rgba(255,255,255,0.85);">Embroidered Kurta Set</p>
          <p style="margin:0 0 4px; font-size:10px; color:rgba(255,255,255,0.4);">Size M / Ivory</p>
          <p style="margin:0; font-size:10px; color:rgba(255,255,255,0.4);">Qty: 1 · ₹2,100</p>
        </td>
      </tr>
    </table>
    <div style="height:1px; background:rgba(255,255,255,0.05); margin-bottom:16px;"></div>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td width="88" valign="top" style="padding-right:16px;">
          <div style="width:88px; height:88px; background:#1a1a1a; border-radius:1px;"></div>
        </td>
        <td valign="middle" style="color:rgba(255,255,255,0.55); font-family:'DM Mono','Courier New',monospace;">
          <p style="margin:0 0 4px; font-size:11px; color:rgba(255,255,255,0.85);">Obsidian Cargo Pant</p>
          <p style="margin:0 0 4px; font-size:10px; color:rgba(255,255,255,0.4);">Size L / Black</p>
          <p style="margin:0; font-size:10px; color:rgba(255,255,255,0.4);">Qty: 1 · ₹2,100</p>
        </td>
      </tr>
    </table>`,
  reason: 'Requested by customer',
  paymentMethod: 'Prepaid',
  orderDate: new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }),
  total: '₹4,200 INR',
  amount: '₹4,200',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateSlug = searchParams.get('template');

    if (!templateSlug) {
      return NextResponse.json({ error: 'Missing ?template= parameter' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'lib', 'email-templates', `${templateSlug}.html`);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `Template "${templateSlug}" not found` }, { status: 404 });
    }

    let html = fs.readFileSync(filePath, 'utf8');

    // Substitute all sample variables
    Object.entries(sampleData).forEach(([key, val]) => {
      html = html.replaceAll(`{{${key}}}`, val);
    });

    // Strip any remaining unresolved variables
    html = html.replace(/\{\{[^}]+\}\}/g, '');

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Mail Preview] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

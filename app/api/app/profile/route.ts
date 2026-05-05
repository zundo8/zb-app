import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone')?.trim();
    const email = url.searchParams.get('email')?.trim();
    const customerId = url.searchParams.get('customerId')?.trim();

    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token || token.length < 5) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    if (!customerId && !phone && !email) {
      return NextResponse.json(
        { error: 'customerId, phone or email query parameter required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const where: any = { OR: [] };
    if (customerId) where.OR.push({ id: customerId });
    if (phone) where.OR.push({ phone });
    if (email) where.OR.push({ email });

    const customer = await prisma.customer.findFirst({
      where,
      include: { communityMember: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          image: customer.image,
          defaultAddress: customer.defaultAddress,
          isCommunityMember: !!customer.communityMember,
          storeCredits: customer.storeCredits ?? 0,
          storeCreditPreference: customer.storeCreditPreference ?? false,
        },
      },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error('[App API] Profile GET error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { customerId, phone, email, name, image, defaultAddress } = body || {};

    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token || token.length < 5) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    if (!customerId && !phone && !email) {
      return NextResponse.json(
        { error: 'customerId, phone or email required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const where: any = { OR: [] };
    if (customerId) where.OR.push({ id: String(customerId) });
    if (phone) where.OR.push({ phone: String(phone) });
    if (email) where.OR.push({ email: String(email) });

    const customer = await prisma.customer.findFirst({ where });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: name !== undefined ? String(name) : undefined,
        image: image !== undefined ? String(image) : undefined,
        defaultAddress: defaultAddress !== undefined ? String(defaultAddress) : undefined,
        email: email !== undefined ? String(email) : undefined,
        phone: phone !== undefined ? String(phone) : undefined,
      },
    });

    return NextResponse.json(
      {
        customer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          image: updated.image,
          defaultAddress: updated.defaultAddress,
        },
      },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error('[App API] Profile PATCH error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}


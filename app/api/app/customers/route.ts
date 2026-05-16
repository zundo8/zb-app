import { NextResponse } from 'next/server';
import { searchCustomerByPhone, createCustomer, fetchAllCustomers, ShopifyCustomer } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

function flattenCustomer(c: ShopifyCustomer) {
  return {
    id: String(c.id),
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    name: `${c.first_name} ${c.last_name}`.trim(),
    phone: c.phone,
    ordersCount: c.orders_count,
    totalSpent: c.total_spent,
    createdAt: c.created_at,
    verifiedEmail: c.verified_email,
    tags: c.tags,
    defaultAddress: c.default_address ? {
      address1: c.default_address.address1,
      city: c.default_address.city,
      province: c.default_address.province,
      zip: c.default_address.zip,
      country: c.default_address.country,
    } : null,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    const all = url.searchParams.get('all') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const countOnly = url.searchParams.get('count') === 'true';

    if (countOnly) {
      const customers = await fetchAllCustomers(1);
      return NextResponse.json({ total: customers.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Fetch single customer by phone
    if (phone) {
      const customer = await searchCustomerByPhone(phone);
      if (!customer) {
        return NextResponse.json(
          { customer: null },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }
      return NextResponse.json(
        { customer: flattenCustomer(customer) },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Fetch all customers (admin dashboard summary)
    if (all) {
      const customers = await fetchAllCustomers(limit);
      return NextResponse.json(
        { customers: customers.map(flattenCustomer), total: customers.length },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { error: 'Provide ?phone=... or ?all=true' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error: any) {
    console.error('[App API] Customers error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customer = await createCustomer({
      first_name: body.firstName || body.first_name,
      last_name: body.lastName || body.last_name,
      email: body.email,
      phone: body.phone,
      verified_email: true,
      tags: body.tags || 'mobile-app',
    });

    return NextResponse.json(
      { success: true, customer: flattenCustomer(customer) },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error: any) {
    console.error('[App API] Create customer error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

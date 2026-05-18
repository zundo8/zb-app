import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        email: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    return NextResponse.json({ success: true, count: customers.length, customers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

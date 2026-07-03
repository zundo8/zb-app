import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        featuredImage: true,
        sku: true,
        barcode: true,
      },
      orderBy: {
        title: 'asc',
      },
    });

    return NextResponse.json({ products }, { status: 200 });
  } catch (error: any) {
    console.error('API Price Tags Products Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { fetchProductsByCollectionId } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const products = await fetchProductsByCollectionId(params.id, 6);
    
    const simplified = products.map(p => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      price: p.variants?.[0]?.price ?? '0',
      image: p.images?.[0]?.src ?? null,
    }));

    return NextResponse.json({ products: simplified });
  } catch (error: any) {
    console.error('[Collections Products] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

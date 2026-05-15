import { NextResponse } from 'next/server';
import { fetchProductById, updateProduct } from '@/lib/shopify-admin';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await fetchProductById(params.id);
    return NextResponse.json({ product });
  } catch (error: any) {
    console.error('Shopify Product GET Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, title, tags } = body;
    const updated = await updateProduct(params.id, { status, title, tags });
    
    if (updated?.handle) {
      revalidateTag(`product-${updated.handle}`);
      revalidateTag('homepage'); // Products might be on homepage
    }

    return NextResponse.json({ product: updated });
  } catch (error: any) {
    console.error('Shopify Product PATCH Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

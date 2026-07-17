import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';
import { fetchAllProducts } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch local products
    const localProducts = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        featuredImage: true,
        sku: true,
        barcode: true,
        shopifyProductId: true,
      },
      orderBy: {
        title: 'asc',
      },
    });

    // 2. Fetch all products from Shopify to get real variants and compare_at_prices
    let shopifyProductsMap = new Map<string, any>();
    try {
      const shopifyProducts = await fetchAllProducts(250);
      for (const sp of shopifyProducts) {
        shopifyProductsMap.set(String(sp.id), sp);
      }
    } catch (shopifyErr) {
      console.error('Failed to fetch products from Shopify:', shopifyErr);
    }

    // 3. Merge variants into the returned products
    const mappedProducts = localProducts.map((p: any) => {
      const sp = shopifyProductsMap.get(p.shopifyProductId);
      
      let variants = [];
      if (sp && sp.variants && sp.variants.length > 0) {
        variants = sp.variants.map((v: any) => {
          // The "proper value" is the compare_at_price if it's set (and greater than 0)
          // otherwise it's the standard price.
          const comparePrice = v.compare_at_price ? parseFloat(v.compare_at_price) : 0;
          const standardPrice = v.price ? parseFloat(v.price) : 0;
          const finalPrice = (comparePrice > 0) ? comparePrice : standardPrice;

          return {
            id: v.id,
            title: v.title || 'Default',
            price: String(finalPrice),
            sku: v.sku || null,
            barcode: v.barcode || null,
            option1: v.option1 || null,
            option2: v.option2 || null,
          };
        });
      } else {
        // Fallback to local product price
        variants = [
          {
            id: 0,
            title: 'Default Variant',
            price: String(p.price || 0),
            sku: p.sku || null,
            barcode: p.barcode || null,
            option1: null,
            option2: null,
          }
        ];
      }

      return {
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        featuredImage: p.featuredImage,
        price: variants[0]?.price || String(p.price || 0), // Default to first variant's proper price
        sku: p.sku,
        barcode: p.barcode,
        variants,
      };
    });

    return NextResponse.json({ products: mappedProducts }, { status: 200 });
  } catch (error: any) {
    console.error('API Price Tags Products Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

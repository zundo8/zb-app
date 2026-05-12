import { NextRequest, NextResponse } from 'next/server';
import { fetchAllProducts, fetchLocations, fetchInventoryLevels } from '@/lib/shopify-admin';

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET if provided (optional but recommended)
  const authHeader = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await fetchAllProducts();
    const locations = await fetchLocations();
    const locationIds = locations.map(l => l.id.toString());
    
    const inventoryLevels = await fetchInventoryLevels(locationIds);
    const lowStockProducts: any[] = [];
    const THRESHOLD = 10;

    for (const product of products) {
      for (const variant of product.variants) {
        const inv = inventoryLevels.find(l => l.inventory_item_id === variant.inventory_item_id);
        const available = inv ? inv.available : variant.inventory_quantity;

        if (available <= THRESHOLD) {
          lowStockProducts.push({
            name: `${product.title} - ${variant.title}`,
            sku: variant.sku || 'N/A',
            currentStock: available,
            threshold: THRESHOLD,
          });
        }
      }
    }

    if (lowStockProducts.length > 0) {
      // Trigger the email API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com';
      await fetch(`${baseUrl}/api/email/low-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: lowStockProducts }),
      });
    }

    return NextResponse.json({ 
      success: true, 
      checkedCount: products.length, 
      lowStockCount: lowStockProducts.length 
    });
  } catch (error: any) {
    console.error('Low Stock Cron Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

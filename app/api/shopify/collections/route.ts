import { NextResponse } from 'next/server';
import { fetchEnabledCollections } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const location = (searchParams.get('location') as 'header' | 'page' | 'menu') || 'page';
    
    const collections = await fetchEnabledCollections(location);
    return NextResponse.json(collections, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { getAuthenticatedCustomer } from '../auth';
import { generateUniqueLinkSlug } from '@/lib/affiliate/code';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CreateLinkSchema = z.object({
  targetType: z.enum(['STORE', 'PRODUCT', 'COLLECTION', 'URL']).default('STORE'),
  targetValue: z.string().trim().max(200).optional().nullable(),
  label: z.string().trim().max(100).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      select: { id: true, status: true },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Affiliate account not approved' }, { status: 403 });
    }

    const host = req.headers.get('host') || 'zicabella.com';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const siteUrl = `${proto}://${host}`;

    const links = await prisma.affiliateLink.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedLinks = links.map((link: any) => ({
      ...link,
      shortUrl: `${siteUrl}/r/${link.slug}`,
    }));

    return NextResponse.json({ links: enrichedLinks });
  } catch (error: any) {
    console.error('[Affiliate Links] Error fetching links:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const customer = await getAuthenticatedCustomer(req);
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting (max 15 link generations per 5 minutes)
  const { allowed } = await rateLimit(`aff_link_${customer.id}`, { maxRequests: 15, windowMs: 300_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
  }

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { customerId: customer.id },
      select: { id: true, code: true, status: true },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only approved affiliates can generate links' }, { status: 403 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = CreateLinkSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { targetType, targetValue, label } = parseResult.data;

    let destination = '/';
    let resolvedLabel = label;

    if (targetType === 'PRODUCT') {
      if (!targetValue) {
        return NextResponse.json({ error: 'Product handle or ID is required' }, { status: 400 });
      }

      // Indexed lookup for product
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { handle: targetValue },
            { id: targetValue },
            { shopifyProductId: targetValue },
          ],
        },
        select: { id: true, handle: true, title: true },
      });

      if (!product) {
        return NextResponse.json({ error: 'Selected product could not be found' }, { status: 404 });
      }

      destination = `/products/${product.handle || product.id}`;
      resolvedLabel = resolvedLabel || product.title;
    } else if (targetType === 'COLLECTION') {
      if (!targetValue) {
        return NextResponse.json({ error: 'Collection handle is required' }, { status: 400 });
      }
      const cleanHandle = targetValue.replace(/^\/+/, '').replace(/^collections\//, '');
      destination = `/collections/${cleanHandle}`;
      resolvedLabel = resolvedLabel || `Collection: ${cleanHandle}`;
    } else if (targetType === 'URL') {
      if (!targetValue) {
        return NextResponse.json({ error: 'URL path is required' }, { status: 400 });
      }
      destination = targetValue.startsWith('/') ? targetValue : `/${targetValue}`;
      resolvedLabel = resolvedLabel || targetValue;
    } else {
      // STORE
      destination = '/';
      resolvedLabel = resolvedLabel || 'Storefront Homepage';
    }

    // Generate unique slug
    const slug = await generateUniqueLinkSlug(affiliate.code, targetType);

    const link = await prisma.affiliateLink.create({
      data: {
        affiliateId: affiliate.id,
        slug,
        label: resolvedLabel,
        targetType,
        targetValue: targetValue || null,
        destination,
        isActive: true,
      },
    });

    const host = req.headers.get('host') || 'zicabella.com';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const shortUrl = `${proto}://${host}/r/${link.slug}`;

    return NextResponse.json({
      success: true,
      link: {
        ...link,
        shortUrl,
      },
    });
  } catch (error: any) {
    console.error('[Affiliate Links] Error creating link:', error);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}

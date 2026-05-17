import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch customers that have a non-null, non-empty email address
    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          { email: { not: null } },
          { email: { not: '' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // De-duplicate contacts by email address to ensure clean marketing send list
    const seenEmails = new Set<string>();
    const uniqueContacts = [];

    for (const c of customers) {
      if (c.email) {
        const normalizedEmail = c.email.toLowerCase().trim();
        if (!seenEmails.has(normalizedEmail)) {
          seenEmails.add(normalizedEmail);
          uniqueContacts.push({
            id: c.id,
            name: c.name || 'Valued Customer',
            email: normalizedEmail,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: uniqueContacts.length,
      contacts: uniqueContacts,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Mail Contacts API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

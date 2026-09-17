import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import prisma from '@/lib/db';

export interface AuthenticatedCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Resolves the authenticated customer from NextAuth session or App JWT.
 * Strict: returns null if not authenticated.
 */
export async function getAuthenticatedCustomer(req: Request | NextRequest): Promise<AuthenticatedCustomer | null> {
  // 1. Try NextAuth session (WebStore Profile)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const email = session.user.email;
      const userId = (session.user as any).id;

      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(userId ? [{ id: userId }] : []),
          ],
        },
        select: { id: true, name: true, email: true, phone: true },
      });

      if (customer) return customer;
    }
  } catch (err) {
    // Session check failed, continue to App JWT check
  }

  // 2. Try App JWT (Mobile App / Bearer Token)
  try {
    const appAuth = getAppAuthFromRequest(req);
    if (appAuth?.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: appAuth.customerId },
        select: { id: true, name: true, email: true, phone: true },
      });

      if (customer) return customer;
    }
  } catch (err) {
    // JWT verification failed
  }

  return null;
}

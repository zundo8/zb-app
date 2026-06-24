import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const isMock = (prisma as any)._isMock;
    if (isMock) {
      return NextResponse.json({ 
        error: 'Database is using mock client',
        mockReason: (prisma as any)._mockReason,
        envCheck: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasSupabaseUrl: !!process.env.SUPABASE_DATABASE_URL,
          hasPgUrl: !!process.env.POSTGRES_PRISMA_URL || !!process.env.POSTGRES_URL,
        }
      }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        email: email.toLowerCase().trim(),
      }, { status: 404 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    return NextResponse.json({
      found: true,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      failedLoginAttempts: user.failedLoginAttempts,
      lockUntil: user.lockUntil,
      passwordMatch: isValid,
      hashPrefix: user.passwordHash.substring(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack?.substring(0, 500),
    }, { status: 500 });
  }
}

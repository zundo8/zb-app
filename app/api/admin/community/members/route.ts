import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    // Add admin check if possible, for now just check session
    if (!session) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.communityMember.findMany({
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            ordersCount: true,
            orders: { take: 1 }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Admin Members GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, isVerified } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    const member = await prisma.communityMember.update({
      where: { id },
      data: { 
        status, 
        isVerified: isVerified !== undefined ? isVerified : (status === 'APPROVED') 
      } as any
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Admin Members PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  // Ensure dynamic behavior
  headers();
  
  try {
    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: {
            communityMessages: true,
            orders: true,
          }
        },
        communityMember: true,
        communityMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const activeChatUsers = customers
      .filter((c: any) => c._count.communityMessages > 0)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        image: (c as any).image,
        messageCount: c._count.communityMessages,
        orderCount: c._count.orders,
        lastActive: c.communityMessages[0]?.createdAt || c.createdAt,
        joinedAt: c.createdAt,
      }))
      .sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

    // Analytics: Growth over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Process growth data for chart (group by date)
    const growthData: Record<string, number> = {};
    activeChatUsers.forEach((u: any) => {
      const date = new Date(u.joinedAt).toISOString().split('T')[0];
      if (new Date(u.joinedAt) >= thirtyDaysAgo) {
        growthData[date] = (growthData[date] || 0) + 1;
      }
    });

    const chartData = Object.entries(growthData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ 
      users: activeChatUsers,
      analytics: {
        growth: chartData
      }
    });
  } catch (error) {
    console.error('Chat Users API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch chat users' }, { status: 500 });
  }
}

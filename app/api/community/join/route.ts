import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { dob, whatsappOptIn, phone } = body;

    if (!dob) {
      return NextResponse.json({ error: 'Date of Birth is required' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required for verification' }, { status: 400 });
    }

    // 0. Fetch Shop Settings
    const shop = await prisma.shop.findFirst();
    const ageRestricted = (shop as any)?.communityAgeRestricted ?? true;
    const minOrders = (shop as any)?.communityMinOrders ?? 1;

    let birthDateObj: Date | null = null;

    // 1. Verify Age (if restricted)
    if (ageRestricted) {
      birthDateObj = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const m = today.getMonth() - birthDateObj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      if (age < 18) {
        return NextResponse.json({ error: 'You must be 18 or older to join the community' }, { status: 403 });
      }
    } else if (dob) {
      birthDateObj = new Date(dob);
    }

    // 2. Verify Customer & Orders
    const customer = await prisma.customer.findFirst({
      where: { id: (session.user as any).id },
      include: { orders: true }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Only Zica Bella customers can join the community. Please place an order first.' }, { status: 403 });
    }

    const currentOrders = customer.ordersCount || customer.orders.length || 0;
    if (currentOrders < minOrders) {
      return NextResponse.json({ 
        error: `A minimum of ${minOrders} confirmed order${minOrders > 1 ? 's' : ''} is required to request community access. Please complete a purchase first.` 
      }, { status: 403 });
    }

    // 3. Join / Update Membership (Set to PENDING for admin review)
    const communityMember = await (prisma as any).communityMember.upsert({
      where: { customerId: customer.id },
      update: {
        dob: birthDateObj,
        phone: phone,
        whatsappOptIn: !!whatsappOptIn,
        status: "PENDING",
        isVerified: false // Admin must approve
      },
      create: {
        customerId: customer.id,
        dob: birthDateObj,
        phone: phone,
        whatsappOptIn: !!whatsappOptIn,
        status: "PENDING",
        isVerified: false
      }
    });

    return NextResponse.json({ success: true, member: communityMember });
  } catch (error) {
    console.error('Community Join POST Error:', error);
    return NextResponse.json({ error: 'Failed to join community' }, { status: 500 });
  }
}

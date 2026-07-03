import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    if (whereClause.OR.length === 0) {
      return NextResponse.json({ error: "No valid user identifier" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause,
      include: {
        addresses: {
          where: { isDefault: true }
        },
        communityMember: {
          select: {
            dob: true,
            isVerified: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const defaultAddr = customer.addresses[0] || null;

    let dobString: string | undefined = undefined;
    if (customer.communityMember?.isVerified && customer.communityMember?.dob) {
      const d = new Date(customer.communityMember.dob);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dobString = `${yyyy}${mm}${dd}`;
    }

    return NextResponse.json({
      city: defaultAddr?.city || undefined,
      state: defaultAddr?.state || undefined,
      zip: defaultAddr?.zip || undefined,
      country: defaultAddr?.country || undefined,
      dob: dobString
    });
  } catch (error: any) {
    console.error("GET /api/customers/me/default-address Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

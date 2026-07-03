import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // In a real production app, we would upload to S3/Cloudinary.
    // For this premium demo, we store the data URI or a mock URL.
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email || "" },
          { id: (session.user as any).id || "" }
        ]
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { image }
    });

    return NextResponse.json({ success: true, image: updatedCustomer.image });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

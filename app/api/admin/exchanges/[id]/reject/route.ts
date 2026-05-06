import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { reason } = body;

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: { exchanges: true }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    const updatedRequest = await prisma.exchangeRequest.update({
      where: { id },
      data: {
        status: "rejected",
        reason
      }
    });

    // Update the individual exchange items
    await prisma.exchange.updateMany({
      where: { exchangeRequestId: id },
      data: { status: "REJECTED" }
    });

    // Update order status back to delivered
    await prisma.order.update({
      where: { id: exchangeRequest.orderId },
      data: { status: "delivered" }
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("Reject Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { actualRefund } = body;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: { returns: true }
    });

    if (!returnRequest) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    const updatedRequest = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: "approved",
        actualRefund: actualRefund !== undefined ? actualRefund : returnRequest.estimatedRefund,
        approvedAt: new Date()
      }
    });

    // Update the individual return items
    await prisma.return.updateMany({
      where: { returnRequestId: id },
      data: { status: "APPROVED" }
    });

    // Update order status
    await prisma.order.update({
      where: { id: returnRequest.orderId },
      data: { status: "return_approved" }
    });

    return NextResponse.json(updatedRequest);
  } catch (error: any) {
    console.error("Approve Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

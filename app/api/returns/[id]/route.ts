import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        returns: true
      }
    });

    if (!returnRequest) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    return NextResponse.json({
      returnRequestId: returnRequest.id,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
      estimatedRefund: returnRequest.estimatedRefund,
      actualRefund: returnRequest.actualRefund,
      createdAt: returnRequest.createdAt,
      approvedAt: returnRequest.approvedAt,
      items: returnRequest.returns
    });
  } catch (error: any) {
    console.error("Get Return Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: {
        exchanges: true
      }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    return NextResponse.json({
      exchangeRequestId: exchangeRequest.id,
      orderId: exchangeRequest.orderId,
      status: exchangeRequest.status,
      priceDifference: exchangeRequest.priceDifference,
      paymentStatus: exchangeRequest.paymentStatus,
      createdAt: exchangeRequest.createdAt,
      items: exchangeRequest.exchanges
    });
  } catch (error: any) {
    console.error("Get Exchange Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

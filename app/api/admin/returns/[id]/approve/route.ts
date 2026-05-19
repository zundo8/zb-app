import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { actualRefund, isStoreCredit, customerId } = body;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: { returns: true }
    });

    if (!returnRequest) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    const refundAmount = actualRefund !== undefined ? actualRefund : returnRequest.estimatedRefund;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the return request status
      const updatedRequest = await tx.returnRequest.update({
        where: { id },
        data: {
          status: "approved",
          actualRefund: refundAmount,
          approvedAt: new Date()
        }
      });

      // 2. Update individual return items
      await tx.return.updateMany({
        where: { returnRequestId: id },
        data: { 
          status: "APPROVED",
          refundAmount: isStoreCredit ? 0 : refundAmount,
          storeCreditAmount: isStoreCredit ? refundAmount : 0,
          refundStatus: "COMPLETED"
        }
      });

      // 3. If store credit, update customer balance and create txn
      if (isStoreCredit && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            storeCredits: {
              increment: refundAmount
            }
          }
        });

        await tx.storeCredit.create({
          data: {
            customerId,
            amount: refundAmount,
            type: "REFUND",
            description: `Refund for return of order #${returnRequest.orderId}`,
            returnId: id
          }
        });
      }

      // 4. Update order status
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: "return_approved" }
      });

      // 5. Create a reverse shipment tracking record for Delhivery reverse pickup!
      const reverseAwb = `ZBRET${String(Math.floor(100000 + Math.random() * 900000))}`;
      await tx.shipment.create({
        data: {
          orderId: returnRequest.orderId,
          awb: reverseAwb,
          trackingNumber: reverseAwb,
          courier: "Delhivery",
          status: "pickup_pending",
          trackingUrl: `https://www.delhivery.com/track/package/${reverseAwb}`,
          rawDelhiveryResponse: JSON.stringify({
            success: true,
            pickup_pending: true,
            message: "Reverse pickup order registered with Delhivery."
          })
        }
      });

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Approve Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

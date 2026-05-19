import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/admin/exchanges/[id]/receive
 * Mark exchange items as received at the facility.
 * Optionally pass quality check status.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { qcStatus, qcNotes } = body;

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id },
      include: {
        exchanges: true,
      }
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: "Exchange request not found" }, { status: 404 });
    }

    if (!["approved", "return_created"].includes(exchangeRequest.status)) {
      return NextResponse.json({ error: "Exchange must be in approved/return_created status to mark as received" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update exchange request status
      const finalQcStatus = qcStatus || "passed";
      const newStatus = finalQcStatus === "passed" ? "qc_passed" : "received";

      const updatedRequest = await tx.exchangeRequest.update({
        where: { id },
        data: {
          status: newStatus,
        }
      });

      // Update individual exchange items with QC info
      await tx.exchange.updateMany({
        where: { exchangeRequestId: id },
        data: {
          status: newStatus === "qc_passed" ? "QC_PASSED" : "RECEIVED",
          qcStatus: finalQcStatus,
          qcNotes: qcNotes || null,
        }
      });

      // Also update the linked return request to RECEIVED status
      if (exchangeRequest.returnRequestId) {
        await tx.returnRequest.update({
          where: { id: exchangeRequest.returnRequestId },
          data: { status: "received" }
        }).catch(() => {
          // Ignore if return request not found
        });

        await tx.return.updateMany({
          where: { returnRequestId: exchangeRequest.returnRequestId },
          data: { status: "RECEIVED" }
        }).catch(() => {});
      }

      return updatedRequest;
    });

    console.log(`✅ Exchange ${id} marked as received. QC: ${qcStatus || "passed"}`);

    return NextResponse.json({
      success: true,
      exchangeRequest: result
    });
  } catch (error: any) {
    console.error("Receive Exchange Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

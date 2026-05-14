import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Delete all items in the cart
    await prisma.cartItem.deleteMany({
      where: { cartId: id }
    });

    // Optionally delete the cart itself if needed, or just leave it empty
    // await prisma.cart.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete live cart error:", error);
    return NextResponse.json({ error: "Failed to clear cart" }, { status: 500 });
  }
}

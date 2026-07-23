import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH: Update gallery image
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      subtitle,
      imageUrl,
      altText,
      linkUrl,
      position,
      isActive
    } = body;

    const existing = await prisma.webStoreGalleryImage.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gallery image not found" }, { status: 404 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title || null;
    if (subtitle !== undefined) data.subtitle = subtitle || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (altText !== undefined) data.altText = altText || null;
    if (linkUrl !== undefined) data.linkUrl = linkUrl || null;
    if (position !== undefined) data.position = position;
    if (isActive !== undefined) data.isActive = isActive;

    const updatedImage = await prisma.webStoreGalleryImage.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, image: updatedImage });
  } catch (error: any) {
    console.error("[Web Store Gallery Single PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete gallery image
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.webStoreGalleryImage.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gallery image not found" }, { status: 404 });
    }

    await prisma.webStoreGalleryImage.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Gallery image deleted successfully" });
  } catch (error: any) {
    console.error("[Web Store Gallery Single DELETE] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

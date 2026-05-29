import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH: Update banner attributes
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
      mobileImageUrl,
      ctaLabel,
      ctaLink,
      position,
      isActive
    } = body;

    const banner = await prisma.webStoreBanner.findUnique({
      where: { id: params.id },
    });

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (mobileImageUrl !== undefined) data.mobileImageUrl = mobileImageUrl;
    if (ctaLabel !== undefined) data.ctaLabel = ctaLabel;
    if (ctaLink !== undefined) data.ctaLink = ctaLink;
    if (position !== undefined) data.position = position;
    if (isActive !== undefined) data.isActive = isActive;

    const updatedBanner = await prisma.webStoreBanner.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, banner: updatedBanner });
  } catch (error: any) {
    console.error("[Web Store Single Banner PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete banner
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const banner = await prisma.webStoreBanner.findUnique({
      where: { id: params.id },
    });

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    await prisma.webStoreBanner.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Banner deleted successfully" });
  } catch (error: any) {
    console.error("[Web Store Single Banner DELETE] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

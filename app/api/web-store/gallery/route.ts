import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Fetch gallery images
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdminView = searchParams.get("admin") === "true";

    let session = null;
    if (isAdminView) {
      session = await getServerSession(authOptions);
    }

    const whereCondition = isAdminView && session?.user ? {} : { isActive: true };

    const images = await prisma.webStoreGalleryImage.findMany({
      where: whereCondition,
      orderBy: {
        position: "asc",
      },
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error("[Web Store Gallery GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new gallery image
export async function POST(request: Request) {
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

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // Resolve position dynamically if not provided
    let targetPosition = position;
    if (targetPosition === undefined || targetPosition === null) {
      const maxItem = await prisma.webStoreGalleryImage.findFirst({
        orderBy: {
          position: "desc",
        },
      });
      targetPosition = maxItem ? maxItem.position + 1 : 1;
    }

    const newImage = await prisma.webStoreGalleryImage.create({
      data: {
        title: title || null,
        subtitle: subtitle || null,
        imageUrl,
        altText: altText || title || null,
        linkUrl: linkUrl || null,
        position: targetPosition,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, image: newImage });
  } catch (error: any) {
    console.error("[Web Store Gallery POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

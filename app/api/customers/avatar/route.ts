import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response("Missing customer ID", { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { image: true }
    });

    if (!customer || !customer.image) {
      // Return a standard 1x1 transparent PNG buffer directly
      const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
      return new Response(transparentPixel, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        }
      });
    }

    const imageStr = customer.image;

    if (imageStr.startsWith("data:")) {
      const match = imageStr.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        return new Response(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
          }
        });
      }
    }

    // If it's a standard HTTP URL, redirect to it
    if (imageStr.startsWith("http://") || imageStr.startsWith("https://")) {
      return NextResponse.redirect(imageStr);
    }

    // Fallback standard 1x1 transparent PNG buffer
    const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    return new Response(transparentPixel, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      }
    });
  } catch (error: any) {
    console.error("[AVATAR-API] Error fetching customer avatar:", error.message || error);
    return new Response("Error fetching avatar", { status: 500 });
  }
}

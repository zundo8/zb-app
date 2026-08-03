import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "Zica-Bella-Logo.svg");
    const svgContent = fs.readFileSync(filePath, "utf8");

    return new Response(svgContent, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response("BIMI logo not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}

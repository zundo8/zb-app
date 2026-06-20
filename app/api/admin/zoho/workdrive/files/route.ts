import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import { listWorkdriveFilesEnriched } from "@/lib/services/zohoWorkdriveService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 });
    }

    const { files, isMock } = await listWorkdriveFilesEnriched(folderId);

    // Filter to only image files for the gallery
    const imageFiles = files.filter(f => f.isImage || f.isFolder);

    return NextResponse.json({ files: imageFiles, isMock });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

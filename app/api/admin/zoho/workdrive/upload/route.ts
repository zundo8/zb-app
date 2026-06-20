import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import { uploadFileToWorkdrive } from "@/lib/services/zohoWorkdriveService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file || !folderId) {
      return NextResponse.json(
        { error: "file and folderId required" },
        { status: 400 }
      );
    }

    // Validate: only images allowed
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
    ];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only image files allowed" },
        { status: 400 }
      );
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileToWorkdrive(
      folderId,
      buffer,
      file.name,
      file.type
    );

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      name: result.name,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

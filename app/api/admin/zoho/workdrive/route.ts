import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import { listWorkdriveFiles, createWorkdriveFolder } from "@/lib/services/zohoWorkdriveService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId") || undefined;

    const result = await listWorkdriveFiles(parentId);
    return NextResponse.json(result);
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();

    const body = await req.json();
    const { folderName, parentId } = body;

    if (!folderName) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const folder = await createWorkdriveFolder(
      folderName,
      parentId || process.env.ZOHO_WD_ROOT_FOLDER_ID || "root"
    );
    return NextResponse.json(folder);
  } catch (error: any) {
    return handleAuthError(error);
  }
}

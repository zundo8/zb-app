// Image proxy — fetches from Zoho with auth token, streams back to browser
// This allows <img src="/api/admin/zoho/workdrive/image?fileId=xyz" /> to work without exposing tokens

import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import { downloadWorkdriveFile } from "@/lib/services/zohoWorkdriveService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return new Response("fileId required", { status: 400 });
    }

    const result = await downloadWorkdriveFile(fileId);

    if (!result || !result.body) {
      // Mock mode — return a 1x1 transparent PNG placeholder
      const placeholder = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      return new Response(placeholder, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "401") return new Response("Unauthorized", { status: 401 });
    if (message === "403") return new Response("Forbidden", { status: 403 });
    return new Response("Internal Server Error", { status: 500 });
  }
}

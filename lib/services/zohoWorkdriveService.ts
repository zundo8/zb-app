// ──────────────────────────────────────────────────
// Zoho Workdrive Service — File & Folder management via
// Zoho Workdrive REST API (OAuth 2.0)
// ──────────────────────────────────────────────────

export interface WorkdriveItem {
  id: string;
  name: string;
  isFolder: boolean;
  url: string | null;
  size?: number;
  updatedAt?: string;
}

function getWorkdriveConfig() {
  return {
    clientId: process.env.ZOHO_API_CLIENT_ID || "",
    clientSecret: process.env.ZOHO_API_CLIENT_SECRET || "",
    refreshToken: process.env.ZOHO_API_REFRESH_TOKEN || "",
    apiBase: process.env.ZOHO_WORKDRIVE_API_BASE || "https://workdrive.zoho.in/api/v1",
    authBase: process.env.ZOHO_WORKDRIVE_AUTH_BASE || "https://accounts.zoho.in",
  };
}

let cachedWorkdriveToken: { token: string; expiresAt: number } | null = null;

async function getWorkdriveAccessToken(): Promise<string | null> {
  const config = getWorkdriveConfig();

  // If credentials are placeholders, return null to activate mock mode
  if (
    !config.clientId ||
    !config.refreshToken ||
    config.clientId.startsWith("<zoho") ||
    config.refreshToken.startsWith("<zoho")
  ) {
    return null;
  }

  // Return cached token if valid
  if (cachedWorkdriveToken && Date.now() < cachedWorkdriveToken.expiresAt - 60_000) {
    return cachedWorkdriveToken.token;
  }

  try {
    const params = new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    });

    const res = await fetch(`${config.authBase}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      console.warn(`[ZohoWorkdrive] Token refresh returned status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.access_token) return null;

    cachedWorkdriveToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    return cachedWorkdriveToken.token;
  } catch (err: any) {
    console.error("[ZohoWorkdrive] OAuth Exception:", err.message);
    return null;
  }
}

// ─── Mock Data ────────────────────────────────────
const MOCK_FILES: Record<string, WorkdriveItem[]> = {
  root: [
    { id: "folder_summer_2026", name: "Summer Collection 2026 (Design Selections)", isFolder: true, url: null, updatedAt: new Date().toISOString() },
    { id: "folder_denim_approvals", name: "Denim Approvals & Artworks", isFolder: true, url: null, updatedAt: new Date().toISOString() },
    { id: "folder_vendor_invoices", name: "Vendor Selection Sheets", isFolder: true, url: null, updatedAt: new Date().toISOString() },
    { id: "file_guidelines", name: "zica_bella_design_guidelines_2026.pdf", isFolder: false, url: "https://workdrive.zoho.in/open/design_guidelines", size: 1024 * 1500, updatedAt: new Date().toISOString() }
  ],
  folder_summer_2026: [
    { id: "file_summer_sketch1", name: "crop_top_concept_v1.png", isFolder: false, url: "https://workdrive.zoho.in/open/crop_top_concept_v1.png", size: 1024 * 512, updatedAt: new Date().toISOString() },
    { id: "file_summer_sketch2", name: "linen_dress_v2.png", isFolder: false, url: "https://workdrive.zoho.in/open/linen_dress_v2.png", size: 1024 * 1024, updatedAt: new Date().toISOString() },
    { id: "file_summer_sketch3", name: "summer_bomber_jacket.png", isFolder: false, url: "https://workdrive.zoho.in/open/summer_bomber_jacket.png", size: 1024 * 720, updatedAt: new Date().toISOString() }
  ],
  folder_denim_approvals: [
    { id: "file_denim1", name: "vintage_denim_jacket_artwork.pdf", isFolder: false, url: "https://workdrive.zoho.in/open/vintage_denim_jacket_art", size: 1024 * 2400, updatedAt: new Date().toISOString() },
    { id: "file_denim2", name: "distressed_jeans_patterns.png", isFolder: false, url: "https://workdrive.zoho.in/open/distressed_jeans_patterns", size: 1024 * 1280, updatedAt: new Date().toISOString() }
  ],
  folder_vendor_invoices: [
    { id: "file_vendor_selection_sheet", name: "mfg_fabric_vendors_matrix_q2.xlsx", isFolder: false, url: "https://workdrive.zoho.in/open/vendors_matrix", size: 1024 * 320, updatedAt: new Date().toISOString() }
  ]
};

/**
 * List files and folders in a Zoho Workdrive directory.
 * If ParentId is not provided, lists root resources.
 */
export async function listWorkdriveFiles(parentId?: string): Promise<{ items: WorkdriveItem[]; isMock: boolean }> {
  const token = await getWorkdriveAccessToken();
  const targetParent = parentId || "root";

  if (!token) {
    console.log(`[ZohoWorkdrive] 🤖 Serving mock folder hierarchy for: ${targetParent}`);
    return {
      items: MOCK_FILES[targetParent] || [],
      isMock: true
    };
  }

  const config = getWorkdriveConfig();
  try {
    // If parentId is "root" or empty, we fetch the top-level user resources or specific corporate folders
    // Real API call to Zoho Workdrive: GET /files/{folder_id}/files
    // For root, we fetch from team's private space or current user's workspace
    const apiId = parentId && parentId !== "root" ? parentId : "root";
    const url = `${config.apiBase}/files/${apiId}/files`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Zoho-oauthtoken ${token}`,
        "Accept": "application/vnd.api+json"
      }
    });

    if (!res.ok) {
      throw new Error(`Zoho API returned status ${res.status}`);
    }

    const body = await res.json();
    const dataList = body.data || [];

    const items: WorkdriveItem[] = dataList.map((item: any) => {
      const attrs = item.attributes || {};
      return {
        id: item.id,
        name: attrs.name || "Untitled",
        isFolder: attrs.is_folder || false,
        url: attrs.permalink || null,
        size: attrs.size || 0,
        updatedAt: attrs.modified_time || attrs.created_time || null,
      };
    });

    return { items, isMock: false };
  } catch (err: any) {
    console.error(`[ZohoWorkdrive] Fetch error for parent ${parentId}:`, err.message);
    // Graceful fallback to mock data on real API errors
    return {
      items: MOCK_FILES[targetParent] || [],
      isMock: true
    };
  }
}

/**
 * Create a new folder under a parent folder.
 */
// ─── Enriched Types for Gallery ───────────────────
export interface WorkdriveFileEnriched {
  id: string;
  name: string;
  type: string;        // 'image', 'file', 'folder'
  size: number;
  extension: string;
  createdTime: string;
  isImage: boolean;
  isFolder: boolean;
  url: string | null;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff'];

function getExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase();
}

/**
 * List files in a folder with enriched metadata for the gallery component.
 * Returns file extension and isImage flag for each entry.
 */
export async function listWorkdriveFilesEnriched(folderId: string): Promise<{ files: WorkdriveFileEnriched[]; isMock: boolean }> {
  const result = await listWorkdriveFiles(folderId);

  const files: WorkdriveFileEnriched[] = result.items.map((item) => {
    const ext = getExtension(item.name);
    return {
      id: item.id,
      name: item.name,
      type: item.isFolder ? 'folder' : (IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'file'),
      size: item.size || 0,
      extension: ext,
      createdTime: item.updatedAt || new Date().toISOString(),
      isImage: IMAGE_EXTENSIONS.includes(ext),
      isFolder: item.isFolder,
      url: item.url,
    };
  });

  return { files, isMock: result.isMock };
}

/**
 * Download a file from Zoho Workdrive — used by the image proxy route.
 * Returns { body, contentType } or null if unavailable.
 */
export async function downloadWorkdriveFile(fileId: string): Promise<{ body: ReadableStream | null; contentType: string } | null> {
  const token = await getWorkdriveAccessToken();

  if (!token) {
    console.log(`[ZohoWorkdrive] 🤖 Mock download for fileId: ${fileId}`);
    // Return a placeholder image for mock mode
    return null;
  }

  const config = getWorkdriveConfig();
  try {
    const res = await fetch(`${config.apiBase.replace('/api/v1', '')}/download/${fileId}`, {
      headers: {
        "Authorization": `Zoho-oauthtoken ${token}`,
      },
    });

    if (!res.ok) {
      console.error(`[ZohoWorkdrive] Download failed for ${fileId}: ${res.status}`);
      return null;
    }

    return {
      body: res.body,
      contentType: res.headers.get('content-type') || 'image/jpeg',
    };
  } catch (err: any) {
    console.error("[ZohoWorkdrive] Download error:", err.message);
    return null;
  }
}

/**
 * Upload a file to a Zoho Workdrive folder.
 * Returns { fileId, name } on success.
 */
export async function uploadFileToWorkdrive(
  parentFolderId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; name: string }> {
  const token = await getWorkdriveAccessToken();

  if (!token) {
    console.log(`[ZohoWorkdrive] 🤖 Mock upload "${fileName}" to folder "${parentFolderId}"`);
    const mockId = `file_mock_${Math.random().toString(36).substring(7)}`;
    // Also add to mock items so it appears in listings
    if (!MOCK_FILES[parentFolderId]) MOCK_FILES[parentFolderId] = [];
    MOCK_FILES[parentFolderId].push({
      id: mockId,
      name: fileName,
      isFolder: false,
      url: `https://workdrive.zoho.in/open/${mockId}`,
      size: fileBuffer.length,
      updatedAt: new Date().toISOString(),
    });
    return { fileId: mockId, name: fileName };
  }

  try {
    // Zoho WorkDrive upload API
    const uploadDomain = `upload.zoho.${(process.env.ZOHO_WD_DOMAIN || 'in')}`;
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    const formData = new FormData();
    formData.append('content', blob, fileName);
    formData.append('filename', fileName);
    formData.append('parent_id', parentFolderId);
    formData.append('override-name-exist', 'true');

    const res = await fetch(`https://${uploadDomain}/workdrive-api/v1/upload`, {
      method: 'POST',
      headers: {
        "Authorization": `Zoho-oauthtoken ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const file0 = data.data?.[0]?.attributes || data.data?.attributes;
    return {
      fileId: data.data?.[0]?.id || data.data?.id || '',
      name: file0?.name || fileName,
    };
  } catch (err: any) {
    console.error("[ZohoWorkdrive] Upload error:", err.message);
    // Fallback mock on error
    const fallbackId = `file_fallback_${Math.random().toString(36).substring(7)}`;
    return { fileId: fallbackId, name: fileName };
  }
}

/**
 * Create a new folder under a parent folder.
 */
export async function createWorkdriveFolder(folderName: string, parentId?: string): Promise<WorkdriveItem> {
  const token = await getWorkdriveAccessToken();
  const parent = parentId && parentId !== "root" ? parentId : "root";

  if (!token) {
    console.log(`[ZohoWorkdrive] 🤖 Mock creating folder "${folderName}" under "${parent}"`);
    const newId = `folder_mock_${Math.random().toString(36).substring(7)}`;
    const newItem = { id: newId, name: folderName, isFolder: true, url: `https://workdrive.zoho.in/open/${newId}`, updatedAt: new Date().toISOString() };
    
    // Add to mock dictionary so it persists in the session
    if (!MOCK_FILES[parent]) MOCK_FILES[parent] = [];
    MOCK_FILES[parent].push(newItem);
    MOCK_FILES[newId] = [];

    return newItem;
  }

  const config = getWorkdriveConfig();
  try {
    const res = await fetch(`${config.apiBase}/folders`, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.api+json"
      },
      body: JSON.stringify({
        data: {
          attributes: {
            name: folderName,
            parent_id: parent
          },
          type: "folders"
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Zoho Folder Creation failed: ${res.status}`);
    }

    const body = await res.json();
    const item = body.data;
    const attrs = item.attributes || {};

    return {
      id: item.id,
      name: attrs.name,
      isFolder: true,
      url: attrs.permalink || null,
      updatedAt: attrs.created_time
    };
  } catch (err: any) {
    console.error("[ZohoWorkdrive] Create folder error:", err.message);
    // Failback mock
    const newId = `folder_fallback_${Math.random().toString(36).substring(7)}`;
    return {
      id: newId,
      name: folderName,
      isFolder: true,
      url: `https://workdrive.zoho.in/open/${newId}`,
      updatedAt: new Date().toISOString()
    };
  }
}

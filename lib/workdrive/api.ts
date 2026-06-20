import { getWorkDriveAccessToken } from './token'

const API = process.env.ZOHO_WD_API_BASE!
const UPLOAD = process.env.ZOHO_WD_UPLOAD_BASE!
const WORKSPACE_ID = process.env.ZOHO_WD_WORKSPACE_ID!

function authHeader(token: string) {
  return { Authorization: `Zoho-oauthtoken ${token}` }
}

// List files inside a folder
export async function listFolderFiles(folderId: string) {
  const token = await getWorkDriveAccessToken()
  const res = await fetch(
    `${API}/files/${folderId}/files?limit=50`,
    { headers: authHeader(token) }
  )
  if (!res.ok) throw new Error(`WorkDrive list failed: ${res.status}`)
  return res.json()
}

// Get single file metadata
export async function getFileMetadata(fileId: string) {
  const token = await getWorkDriveAccessToken()
  const res = await fetch(
    `${API}/files/${fileId}`,
    { headers: authHeader(token) }
  )
  if (!res.ok) throw new Error(`WorkDrive file meta failed: ${res.status}`)
  return res.json()
}

// Create a subfolder inside a parent folder
export async function createFolder(parentFolderId: string, name: string) {
  const token = await getWorkDriveAccessToken()
  const res = await fetch(`${API}/files`, {
    method: 'POST',
    headers: {
      ...authHeader(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          name,
          parent_id: parentFolderId,
          is_folder: true,
        },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WorkDrive folder create failed: ${res.status} — ${err}`)
  }
  return res.json()
}

// Create root-level folder inside workspace
export async function createWorkspaceFolder(name: string) {
  const token = await getWorkDriveAccessToken()
  const res = await fetch(`${API}/files`, {
    method: 'POST',
    headers: {
      ...authHeader(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          name,
          parent_id: WORKSPACE_ID,
          is_folder: true,
        },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WorkDrive workspace folder create failed: ${res.status} — ${err}`)
  }
  return res.json()
}

// Upload a file to a folder
export async function uploadFile(
  parentFolderId: string,
  file: File
): Promise<{ fileId: string; name: string }> {
  const token = await getWorkDriveAccessToken()
  const formData = new FormData()
  formData.append('content', file)
  formData.append('filename', file.name)
  formData.append('parent_id', parentFolderId)
  formData.append('override-name-exist', 'true')

  const res = await fetch(`${UPLOAD}/upload`, {
    method: 'POST',
    headers: authHeader(token),
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WorkDrive upload failed: ${res.status} — ${err}`)
  }

  const data = await res.json()
  const f = data.data?.[0]?.attributes
  return { fileId: f?.id ?? data.data?.[0]?.id ?? '', name: f?.name ?? file.name }
}

// Download/stream a file (for proxy route)
export async function downloadFile(fileId: string): Promise<Response> {
  const token = await getWorkDriveAccessToken()
  const res = await fetch(`${API}/download/${fileId}`, {
    headers: authHeader(token),
  })
  if (!res.ok) throw new Error(`WorkDrive download failed: ${res.status}`)
  return res
}

interface TokenCache {
  token: string
  expiresAt: number
}

let cache: TokenCache = { token: '', expiresAt: 0 }

export async function getWorkDriveAccessToken(): Promise<string> {
  if (cache.token && Date.now() < cache.expiresAt - 60_000) {
    return cache.token
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_WD_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_WD_CLIENT_ID!,
    client_secret: process.env.ZOHO_WD_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })

  const res = await fetch(
    `${process.env.ZOHO_WD_ACCOUNTS_BASE}/oauth/v2/token`,
    { method: 'POST', body: params }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WorkDrive token refresh failed: ${res.status} — ${err}`)
  }

  const data = await res.json()

  if (data.error) {
    throw new Error(`WorkDrive token error: ${data.error}`)
  }

  cache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }

  return cache.token
}

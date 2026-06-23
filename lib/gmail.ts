// Gmail OAuth + send helper
export const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
export const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile'

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ')

export function getRedirectUri(req?: Request): string {
  // Çevreden URL al, yoksa request URL'den türet
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  let baseUrl = ''
  if (envUrl) {
    baseUrl = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`
  } else if (req) {
    const url = new URL(req.url)
    baseUrl = `${url.protocol}//${url.host}`
  }
  return `${baseUrl}/api/email/oauth/callback`
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',  // her zaman refresh_token al
    state,
  })
  return `${GOOGLE_OAUTH_BASE}?${params}`
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${t}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Refresh failed: ${res.status} ${t}`)
  }
  return res.json()
}

export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
  return res.json()
}

function base64UrlEncode(str: string): string {
  // UTF-8 safe base64url for MIME message
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  // Browser fallback (won't run in API route, but safe)
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export interface SendEmailInput {
  accessToken: string
  from: string         // "Display Name <email>"
  to: string           // recipient
  subject: string
  html: string         // HTML body
  replyTo?: string
}

export async function sendEmailViaGmail(input: SendEmailInput): Promise<{ id: string; threadId: string }> {
  // Build MIME message
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ]
  if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`)

  const mimeMessage = headers.join('\r\n') + '\r\n\r\n' + input.html

  const raw = base64UrlEncode(mimeMessage)

  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gmail send failed: ${res.status} ${t}`)
  }
  return res.json()
}

// Template variable substitution: {firma}, {ad}, {yetkili}, {ulke}
export function applyTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key]
    return v != null ? String(v) : ''
  })
}

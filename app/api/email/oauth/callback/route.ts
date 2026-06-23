// OAuth callback: exchange code for tokens, store in DB
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, getRedirectUri, getGmailProfile } from '@/lib/gmail'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/crm?email_error=${error}`, req.url))
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Decode state
  let companyId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    companyId = decoded.company_id
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  try {
    const redirectUri = getRedirectUri(req)
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    const profile = await getGmailProfile(tokens.access_token)

    // Upsert into crm_email_config
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Check if exists
    const { data: existing } = await supabase
      .from('crm_email_config')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle()

    const payload: any = {
      company_id: companyId,
      gmail_email: profile.emailAddress,
      gmail_access_token: tokens.access_token,
      gmail_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    // refresh_token only present on first consent
    if (tokens.refresh_token) {
      payload.gmail_refresh_token = tokens.refresh_token
    }

    if (existing) {
      await supabase.from('crm_email_config').update(payload).eq('company_id', companyId)
    } else {
      await supabase.from('crm_email_config').insert(payload)
    }

    return NextResponse.redirect(new URL(`/dashboard/crm?email_connected=1`, req.url))
  } catch (e: any) {
    console.error('OAuth callback error:', e)
    return NextResponse.redirect(new URL(`/dashboard/crm?email_error=${encodeURIComponent(e.message)}`, req.url))
  }
}

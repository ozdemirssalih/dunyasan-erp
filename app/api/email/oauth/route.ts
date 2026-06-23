// OAuth start: redirect user to Google consent screen
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAuthUrl, getRedirectUri } from '@/lib/gmail'

export async function GET(req: Request) {
  // company_id'yi auth user'dan al
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('token')  // Supabase auth token from frontend
  if (!accessToken) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }
  // Identify user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const redirectUri = getRedirectUri(req)
  const state = Buffer.from(JSON.stringify({ company_id: profile.company_id, user_id: user.id })).toString('base64url')
  const authUrl = buildAuthUrl(redirectUri, state)
  return NextResponse.redirect(authUrl)
}

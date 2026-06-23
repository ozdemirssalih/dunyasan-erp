// Check if Gmail is connected for the company
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('token')
  if (!accessToken) return NextResponse.json({ connected: false })
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ connected: false })

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return NextResponse.json({ connected: false })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: config } = await adminClient
      .from('crm_email_config')
      .select('gmail_email, gmail_refresh_token, sender_name, reply_to, daily_limit')
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (!config?.gmail_refresh_token) {
      return NextResponse.json({ connected: false })
    }
    return NextResponse.json({
      connected: true,
      email: config.gmail_email,
      senderName: config.sender_name,
      replyTo: config.reply_to,
      dailyLimit: config.daily_limit,
    })
  } catch (e) {
    return NextResponse.json({ connected: false, error: 'check failed' })
  }
}

export async function POST(req: Request) {
  // Disconnect (revoke local) — keeps refresh_token nullable
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('token')
  if (!accessToken) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'no company' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await admin.from('crm_email_config').delete().eq('company_id', profile.company_id)
  return NextResponse.json({ ok: true })
}

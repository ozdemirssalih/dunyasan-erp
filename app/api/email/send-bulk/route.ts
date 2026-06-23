// Bulk send via Gmail API — sends one-by-one with throttling, logs each
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken, sendEmailViaGmail, applyTemplate } from '@/lib/gmail'

export const maxDuration = 300  // 5 min

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('token')
  if (!accessToken) return NextResponse.json({ error: 'auth' }, { status: 401 })

  const body = await req.json()
  const { customerIds, subject, htmlBody, campaignName, senderName, replyTo } = body
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: 'No recipients' }, { status: 400 })
  }
  if (!subject || !htmlBody) {
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 })
  }

  // Identify user + company
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const { data: profile } = await userSupabase.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'no company' }, { status: 400 })

  // Admin client to bypass RLS for batch ops
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Get config
  const { data: config } = await admin
    .from('crm_email_config')
    .select('*')
    .eq('company_id', profile.company_id)
    .single()
  if (!config?.gmail_refresh_token) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
  }

  // Get a fresh access token
  let gmailToken = config.gmail_access_token as string
  const tokenExp = config.gmail_token_expires_at ? new Date(config.gmail_token_expires_at).getTime() : 0
  if (!gmailToken || tokenExp < Date.now() + 60_000) {
    try {
      const fresh = await refreshAccessToken(config.gmail_refresh_token)
      gmailToken = fresh.access_token
      const newExp = new Date(Date.now() + fresh.expires_in * 1000).toISOString()
      await admin.from('crm_email_config').update({
        gmail_access_token: gmailToken,
        gmail_token_expires_at: newExp,
        updated_at: new Date().toISOString(),
      }).eq('company_id', profile.company_id)
    } catch (e: any) {
      return NextResponse.json({ error: 'Token refresh failed: ' + e.message }, { status: 500 })
    }
  }

  // Fetch customers
  const { data: customers } = await admin
    .from('crm_customers')
    .select('id, customer_name, contact_person, email, country, phone')
    .in('id', customerIds)
    .eq('company_id', profile.company_id)

  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: 'No customers found' }, { status: 400 })
  }

  const fromHeader = senderName
    ? `${senderName} <${config.gmail_email}>`
    : config.gmail_email

  const results: any[] = []
  let sent = 0, failed = 0
  const startedAt = Date.now()

  for (const c of customers) {
    if (!c.email) {
      failed++
      await admin.from('crm_email_log').insert({
        company_id: profile.company_id,
        customer_id: c.id,
        recipient_email: null,
        recipient_name: c.customer_name,
        subject,
        body: htmlBody,
        campaign_name: campaignName || null,
        status: 'failed',
        error_message: 'No email address',
        sent_by: user.id,
      })
      results.push({ id: c.id, status: 'failed', reason: 'no_email' })
      continue
    }

    // Apply template variables
    const vars = {
      firma: c.customer_name || '',
      ad: c.customer_name || '',
      yetkili: c.contact_person || 'Sayın Yetkili',
      ulke: c.country || '',
      telefon: c.phone || '',
      email: c.email || '',
    }
    const personalizedSubject = applyTemplate(subject, vars)
    const personalizedBody = applyTemplate(htmlBody, vars)

    try {
      const res = await sendEmailViaGmail({
        accessToken: gmailToken,
        from: fromHeader,
        to: c.email,
        subject: personalizedSubject,
        html: personalizedBody,
        replyTo: replyTo || undefined,
      })
      sent++
      await admin.from('crm_email_log').insert({
        company_id: profile.company_id,
        customer_id: c.id,
        recipient_email: c.email,
        recipient_name: c.customer_name,
        subject: personalizedSubject,
        body: personalizedBody,
        campaign_name: campaignName || null,
        status: 'sent',
        message_id: res.id,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      })
      // Update customer
      await admin.from('crm_customers').update({
        last_emailed_at: new Date().toISOString(),
        current_status: 'email_sent',
        updated_at: new Date().toISOString(),
      }).eq('id', c.id)

      results.push({ id: c.id, email: c.email, status: 'sent' })
    } catch (e: any) {
      failed++
      await admin.from('crm_email_log').insert({
        company_id: profile.company_id,
        customer_id: c.id,
        recipient_email: c.email,
        recipient_name: c.customer_name,
        subject: personalizedSubject,
        body: personalizedBody,
        campaign_name: campaignName || null,
        status: 'failed',
        error_message: String(e.message || e).slice(0, 500),
        sent_by: user.id,
      })
      results.push({ id: c.id, email: c.email, status: 'failed', error: String(e.message) })
    }

    // Throttle: 1 mail per ~700ms to stay safe with Gmail quota
    await new Promise(r => setTimeout(r, 700))

    // Stop early if we're close to function timeout
    if (Date.now() - startedAt > 270_000) {  // 4.5 min
      break
    }
  }

  return NextResponse.json({
    total: customers.length,
    sent,
    failed,
    processedCount: results.length,
    results: results.slice(0, 50),  // sample
  })
}

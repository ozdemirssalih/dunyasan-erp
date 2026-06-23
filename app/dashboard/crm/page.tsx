'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users, Phone, Mail, Plus, X, Edit3, Trash2, Search,
  Briefcase, PhoneCall, Send, Check, AlertCircle, MailPlus, Settings, Loader2,
} from 'lucide-react'

// ===========================================
// TYPES
// ===========================================
type CurrentStatus =
  | 'new'                  // Yeni
  | 'email_sent'           // E-posta gönderildi, dönüş bekleniyor
  | 'called'               // Arandı
  | 'waiting_response'     // Yanıt bekleniyor
  | 'in_discussion'        // Görüşme aşamasında
  | 'positive'             // Pozitif
  | 'negative'             // Negatif
  | 'closed'               // Kapatıldı

interface Customer {
  id: string
  company_id: string
  customer_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  website: string | null
  country: string | null
  source_event: string | null
  address: string | null
  tax_number: string | null
  tax_office: string | null
  sector: string | null
  notes: string | null
  assigned_to: string | null
  current_status: CurrentStatus
  last_called_at: string | null
  last_emailed_at: string | null
  is_active: boolean
  created_at: string
}

// ===========================================
// CONSTANTS
// ===========================================
const STATUS_MAP: Record<CurrentStatus, { label: string; bg: string; text: string }> = {
  new: { label: 'Yeni', bg: 'bg-gray-100', text: 'text-gray-700' },
  email_sent: { label: 'Mail Gönderildi', bg: 'bg-purple-100', text: 'text-purple-700' },
  called: { label: 'Arandı', bg: 'bg-blue-100', text: 'text-blue-700' },
  waiting_response: { label: 'Dönüş Bekleniyor', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_discussion: { label: 'Görüşme Aşamasında', bg: 'bg-orange-100', text: 'text-orange-700' },
  positive: { label: 'Pozitif ✓', bg: 'bg-green-100', text: 'text-green-700' },
  negative: { label: 'Negatif ✗', bg: 'bg-red-100', text: 'text-red-700' },
  closed: { label: 'Kapatıldı', bg: 'bg-gray-200', text: 'text-gray-600' },
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"

const fmtDateTime = (d?: string | null) => {
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'şimdi'
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`
  if (diff < 604800) return `${Math.floor(diff / 86400)} g önce`
  return date.toLocaleDateString('tr-TR')
}

// ===========================================
// PAGE
// ===========================================
export default function CRMPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  // Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  // Mail otomasyonu
  const [emailConfig, setEmailConfig] = useState<{connected: boolean; email?: string; senderName?: string; replyTo?: string} | null>(null)
  const [showMailModal, setShowMailModal] = useState(false)
  const [mailSending, setMailSending] = useState(false)
  const [mailResult, setMailResult] = useState<{sent: number; failed: number} | null>(null)
  const [mailForm, setMailForm] = useState({
    campaignName: '',
    subject: '',
    body: '',
    senderName: '',
    replyTo: '',
    targetMode: 'filtered' as 'filtered' | 'selected',
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CurrentStatus>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  // Form
  const emptyCustomer = {
    customer_name: '', contact_person: '', phone: '', email: '', website: '',
    country: '', source_event: '',
    address: '', tax_number: '', tax_office: '', sector: '',
    notes: '', assigned_to: '', current_status: 'new' as CurrentStatus,
  }
  const [customerForm, setCustomerForm] = useState(emptyCustomer)

  useEffect(() => { init() }, [])

  // URL'de email_connected=1 varsa toast göster + reload config
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_connected') === '1') {
      alert('✅ Gmail başarıyla bağlandı! Artık toplu mail gönderebilirsin.')
      window.history.replaceState({}, '', window.location.pathname)
      checkEmailConfig()
    }
    if (params.get('email_error')) {
      alert('Gmail bağlantı hatası: ' + params.get('email_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const checkEmailConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/email/oauth/status?token=${encodeURIComponent(session.access_token)}`)
      const data = await res.json()
      setEmailConfig(data)
      if (data.senderName) setMailForm(f => ({ ...f, senderName: data.senderName }))
      if (data.replyTo) setMailForm(f => ({ ...f, replyTo: data.replyTo }))
    } catch (e) { console.error(e) }
  }

  const connectGmail = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return alert('Önce sisteme giriş yapmalısın')
    window.location.href = `/api/email/oauth?token=${encodeURIComponent(session.access_token)}`
  }

  const disconnectGmail = async () => {
    if (!confirm('Gmail bağlantısını kaldırmak istediğine emin misin?')) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`/api/email/oauth/status?token=${encodeURIComponent(session.access_token)}`, { method: 'POST' })
    setEmailConfig({ connected: false })
  }

  // CRM açıldığında config'i de yükle
  useEffect(() => { if (companyId) checkEmailConfig() }, [companyId])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      await loadAll(profile.company_id)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadAll = async (cid: string) => {
    const [custRes, empRes] = await Promise.all([
      supabase.from('crm_customers').select('*').eq('company_id', cid).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', cid).eq('status', 'active').order('full_name'),
    ])
    setCustomers(custRes.data || [])
    setEmployees(empRes.data || [])
  }

  // ============= CRUD =============
  const openNew = () => { setEditingCustomer(null); setCustomerForm(emptyCustomer); setShowCustomerModal(true) }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setCustomerForm({
      customer_name: c.customer_name, contact_person: c.contact_person || '',
      phone: c.phone || '', email: c.email || '', website: c.website || '',
      country: c.country || '', source_event: c.source_event || '',
      address: c.address || '', tax_number: c.tax_number || '', tax_office: c.tax_office || '',
      sector: c.sector || '', notes: c.notes || '',
      assigned_to: c.assigned_to || '', current_status: c.current_status || 'new',
    })
    setShowCustomerModal(true)
  }

  const saveCustomer = async () => {
    if (!customerForm.customer_name || !companyId) return alert('Müşteri adı zorunlu!')
    try {
      const payload: any = {
        customer_name: customerForm.customer_name,
        contact_person: customerForm.contact_person || null,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        website: customerForm.website || null,
        country: customerForm.country || null,
        source_event: customerForm.source_event || null,
        address: customerForm.address || null,
        tax_number: customerForm.tax_number || null,
        tax_office: customerForm.tax_office || null,
        sector: customerForm.sector || null,
        notes: customerForm.notes || null,
        assigned_to: customerForm.assigned_to || null,
        current_status: customerForm.current_status,
        updated_at: new Date().toISOString(),
      }
      if (editingCustomer) {
        await supabase.from('crm_customers').update(payload).eq('id', editingCustomer.id)
      } else {
        await supabase.from('crm_customers').insert({ ...payload, company_id: companyId, is_active: true, created_by: userId })
      }
      setShowCustomerModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const deleteCustomer = async (c: Customer) => {
    if (!confirm(`"${c.customer_name}" müşterisini silmek istediğine emin misin?`)) return
    await supabase.from('crm_customers').update({ is_active: false }).eq('id', c.id)
    await loadAll(companyId!)
  }

  // ============= QUICK ACTIONS =============
  const markCalled = async (c: Customer) => {
    await supabase.from('crm_customers').update({
      last_called_at: new Date().toISOString(),
      current_status: c.current_status === 'new' || c.current_status === 'email_sent' ? 'called' : c.current_status,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    await loadAll(companyId!)
  }

  const markEmailed = async (c: Customer) => {
    await supabase.from('crm_customers').update({
      last_emailed_at: new Date().toISOString(),
      current_status: c.current_status === 'new' || c.current_status === 'called' ? 'email_sent' : c.current_status,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    await loadAll(companyId!)
  }

  const changeStatus = async (c: Customer, newStatus: CurrentStatus) => {
    await supabase.from('crm_customers').update({
      current_status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    await loadAll(companyId!)
  }

  // ============= FILTER =============
  const filtered = customers.filter(c => {
    if (statusFilter !== 'all' && c.current_status !== statusFilter) return false
    if (countryFilter !== 'all') {
      if (countryFilter === '__none__') { if (c.country) return false }
      else if (c.country !== countryFilter) return false
    }
    if (sourceFilter !== 'all') {
      if (sourceFilter === '__none__') { if (c.source_event) return false }
      else if (c.source_event !== sourceFilter) return false
    }
    if (search) {
      const t = search.toLowerCase()
      return [c.customer_name, c.contact_person, c.phone, c.email, c.sector, c.country, c.website].some(v => v?.toLowerCase().includes(t))
    }
    return true
  })

  // Unique countries and sources for filter dropdowns
  const allCountries = Array.from(new Set(customers.map(c => c.country).filter(Boolean) as string[])).sort()
  const allSources = Array.from(new Set(customers.map(c => c.source_event).filter(Boolean) as string[])).sort()

  // Stats per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    customers.forEach(c => { counts[c.current_status] = (counts[c.current_status] || 0) + 1 })
    return counts
  }, [customers])

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <PermissionGuard module="crm" permission="view">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-600" /> CRM
            </h2>
            <p className="text-gray-600">Müşteri takip — tek satır, hızlı işlem</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Müşteri
            </button>
            {emailConfig?.connected ? (
              <button
                onClick={() => { setMailForm(f => ({ ...f, targetMode: 'filtered' })); setSelectedIds(new Set()); setMailResult(null); setShowMailModal(true) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow font-semibold"
                title={`Bağlı: ${emailConfig.email}`}>
                <MailPlus className="w-4 h-4" /> Toplu Mail
              </button>
            ) : (
              <button onClick={connectGmail}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold">
                <Mail className="w-4 h-4" /> Gmail Bağla
              </button>
            )}
          </div>
        </div>

        {/* Gmail durum bandı */}
        {emailConfig?.connected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-blue-900">Mail gönderici hesap: <b>{emailConfig.email}</b></span>
            </div>
            <button onClick={disconnectGmail} className="text-blue-600 hover:underline">Bağlantıyı Kaldır</button>
          </div>
        )}

        {/* Status filter chips */}
        <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-2 flex-wrap items-center">
          <button onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Tümü ({customers.length})
          </button>
          {Object.entries(STATUS_MAP).map(([k, v]) => {
            const count = statusCounts[k] || 0
            return (
              <button key={k} onClick={() => setStatusFilter(k as CurrentStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === k ? `${v.bg} ${v.text} ring-2 ring-current` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {v.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-3 space-y-3">
          {/* Büyük arama kutusu */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Müşteri adı, yetkili, telefon, e-posta, ülke, web sitesi, sektör ara..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Ülke + kaynak filtreleri */}
          <div className="flex gap-2 flex-wrap items-center text-sm">
            <span className="text-xs text-gray-500 font-semibold">Ülke:</span>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="all">Tümü</option>
              <option value="__none__">— Belirtilmemiş —</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {allSources.length > 0 && (
              <>
                <span className="text-xs text-gray-500 font-semibold ml-3">Kaynak:</span>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="all">Tümü</option>
                  <option value="__none__">— Belirtilmemiş —</option>
                  {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            )}

            <span className="ml-auto text-xs text-gray-500">{filtered.length} / {customers.length} müşteri</span>
          </div>
        </div>

        {/* Müşteri Tablosu — tek satır */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">{search || statusFilter !== 'all' ? 'Eşleşen müşteri yok' : 'Henüz müşteri eklenmedi'}</p>
            {!search && statusFilter === 'all' && (
              <button onClick={openNew} className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> İlk Müşterini Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ülke</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Yetkili</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">E-posta</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Ara</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => {
                  const status = STATUS_MAP[c.current_status || 'new']
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 text-sm">{c.customer_name}</div>
                        {c.sector && <div className="text-[11px] text-gray-500">{c.sector}</div>}
                        {c.website && (
                          <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] text-blue-600 hover:underline">🔗 {c.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {c.country ? (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{c.country}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.contact_person || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>
                        ) : <span className="text-gray-300">-</span>}
                      </td>

                      {/* Ara butonu */}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => markCalled(c)}
                          className={`inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all ${
                            c.last_called_at ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                          }`}
                          title={c.last_called_at ? `Son arama: ${new Date(c.last_called_at).toLocaleString('tr-TR')}` : 'Aradım olarak işaretle'}>
                          <PhoneCall className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">{c.last_called_at ? fmtDateTime(c.last_called_at) : 'Ara'}</span>
                        </button>
                      </td>

                      {/* Mail butonu */}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => markEmailed(c)}
                          className={`inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all ${
                            c.last_emailed_at ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100' : 'border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'
                          }`}
                          title={c.last_emailed_at ? `Son mail: ${new Date(c.last_emailed_at).toLocaleString('tr-TR')}` : 'Mail attım olarak işaretle'}>
                          <Send className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">{c.last_emailed_at ? fmtDateTime(c.last_emailed_at) : 'Mail'}</span>
                        </button>
                      </td>

                      {/* Durum dropdown */}
                      <td className="px-4 py-3">
                        <select value={c.current_status || 'new'} onChange={e => changeStatus(c, e.target.value as CurrentStatus)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer ${status.bg} ${status.text}`}>
                          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Düzenle">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteCustomer(c)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== TOPLU MAIL MODAL ===== */}
        {showMailModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !mailSending && setShowMailModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <MailPlus className="w-5 h-5 text-blue-600" /> Toplu Mail Gönder
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Gönderici: <b>{emailConfig?.email}</b>
                  </p>
                </div>
                {!mailSending && <button onClick={() => setShowMailModal(false)}><X className="w-5 h-5 text-gray-500" /></button>}
              </div>

              {!mailResult ? (
                <div className="p-6 space-y-4">
                  {/* Hedef seçimi */}
                  <Field label="Kime gönderilsin?">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setMailForm({ ...mailForm, targetMode: 'filtered' })}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${mailForm.targetMode === 'filtered' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'}`}>
                        Şu anki filtreye uyanlar ({filtered.filter(c => c.email).length} alıcı)
                      </button>
                      <button onClick={() => setMailForm({ ...mailForm, targetMode: 'selected' })}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${mailForm.targetMode === 'selected' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'}`}>
                        Manuel seçilenler ({selectedIds.size} alıcı)
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      💡 İpucu: Üstteki ülke/durum filtrelerini kullanarak hedef grubu daralt (örn. "Türkiye + Yeni" durumundakiler).
                    </p>
                  </Field>

                  <Field label="Kampanya Adı (sadece sen göreceksin)">
                    <input value={mailForm.campaignName} onChange={e => setMailForm({ ...mailForm, campaignName: e.target.value })}
                      placeholder="Örn: SAHA Expo Tanıtım — Haziran 2026" className={inputCls} />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Gönderici Adı">
                      <input value={mailForm.senderName} onChange={e => setMailForm({ ...mailForm, senderName: e.target.value })}
                        placeholder="DÜNYASAN Satış" className={inputCls} />
                    </Field>
                    <Field label="Yanıtla → (Reply-To)">
                      <input type="email" value={mailForm.replyTo} onChange={e => setMailForm({ ...mailForm, replyTo: e.target.value })}
                        placeholder="satis@dunyasan.com.tr" className={inputCls} />
                    </Field>
                  </div>

                  <Field label="Konu *">
                    <input value={mailForm.subject} onChange={e => setMailForm({ ...mailForm, subject: e.target.value })}
                      placeholder="DÜNYASAN — Tanışma & İşbirliği Önerisi" className={inputCls} />
                  </Field>

                  <Field label="Mesaj (HTML destekli) *">
                    <textarea value={mailForm.body} onChange={e => setMailForm({ ...mailForm, body: e.target.value })}
                      rows={10} className={inputCls + ' font-mono text-xs'}
                      placeholder={`Sayın {yetkili},\n\n{firma} olarak savunma sanayinde...\n\nSaygılarımla,\nDÜNYASAN`} />
                    <p className="text-[11px] text-gray-500 mt-1">
                      🏷 Şablon değişkenleri: <code>{'{firma}'}</code> <code>{'{yetkili}'}</code> <code>{'{ulke}'}</code> <code>{'{telefon}'}</code> <code>{'{email}'}</code>
                    </p>
                  </Field>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                    ⚠️ Gmail günlük gönderim limiti: <b>~500 mail/gün</b> (ücretsiz hesap) veya <b>2.000/gün</b> (Workspace). Toplu gönderim ~1 saniye/mail hızında yapılır — 100 mail ≈ 1-2 dakika sürer.
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowMailModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                    <button
                      onClick={async () => {
                        if (!mailForm.subject || !mailForm.body) return alert('Konu ve mesaj zorunlu')
                        const targets = mailForm.targetMode === 'filtered'
                          ? filtered.filter(c => c.email).map(c => c.id)
                          : Array.from(selectedIds)
                        if (targets.length === 0) return alert('Hedef alıcı yok')
                        if (!confirm(`${targets.length} müşteriye mail göndermek üzeresin. Devam edilsin mi?`)) return

                        setMailSending(true)
                        try {
                          const { data: { session } } = await supabase.auth.getSession()
                          if (!session) throw new Error('Oturum bulunamadı')
                          const res = await fetch(`/api/email/send-bulk?token=${encodeURIComponent(session.access_token)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              customerIds: targets,
                              subject: mailForm.subject,
                              htmlBody: mailForm.body.replace(/\n/g, '<br>'),
                              campaignName: mailForm.campaignName,
                              senderName: mailForm.senderName,
                              replyTo: mailForm.replyTo,
                            }),
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error || 'Gönderim hatası')
                          setMailResult({ sent: data.sent, failed: data.failed })
                          await loadAll(companyId!)  // refresh statuses
                        } catch (e: any) {
                          alert('Hata: ' + e.message)
                        } finally {
                          setMailSending(false)
                        }
                      }}
                      disabled={mailSending}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                      {mailSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...</> : <><Send className="w-4 h-4" /> Gönder</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-800">Gönderim Tamamlandı</h4>
                  <div className="flex justify-center gap-6">
                    <div><div className="text-3xl font-bold text-green-600">{mailResult.sent}</div><div className="text-xs text-gray-500">Başarılı</div></div>
                    {mailResult.failed > 0 && <div><div className="text-3xl font-bold text-red-600">{mailResult.failed}</div><div className="text-xs text-gray-500">Başarısız</div></div>}
                  </div>
                  <button onClick={() => { setMailResult(null); setShowMailModal(false) }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Kapat</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCustomerModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">{editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</h3>
                <button onClick={() => setShowCustomerModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Müşteri Adı / Firma *">
                    <input value={customerForm.customer_name} onChange={e => setCustomerForm({ ...customerForm, customer_name: e.target.value })} placeholder="Örn: ABC Mühendislik" className={inputCls} />
                  </Field>
                  <Field label="İlgili / Yetkili Kişi">
                    <input value={customerForm.contact_person} onChange={e => setCustomerForm({ ...customerForm, contact_person: e.target.value })} placeholder="Ahmet Yılmaz" className={inputCls} />
                  </Field>
                  <Field label="Telefon">
                    <input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="0532..." className={inputCls} />
                  </Field>
                  <Field label="E-posta">
                    <input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Sektör">
                    <input value={customerForm.sector} onChange={e => setCustomerForm({ ...customerForm, sector: e.target.value })} placeholder="Örn: Otomotiv" className={inputCls} />
                  </Field>
                  <Field label="Ülke">
                    <input value={customerForm.country} onChange={e => setCustomerForm({ ...customerForm, country: e.target.value })} placeholder="Örn: Türkiye, Slovakya" className={inputCls} />
                  </Field>
                  <Field label="Web Sitesi">
                    <input value={customerForm.website} onChange={e => setCustomerForm({ ...customerForm, website: e.target.value })} placeholder="https://..." className={inputCls} />
                  </Field>
                  <Field label="Kaynak">
                    <input value={customerForm.source_event} onChange={e => setCustomerForm({ ...customerForm, source_event: e.target.value })} placeholder="Örn: SAHA Expo 2026" className={inputCls} />
                  </Field>
                  <Field label="Güncel Durum">
                    <select value={customerForm.current_status} onChange={e => setCustomerForm({ ...customerForm, current_status: e.target.value as CurrentStatus })} className={inputCls}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Atanan Kişi">
                    <select value={customerForm.assigned_to} onChange={e => setCustomerForm({ ...customerForm, assigned_to: e.target.value })} className={inputCls}>
                      <option value="">Seçin...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Vergi No (VKN)">
                    <input value={customerForm.tax_number} onChange={e => setCustomerForm({ ...customerForm, tax_number: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Vergi Dairesi">
                    <input value={customerForm.tax_office} onChange={e => setCustomerForm({ ...customerForm, tax_office: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Adres">
                  <input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Notlar">
                  <textarea value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={3} className={inputCls} placeholder="Görüşme notları, hatırlatmalar..." />
                </Field>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCustomerModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                  <button onClick={saveCustomer} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">{editingCustomer ? 'Güncelle' : 'Kaydet'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

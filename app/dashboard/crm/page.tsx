'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users, Phone, Mail, Plus, X, Edit3, Trash2, Search,
  Briefcase, PhoneCall, Send, Check, AlertCircle,
  Calendar, MapPin, Clock, CheckCircle2, XCircle,
} from 'lucide-react'

type CRMTab = 'customers' | 'appointments' | 'visits'

interface Appointment {
  id: string
  customer_id: string | null
  appointment_date: string
  appointment_type: 'call' | 'meeting' | 'visit' | 'video'
  title: string | null
  notes: string | null
  assigned_to: string | null
  status: 'planned' | 'completed' | 'cancelled' | 'missed'
  created_at: string
}

interface Visit {
  id: string
  customer_id: string | null
  visit_date: string
  visit_type: 'onsite' | 'office' | 'phone' | 'video'
  participants: string | null
  notes: string | null
  outcome: string | null
  next_action: string | null
  created_at: string
}

const APPT_TYPE_LABEL: Record<string, string> = {
  call: '📞 Telefon', meeting: '💼 Görüşme', visit: '📍 Ziyaret', video: '🎥 Video',
}
const APPT_STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: 'Planlandı', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Tamamlandı', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'İptal', bg: 'bg-gray-100', text: 'text-gray-600' },
  missed: { label: 'Kaçırıldı', bg: 'bg-red-100', text: 'text-red-700' },
}
const VISIT_TYPE_LABEL: Record<string, string> = {
  onsite: '📍 Yerinde', office: '🏢 Ofis', phone: '📞 Telefon', video: '🎥 Video',
}
const VISIT_OUTCOME_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  positive: { label: 'Pozitif ✓', bg: 'bg-green-100', text: 'text-green-700' },
  neutral: { label: 'Nötr', bg: 'bg-gray-100', text: 'text-gray-700' },
  negative: { label: 'Negatif ✗', bg: 'bg-red-100', text: 'text-red-700' },
  followup: { label: 'Takip Gerekli', bg: 'bg-yellow-100', text: 'text-yellow-700' },
}

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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [visits, setVisits] = useState<Visit[]>([])

  // Tab
  const [tab, setTab] = useState<CRMTab>('customers')

  // Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const [showApptModal, setShowApptModal] = useState(false)
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [apptForm, setApptForm] = useState({
    customer_id: '', appointment_date: '', appointment_type: 'meeting' as Appointment['appointment_type'],
    title: '', notes: '', assigned_to: '', status: 'planned' as Appointment['status'],
  })
  const [apptFilter, setApptFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [apptSearch, setApptSearch] = useState('')

  const [showVisitModal, setShowVisitModal] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [visitForm, setVisitForm] = useState({
    customer_id: '', visit_date: '', visit_type: 'onsite' as Visit['visit_type'],
    participants: '', notes: '', outcome: '', next_action: '',
  })
  const [visitSearch, setVisitSearch] = useState('')

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
    const [custRes, empRes, apptRes, visitRes] = await Promise.all([
      supabase.from('crm_customers').select('*').eq('company_id', cid).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', cid).eq('status', 'active').order('full_name'),
      supabase.from('crm_appointments').select('*').eq('company_id', cid).order('appointment_date', { ascending: false }),
      supabase.from('crm_visits').select('*').eq('company_id', cid).order('visit_date', { ascending: false }),
    ])
    setCustomers(custRes.data || [])
    setEmployees(empRes.data || [])
    setAppointments(apptRes.data || [])
    setVisits(visitRes.data || [])
  }

  // ============= APPOINTMENT CRUD =============
  const openNewAppt = () => {
    setEditingAppt(null)
    const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1)
    setApptForm({
      customer_id: '', appointment_date: now.toISOString().slice(0, 16),
      appointment_type: 'meeting', title: '', notes: '', assigned_to: '', status: 'planned',
    })
    setShowApptModal(true)
  }
  const openEditAppt = (a: Appointment) => {
    setEditingAppt(a)
    setApptForm({
      customer_id: a.customer_id || '',
      appointment_date: a.appointment_date ? new Date(a.appointment_date).toISOString().slice(0, 16) : '',
      appointment_type: a.appointment_type,
      title: a.title || '', notes: a.notes || '',
      assigned_to: a.assigned_to || '', status: a.status,
    })
    setShowApptModal(true)
  }
  const saveAppt = async () => {
    if (!apptForm.appointment_date) return alert('Tarih zorunlu!')
    const payload = {
      customer_id: apptForm.customer_id || null,
      appointment_date: apptForm.appointment_date,
      appointment_type: apptForm.appointment_type,
      title: apptForm.title.trim() || null,
      notes: apptForm.notes.trim() || null,
      assigned_to: apptForm.assigned_to || null,
      status: apptForm.status,
      updated_at: new Date().toISOString(),
    }
    if (editingAppt) {
      await supabase.from('crm_appointments').update(payload).eq('id', editingAppt.id)
    } else {
      await supabase.from('crm_appointments').insert({ ...payload, company_id: companyId, created_by: userId })
    }
    setShowApptModal(false)
    await loadAll(companyId!)
  }
  const deleteAppt = async (a: Appointment) => {
    if (!confirm('Randevuyu silmek istediğine emin misin?')) return
    await supabase.from('crm_appointments').delete().eq('id', a.id)
    await loadAll(companyId!)
  }
  const setApptStatus = async (a: Appointment, status: Appointment['status']) => {
    await supabase.from('crm_appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', a.id)
    await loadAll(companyId!)
  }

  // ============= VISIT CRUD =============
  const openNewVisit = () => {
    setEditingVisit(null)
    setVisitForm({
      customer_id: '', visit_date: new Date().toISOString().slice(0, 16),
      visit_type: 'onsite', participants: '', notes: '', outcome: '', next_action: '',
    })
    setShowVisitModal(true)
  }
  const openEditVisit = (v: Visit) => {
    setEditingVisit(v)
    setVisitForm({
      customer_id: v.customer_id || '',
      visit_date: v.visit_date ? new Date(v.visit_date).toISOString().slice(0, 16) : '',
      visit_type: v.visit_type,
      participants: v.participants || '', notes: v.notes || '',
      outcome: v.outcome || '', next_action: v.next_action || '',
    })
    setShowVisitModal(true)
  }
  const saveVisit = async () => {
    if (!visitForm.visit_date) return alert('Tarih zorunlu!')
    const payload = {
      customer_id: visitForm.customer_id || null,
      visit_date: visitForm.visit_date,
      visit_type: visitForm.visit_type,
      participants: visitForm.participants.trim() || null,
      notes: visitForm.notes.trim() || null,
      outcome: visitForm.outcome || null,
      next_action: visitForm.next_action.trim() || null,
    }
    if (editingVisit) {
      await supabase.from('crm_visits').update(payload).eq('id', editingVisit.id)
    } else {
      await supabase.from('crm_visits').insert({ ...payload, company_id: companyId, created_by: userId })
    }
    setShowVisitModal(false)
    await loadAll(companyId!)
  }
  const deleteVisit = async (v: Visit) => {
    if (!confirm('Ziyareti silmek istediğine emin misin?')) return
    await supabase.from('crm_visits').delete().eq('id', v.id)
    await loadAll(companyId!)
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
          {tab === 'customers' && (
            <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Müşteri
            </button>
          )}
          {tab === 'appointments' && (
            <button onClick={openNewAppt} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Randevu
            </button>
          )}
          {tab === 'visits' && (
            <button onClick={openNewVisit} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Ziyaret Kaydı
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <div className="flex min-w-max">
            {([
              { k: 'customers', label: 'Müşteriler', icon: Users, count: customers.length },
              { k: 'appointments', label: 'Randevular', icon: Calendar, count: appointments.filter(a => a.status === 'planned' && a.appointment_date >= new Date().toISOString()).length },
              { k: 'visits', label: 'Ziyaretler', icon: MapPin, count: visits.length },
            ] as const).map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t.k ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${tab === t.k ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'customers' && <>

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

        </>}

        {/* ============ APPOINTMENTS TAB ============ */}
        {tab === 'appointments' && (() => {
          const nowIso = new Date().toISOString()
          const filteredAppts = appointments.filter(a => {
            if (apptFilter === 'upcoming' && a.appointment_date < nowIso && a.status === 'planned') return false
            if (apptFilter === 'past' && a.appointment_date >= nowIso && a.status === 'planned') return false
            if (apptSearch) {
              const q = apptSearch.toLowerCase()
              const cust = customers.find(c => c.id === a.customer_id)
              return [a.title, a.notes, cust?.customer_name, cust?.contact_person].some(v => (v || '').toLowerCase().includes(q))
            }
            return true
          })
          return (
            <>
              <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-2 items-center flex-wrap">
                <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
                  {(['upcoming', 'past', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setApptFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold ${apptFilter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-white'}`}>
                      {f === 'upcoming' ? 'Yaklaşan' : f === 'past' ? 'Geçmiş' : 'Tümü'}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={apptSearch} onChange={e => setApptSearch(e.target.value)} placeholder="Randevu ara..."
                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <span className="text-xs text-gray-500">{filteredAppts.length} kayıt</span>
              </div>

              {filteredAppts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">Randevu yok</p>
                  <button onClick={openNewAppt} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus className="w-4 h-4" /> İlk Randevunu Ekle
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Tarih / Saat</th>
                        <th className="px-3 py-2 text-left">Tip</th>
                        <th className="px-3 py-2 text-left">Müşteri</th>
                        <th className="px-3 py-2 text-left">Başlık</th>
                        <th className="px-3 py-2 text-left">Sorumlu</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                        <th className="px-3 py-2 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredAppts.map(a => {
                        const c = customers.find(x => x.id === a.customer_id)
                        const emp = employees.find(e => e.id === a.assigned_to)
                        const st = APPT_STATUS_LABEL[a.status]
                        const past = a.appointment_date < nowIso
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="text-sm font-semibold text-gray-800">
                                {new Date(a.appointment_date).toLocaleDateString('tr-TR')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(a.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                {past && a.status === 'planned' && <span className="ml-1 text-red-500">⚠ geçti</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs">{APPT_TYPE_LABEL[a.appointment_type]}</td>
                            <td className="px-3 py-2 text-sm">{c?.customer_name || '—'}</td>
                            <td className="px-3 py-2 text-sm">{a.title || '—'}</td>
                            <td className="px-3 py-2 text-xs">{emp?.full_name || '—'}</td>
                            <td className="px-3 py-2">
                              <select value={a.status} onChange={e => setApptStatus(a, e.target.value as Appointment['status'])}
                                className={`px-2 py-1 rounded text-xs font-semibold border-0 cursor-pointer ${st.bg} ${st.text}`}>
                                {Object.entries(APPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="inline-flex gap-1">
                                <button onClick={() => openEditAppt(a)} className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Düzenle"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => deleteAppt(a)} className="p-1 rounded hover:bg-red-50 text-red-600" title="Sil"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        })()}

        {/* ============ VISITS TAB ============ */}
        {tab === 'visits' && (() => {
          const filteredVisits = visits.filter(v => {
            if (!visitSearch) return true
            const q = visitSearch.toLowerCase()
            const cust = customers.find(c => c.id === v.customer_id)
            return [v.participants, v.notes, v.next_action, cust?.customer_name, cust?.contact_person].some(x => (x || '').toLowerCase().includes(q))
          })
          return (
            <>
              <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={visitSearch} onChange={e => setVisitSearch(e.target.value)} placeholder="Ziyaret ara..."
                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <span className="text-xs text-gray-500">{filteredVisits.length} kayıt</span>
              </div>

              {filteredVisits.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">Ziyaret kaydı yok</p>
                  <button onClick={openNewVisit} className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <Plus className="w-4 h-4" /> İlk Ziyaretini Kaydet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredVisits.map(v => {
                    const c = customers.find(x => x.id === v.customer_id)
                    const outcome = v.outcome ? VISIT_OUTCOME_LABEL[v.outcome] : null
                    return (
                      <div key={v.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-xs text-gray-500">{VISIT_TYPE_LABEL[v.visit_type]}</div>
                            <div className="font-bold text-gray-800">{c?.customer_name || '—'}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(v.visit_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {outcome && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${outcome.bg} ${outcome.text}`}>{outcome.label}</span>}
                        </div>
                        {v.participants && <p className="text-xs text-gray-600 mb-1"><b>Katılanlar:</b> {v.participants}</p>}
                        {v.notes && <p className="text-sm text-gray-700 mb-2 bg-gray-50 rounded p-2">{v.notes}</p>}
                        {v.next_action && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2 mb-2"><b>Sonraki adım:</b> {v.next_action}</p>}
                        <div className="flex gap-1 pt-2 border-t justify-end">
                          <button onClick={() => openEditVisit(v)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteVisit(v)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

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

        {/* Randevu Modal */}
        {showApptModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApptModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">{editingAppt ? 'Randevuyu Düzenle' : 'Yeni Randevu'}</h3>
                <button onClick={() => setShowApptModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-5 space-y-3">
                <Field label="Müşteri">
                  <select value={apptForm.customer_id} onChange={e => setApptForm({...apptForm, customer_id: e.target.value})} className={inputCls}>
                    <option value="">— Seçiniz (opsiyonel) —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tarih / Saat *">
                    <input type="datetime-local" value={apptForm.appointment_date}
                      onChange={e => setApptForm({...apptForm, appointment_date: e.target.value})} className={inputCls} />
                  </Field>
                  <Field label="Tip">
                    <select value={apptForm.appointment_type} onChange={e => setApptForm({...apptForm, appointment_type: e.target.value as any})} className={inputCls}>
                      {Object.entries(APPT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Başlık">
                  <input value={apptForm.title} onChange={e => setApptForm({...apptForm, title: e.target.value})}
                    placeholder="Örn: Fiyat teklifi görüşmesi" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sorumlu">
                    <select value={apptForm.assigned_to} onChange={e => setApptForm({...apptForm, assigned_to: e.target.value})} className={inputCls}>
                      <option value="">Seçiniz...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Durum">
                    <select value={apptForm.status} onChange={e => setApptForm({...apptForm, status: e.target.value as any})} className={inputCls}>
                      {Object.entries(APPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Not">
                  <textarea value={apptForm.notes} onChange={e => setApptForm({...apptForm, notes: e.target.value})} rows={3} className={inputCls} />
                </Field>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowApptModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                  <button onClick={saveAppt} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">{editingAppt ? 'Güncelle' : 'Kaydet'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ziyaret Modal */}
        {showVisitModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowVisitModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-5 py-3 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">{editingVisit ? 'Ziyareti Düzenle' : 'Yeni Ziyaret Kaydı'}</h3>
                <button onClick={() => setShowVisitModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-5 space-y-3">
                <Field label="Müşteri">
                  <select value={visitForm.customer_id} onChange={e => setVisitForm({...visitForm, customer_id: e.target.value})} className={inputCls}>
                    <option value="">— Seçiniz (opsiyonel) —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tarih / Saat *">
                    <input type="datetime-local" value={visitForm.visit_date}
                      onChange={e => setVisitForm({...visitForm, visit_date: e.target.value})} className={inputCls} />
                  </Field>
                  <Field label="Tip">
                    <select value={visitForm.visit_type} onChange={e => setVisitForm({...visitForm, visit_type: e.target.value as any})} className={inputCls}>
                      {Object.entries(VISIT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Katılanlar">
                  <input value={visitForm.participants} onChange={e => setVisitForm({...visitForm, participants: e.target.value})}
                    placeholder="Örn: Ahmet Y., Mehmet K. (biz), Ali B. (karşı)" className={inputCls} />
                </Field>
                <Field label="Notlar">
                  <textarea value={visitForm.notes} onChange={e => setVisitForm({...visitForm, notes: e.target.value})} rows={4} className={inputCls}
                    placeholder="Görüşülen konular, talepler, kararlar..." />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sonuç">
                    <select value={visitForm.outcome} onChange={e => setVisitForm({...visitForm, outcome: e.target.value})} className={inputCls}>
                      <option value="">— Seçiniz —</option>
                      {Object.entries(VISIT_OUTCOME_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Sonraki Adım">
                    <input value={visitForm.next_action} onChange={e => setVisitForm({...visitForm, next_action: e.target.value})}
                      placeholder="Örn: Fiyat teklifi gönder" className={inputCls} />
                  </Field>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowVisitModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                  <button onClick={saveVisit} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">{editingVisit ? 'Güncelle' : 'Kaydet'}</button>
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

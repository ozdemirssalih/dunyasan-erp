'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users, Phone, Mail, Plus, X, Edit3, Trash2, Search,
  Briefcase, PhoneCall, Send, Check, AlertCircle,
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

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CurrentStatus>('all')

  // Form
  const emptyCustomer = {
    customer_name: '', contact_person: '', phone: '', email: '',
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
      phone: c.phone || '', email: c.email || '',
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
    if (search) {
      const t = search.toLowerCase()
      return [c.customer_name, c.contact_person, c.phone, c.email, c.sector].some(v => v?.toLowerCase().includes(t))
    }
    return true
  })

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
          <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow font-semibold">
            <Plus className="w-4 h-4" /> Yeni Müşteri
          </button>
        </div>

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

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Müşteri, yetkili, telefon, email ara..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
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

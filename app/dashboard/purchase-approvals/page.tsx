'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  FileText, Printer, Plus, X, Edit3, Trash2, Search, Filter, Calendar,
  ShoppingCart, CheckCircle2, Clock, XCircle,
} from 'lucide-react'

interface Approval {
  id: string
  company_id: string
  approval_no: string
  request_date: string
  requested_by: string | null
  department: string | null
  supplier_name: string | null
  item_description: string | null
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  currency: string
  status: 'approved' | 'pending' | 'rejected'
  approval_date: string | null
  approved_by: string | null
  project_name: string | null
  notes: string | null
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  approved: { label: 'Onaylandı', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  pending: { label: 'Bekliyor', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  rejected: { label: 'Reddedildi', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
const fmtMoney = (n: number, cur: string = 'TRY') => {
  const sym = cur === 'TRY' ? '₺' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur + ' '
  return `${sym}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

export default function PurchaseApprovalsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvals, setApprovals] = useState<Approval[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Approval | null>(null)

  const emptyForm = {
    approval_no: '', request_date: new Date().toISOString().split('T')[0],
    requested_by: '', department: '', supplier_name: '', item_description: '',
    quantity: '1', unit: 'adet', unit_price: '0', total_amount: '0', currency: 'TRY',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
    approval_date: new Date().toISOString().split('T')[0],
    approved_by: '', project_name: '', notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      await load(profile.company_id)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const load = async (cid: string) => {
    const { data } = await supabase
      .from('purchase_approvals')
      .select('*')
      .eq('company_id', cid)
      .order('request_date', { ascending: false })
    setApprovals(data || [])
  }

  // ============= CRUD =============
  const openNew = () => {
    setEditing(null)
    // Otomatik no
    const next = approvals.length + 1
    const yy = new Date().getFullYear()
    setForm({ ...emptyForm, approval_no: `SAO-${yy}-${String(next).padStart(4, '0')}` })
    setShowModal(true)
  }

  const openEdit = (a: Approval) => {
    setEditing(a)
    setForm({
      approval_no: a.approval_no, request_date: a.request_date,
      requested_by: a.requested_by || '', department: a.department || '',
      supplier_name: a.supplier_name || '', item_description: a.item_description || '',
      quantity: a.quantity.toString(), unit: a.unit, unit_price: a.unit_price.toString(),
      total_amount: a.total_amount.toString(), currency: a.currency,
      status: a.status, approval_date: a.approval_date || '',
      approved_by: a.approved_by || '', project_name: a.project_name || '',
      notes: a.notes || '',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.approval_no || !companyId) return alert('Onay no zorunlu!')
    try {
      const qty = parseFloat(form.quantity) || 0
      const up = parseFloat(form.unit_price) || 0
      const total = parseFloat(form.total_amount) || qty * up
      const payload: any = {
        approval_no: form.approval_no,
        request_date: form.request_date,
        requested_by: form.requested_by || null,
        department: form.department || null,
        supplier_name: form.supplier_name || null,
        item_description: form.item_description || null,
        quantity: qty, unit: form.unit, unit_price: up, total_amount: total,
        currency: form.currency, status: form.status,
        approval_date: form.approval_date || null,
        approved_by: form.approved_by || null,
        project_name: form.project_name || null,
        notes: form.notes || null,
      }
      if (editing) {
        await supabase.from('purchase_approvals').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('purchase_approvals').insert({ ...payload, company_id: companyId, created_by: userId })
      }
      setShowModal(false)
      await load(companyId)
    } catch (e: any) { alert('Hata: ' + e.message) }
  }

  const remove = async (a: Approval) => {
    if (!confirm(`"${a.approval_no}" onayını silmek istediğine emin misin?`)) return
    await supabase.from('purchase_approvals').delete().eq('id', a.id)
    await load(companyId!)
  }

  // ============= FILTERS =============
  const filtered = useMemo(() => approvals.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (startDate && a.request_date < startDate) return false
    if (endDate && a.request_date > endDate) return false
    if (search) {
      const t = search.toLowerCase()
      return [a.approval_no, a.supplier_name, a.item_description, a.requested_by, a.department, a.project_name].some(v => v?.toLowerCase().includes(t))
    }
    return true
  }), [approvals, statusFilter, startDate, endDate, search])

  const stats = useMemo(() => {
    const total = filtered.reduce((s, a) => s + (a.currency === 'TRY' ? a.total_amount : 0), 0)
    const fx: Record<string, number> = {}
    filtered.filter(a => a.currency !== 'TRY').forEach(a => {
      fx[a.currency] = (fx[a.currency] || 0) + a.total_amount
    })
    return { count: filtered.length, totalTRY: total, fx }
  }, [filtered])

  // ============= PRINT =============
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1200,height=800')
    if (!win) return
    const today = new Date().toLocaleDateString('tr-TR')
    const dateRange = startDate || endDate
      ? `${startDate ? new Date(startDate).toLocaleDateString('tr-TR') : '...'} → ${endDate ? new Date(endDate).toLocaleDateString('tr-TR') : '...'}`
      : 'Tüm Tarihler'

    const rows = filtered.map((a, i) => {
      const status = STATUS_MAP[a.status]
      return `
        <tr>
          <td class="ord">${i + 1}</td>
          <td class="no">${a.approval_no}</td>
          <td>${fmtDate(a.request_date)}</td>
          <td>${a.requested_by || '-'}<div class="dep">${a.department || ''}</div></td>
          <td>${a.supplier_name || '-'}</td>
          <td class="desc">${a.item_description || '-'}</td>
          <td class="num">${a.quantity} ${a.unit}</td>
          <td class="num">${fmtMoney(a.unit_price, a.currency)}</td>
          <td class="num bold">${fmtMoney(a.total_amount, a.currency)}</td>
          <td class="status">${status.label}</td>
        </tr>
      `
    }).join('')

    const fxText = Object.entries(stats.fx).map(([k, v]) => fmtMoney(v, k)).join(' + ')

    win.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Satın Alma Listesi - DF22</title>
      <style>
        @page { size: A4 landscape; margin: 1cm; }
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica', Arial, sans-serif; color: #111; margin: 0; padding: 0; font-size: 10px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { margin: 0 0 4px 0; font-size: 22px; color: #1e40af; }
        .header .subtitle { font-size: 12px; color: #555; }
        .header .meta { text-align: right; font-size: 10px; color: #555; line-height: 1.5; }
        .doc-no { display: inline-block; padding: 3px 10px; background: #fef3c7; color: #b45309; font-weight: 700; border-radius: 4px; font-size: 11px; }

        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
        .summary-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f9fafb; }
        .summary-box .label { font-size: 9px; color: #555; text-transform: uppercase; }
        .summary-box .value { font-size: 14px; font-weight: 700; color: #111; margin-top: 2px; }
        .summary-box.total { background: #dbeafe; border-color: #93c5fd; }
        .summary-box.total .value { color: #1e40af; font-size: 16px; }

        table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        thead { background: #1e40af; color: white; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
        .ord { text-align: center; width: 28px; font-weight: 700; background: #f1f5f9; }
        .no { font-family: monospace; font-weight: 700; color: #1e40af; }
        .num { text-align: right; }
        .bold { font-weight: 700; }
        .desc { max-width: 220px; }
        .dep { font-size: 8.5px; color: #777; margin-top: 1px; }
        .status { text-align: center; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tfoot { background: #1e40af; color: white; font-weight: 700; }
        tfoot td { padding: 6px; }
        .footer { margin-top: 24px; font-size: 9px; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 6px; }
        .sign-block { display: flex; gap: 30px; margin-top: 30px; justify-content: space-around; }
        .sign-col { text-align: center; flex: 1; max-width: 200px; }
        .sign-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; font-size: 9px; }
      </style></head><body>

      <div class="header">
        <div>
          <h1>DÜNYASAN — SATIN ALMA LİSTESİ</h1>
          <div class="subtitle">Geçmiş Satın Alma Onay Formları Özeti</div>
          <div style="margin-top:6px"><span class="doc-no">Doküman No: DF22</span></div>
        </div>
        <div class="meta">
          <div><b>Çıktı Tarihi:</b> ${today}</div>
          <div><b>Dönem:</b> ${dateRange}</div>
          <div><b>Toplam Kayıt:</b> ${filtered.length}</div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-box"><div class="label">Toplam Onay</div><div class="value">${stats.count}</div></div>
        <div class="summary-box"><div class="label">Onaylanan</div><div class="value">${filtered.filter(a => a.status === 'approved').length}</div></div>
        <div class="summary-box"><div class="label">Bekleyen</div><div class="value">${filtered.filter(a => a.status === 'pending').length}</div></div>
        <div class="summary-box total"><div class="label">TL Toplam</div><div class="value">${fmtMoney(stats.totalTRY)}</div>${fxText ? `<div style="font-size:9px;color:#1e40af;margin-top:2px">+ ${fxText}</div>` : ''}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Onay No</th>
            <th>Talep Tarihi</th>
            <th>Talep Eden</th>
            <th>Tedarikçi</th>
            <th>Açıklama</th>
            <th>Miktar</th>
            <th>Birim Fiyat</th>
            <th>Toplam</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#999">Kayıt yok</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td colspan="8" style="text-align:right">GENEL TOPLAM (TL):</td>
            <td class="num">${fmtMoney(stats.totalTRY)}</td>
            <td></td>
          </tr>
          ${fxText ? `<tr><td colspan="8" style="text-align:right;font-size:9px">+ Döviz cinsinden:</td><td class="num" style="font-size:9px">${fxText}</td><td></td></tr>` : ''}
        </tfoot>
      </table>

      <div class="sign-block">
        <div class="sign-col"><div class="sign-line">Hazırlayan</div></div>
        <div class="sign-col"><div class="sign-line">Kontrol Eden</div></div>
        <div class="sign-col"><div class="sign-line">Onaylayan</div></div>
      </div>

      <div class="footer">
        <div>Bu liste ${today} tarihinde sistemden otomatik oluşturulmuştur.</div>
        <div>DF22 · v1.0</div>
      </div>

      <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
      </body></html>
    `)
    win.document.close()
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-600" /> Satın Alma Listesi
            </h2>
            <p className="text-gray-600">
              Geçmiş satın alma onay formlarının özeti
              <span className="ml-2 inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">Doküman No: DF22</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 shadow font-semibold">
              <Printer className="w-4 h-4" /> PDF Yazdır
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Onay
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatBox label="Toplam Onay" value={stats.count} color="blue" />
          <StatBox label="Onaylanan" value={filtered.filter(a => a.status === 'approved').length} color="green" />
          <StatBox label="Bekleyen" value={filtered.filter(a => a.status === 'pending').length} color="yellow" />
          <StatBox label="TL Toplam" value={fmtMoney(stats.totalTRY)} color="purple" big />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Onay no, tedarikçi, malzeme, talep eden..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">Tüm Durumlar</option>
            <option value="approved">Onaylandı</option>
            <option value="pending">Bekliyor</option>
            <option value="rejected">Reddedildi</option>
          </select>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
            <span className="text-gray-400">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Onay No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Talep Tarihi</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Talep Eden</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Tedarikçi</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Malzeme/Hizmet</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Miktar</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Toplam</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(a => {
                const status = STATUS_MAP[a.status]
                const Icon = status.icon
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-bold font-mono text-blue-700 text-sm">{a.approval_no}</td>
                    <td className="px-3 py-3 text-sm">{fmtDate(a.request_date)}</td>
                    <td className="px-3 py-3 text-sm">
                      <div className="text-gray-800">{a.requested_by || '-'}</div>
                      {a.department && <div className="text-[10px] text-gray-500">{a.department}</div>}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{a.supplier_name || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 max-w-[260px]">
                      <div className="truncate">{a.item_description || '-'}</div>
                      {a.project_name && <div className="text-[10px] text-blue-600">📂 {a.project_name}</div>}
                    </td>
                    <td className="px-3 py-3 text-sm text-right">{a.quantity} {a.unit}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">{fmtMoney(a.total_amount, a.currency)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
                        <Icon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => remove(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12">Kayıt bulunamadı</p>}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">{editing ? 'Onayı Düzenle' : 'Yeni Satın Alma Onayı'}</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Onay No *">
                    <input value={form.approval_no} onChange={e => setForm({ ...form, approval_no: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Talep Tarihi *">
                    <input type="date" value={form.request_date} onChange={e => setForm({ ...form, request_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Durum">
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className={inputCls}>
                      <option value="approved">Onaylandı</option>
                      <option value="pending">Bekliyor</option>
                      <option value="rejected">Reddedildi</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Talep Eden">
                    <input value={form.requested_by} onChange={e => setForm({ ...form, requested_by: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Departman">
                    <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Üretim, Bakım, Kalite..." className={inputCls} />
                  </Field>
                </div>
                <Field label="Tedarikçi">
                  <input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Malzeme / Hizmet Açıklaması">
                  <textarea value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} rows={2} className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Miktar">
                    <input type="number" value={form.quantity} onChange={e => {
                      const v = e.target.value; const qty = parseFloat(v) || 0; const up = parseFloat(form.unit_price) || 0
                      setForm({ ...form, quantity: v, total_amount: (qty * up).toString() })
                    }} className={inputCls} />
                  </Field>
                  <Field label="Birim">
                    <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Birim Fiyat">
                    <input type="number" value={form.unit_price} onChange={e => {
                      const v = e.target.value; const qty = parseFloat(form.quantity) || 0; const up = parseFloat(v) || 0
                      setForm({ ...form, unit_price: v, total_amount: (qty * up).toString() })
                    }} className={inputCls} />
                  </Field>
                  <Field label="Toplam">
                    <div className="flex gap-1">
                      <input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} className={inputCls} />
                      <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="px-2 border border-gray-300 rounded text-sm">
                        <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                      </select>
                    </div>
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Onay Tarihi">
                    <input type="date" value={form.approval_date} onChange={e => setForm({ ...form, approval_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Onaylayan">
                    <input value={form.approved_by} onChange={e => setForm({ ...form, approved_by: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Proje">
                    <input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Notlar">
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
                </Field>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                  <button onClick={save} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">{editing ? 'Güncelle' : 'Kaydet'}</button>
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

function StatBox({ label, value, color, big }: { label: string; value: any; color: string; big?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    green: 'border-green-500 text-green-600',
    yellow: 'border-yellow-500 text-yellow-600',
    purple: 'border-purple-500 text-purple-600',
  }
  return (
    <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${colors[color]}`}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`${big ? 'text-xl' : 'text-3xl'} font-bold text-gray-900`}>{value}</p>
    </div>
  )
}

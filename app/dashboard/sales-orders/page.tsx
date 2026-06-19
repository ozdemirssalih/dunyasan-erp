'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  FileText, Printer, Plus, X, Edit3, Trash2, Search, Calendar,
  Truck, CheckCircle2, Clock, Package,
} from 'lucide-react'

interface SalesOrder {
  id: string
  company_id: string
  order_no: string | null
  order_date: string
  customer_name: string | null
  customer_contact: string | null
  customer_phone: string | null
  customer_email: string | null
  customer_address: string | null
  project_name: string | null
  part_no: string | null
  part_name: string | null
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  currency: string
  delivery_date: string | null
  status: string
  shipped_quantity: number
  remaining_quantity: number
  approved_by: string | null
  approval_date: string | null
  notes: string | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: 'Planlandı', bg: 'bg-gray-100', text: 'text-gray-700' },
  in_production: { label: 'Üretimde', bg: 'bg-blue-100', text: 'text-blue-700' },
  shipped: { label: 'Sevk Edildi', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'Gecikmiş', bg: 'bg-red-100', text: 'text-red-700' },
  cancelled: { label: 'İptal', bg: 'bg-gray-200', text: 'text-gray-600' },
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
const fmtMoney = (n: number, cur: string = 'TRY') => {
  const sym = cur === 'TRY' ? '₺' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur + ' '
  return `${sym}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

export default function SalesOrdersPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<SalesOrder[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SalesOrder | null>(null)

  const emptyForm = {
    order_no: '', order_date: new Date().toISOString().split('T')[0],
    customer_name: '', customer_contact: '', customer_phone: '', customer_email: '', customer_address: '',
    project_name: '', part_no: '', part_name: '',
    quantity: '1', unit: 'adet', unit_price: '0', total_amount: '0', currency: 'TRY',
    delivery_date: '', status: 'planned',
    shipped_quantity: '0', remaining_quantity: '0',
    approved_by: '', approval_date: '', notes: '',
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
    const { data } = await supabase.from('sales_orders').select('*').eq('company_id', cid).order('order_date', { ascending: false })
    setOrders(data || [])
  }

  const openNew = () => {
    setEditing(null)
    const next = orders.length + 1
    setForm({ ...emptyForm, order_no: `SO-${new Date().getFullYear()}-${String(next).padStart(4, '0')}` })
    setShowModal(true)
  }

  const openEdit = (o: SalesOrder) => {
    setEditing(o)
    setForm({
      order_no: o.order_no || '', order_date: o.order_date,
      customer_name: o.customer_name || '', customer_contact: o.customer_contact || '',
      customer_phone: o.customer_phone || '', customer_email: o.customer_email || '',
      customer_address: o.customer_address || '',
      project_name: o.project_name || '', part_no: o.part_no || '', part_name: o.part_name || '',
      quantity: o.quantity.toString(), unit: o.unit, unit_price: o.unit_price.toString(),
      total_amount: o.total_amount.toString(), currency: o.currency,
      delivery_date: o.delivery_date || '', status: o.status,
      shipped_quantity: o.shipped_quantity.toString(), remaining_quantity: o.remaining_quantity.toString(),
      approved_by: o.approved_by || '', approval_date: o.approval_date || '', notes: o.notes || '',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.order_no || !form.customer_name || !companyId) return alert('Sipariş no ve müşteri zorunlu!')
    const qty = parseFloat(form.quantity) || 0
    const up = parseFloat(form.unit_price) || 0
    const total = parseFloat(form.total_amount) || qty * up
    const shipped = parseFloat(form.shipped_quantity) || 0
    const payload: any = {
      order_no: form.order_no, order_date: form.order_date,
      customer_name: form.customer_name, customer_contact: form.customer_contact || null,
      customer_phone: form.customer_phone || null, customer_email: form.customer_email || null,
      customer_address: form.customer_address || null,
      project_name: form.project_name || null, part_no: form.part_no || null, part_name: form.part_name || null,
      quantity: qty, unit: form.unit, unit_price: up, total_amount: total, currency: form.currency,
      delivery_date: form.delivery_date || null, status: form.status,
      shipped_quantity: shipped, remaining_quantity: Math.max(0, qty - shipped),
      approved_by: form.approved_by || null, approval_date: form.approval_date || null,
      notes: form.notes || null,
    }
    try {
      if (editing) await supabase.from('sales_orders').update(payload).eq('id', editing.id)
      else await supabase.from('sales_orders').insert({ ...payload, company_id: companyId, created_by: userId })
      setShowModal(false)
      await load(companyId)
    } catch (e: any) { alert('Hata: ' + e.message) }
  }

  const remove = async (o: SalesOrder) => {
    if (!confirm(`"${o.order_no}" siparişini silmek istediğine emin misin?`)) return
    await supabase.from('sales_orders').delete().eq('id', o.id)
    await load(companyId!)
  }

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (startDate && o.order_date < startDate) return false
    if (endDate && o.order_date > endDate) return false
    if (search) {
      const t = search.toLowerCase()
      return [o.order_no, o.customer_name, o.part_no, o.part_name, o.project_name].some(v => v?.toLowerCase().includes(t))
    }
    return true
  }), [orders, statusFilter, startDate, endDate, search])

  const stats = useMemo(() => ({
    total: filtered.length,
    planned: filtered.filter(o => o.status === 'planned').length,
    inProduction: filtered.filter(o => o.status === 'in_production').length,
    shipped: filtered.filter(o => o.status === 'shipped').length,
    totalAmount: filtered.reduce((s, o) => s + (o.currency === 'TRY' ? o.total_amount : 0), 0),
  }), [filtered])

  // ============= PRINT LIST (DF01) =============
  const printList = () => {
    const win = window.open('', '_blank', 'width=1200,height=800')
    if (!win) return
    const today = new Date().toLocaleDateString('tr-TR')
    const dateRange = startDate || endDate ? `${startDate ? fmtDate(startDate) : '...'} → ${endDate ? fmtDate(endDate) : '...'}` : 'Tüm Tarihler'

    const rows = filtered.map((o, i) => {
      const status = STATUS_MAP[o.status] || STATUS_MAP.planned
      return `<tr>
        <td class="ord">${i + 1}</td>
        <td class="no">${o.order_no || '-'}</td>
        <td>${fmtDate(o.order_date)}</td>
        <td>${o.customer_name || '-'}<div class="meta">${o.project_name || ''}</div></td>
        <td>${o.part_no || '-'}<div class="meta">${o.part_name || ''}</div></td>
        <td class="num">${o.quantity} ${o.unit}</td>
        <td class="num">${o.shipped_quantity}/${o.quantity}</td>
        <td>${fmtDate(o.delivery_date)}</td>
        <td class="num bold">${fmtMoney(o.total_amount, o.currency)}</td>
        <td class="status">${status.label}</td>
      </tr>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sipariş Takip Listesi - DF01</title>
    <style>
      @page { size: A4 landscape; margin: 1cm; }
      *{box-sizing:border-box}
      body{font-family:'Helvetica',Arial,sans-serif;color:#111;margin:0;padding:0;font-size:10px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:14px}
      .header h1{margin:0 0 4px 0;font-size:22px;color:#1e40af}
      .header .subtitle{font-size:12px;color:#555}
      .header .meta{text-align:right;font-size:10px;color:#555;line-height:1.5}
      .doc-no{display:inline-block;padding:3px 10px;background:#fef3c7;color:#b45309;font-weight:700;border-radius:4px;font-size:11px}
      .summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
      .summary-box{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;background:#f9fafb}
      .summary-box .label{font-size:9px;color:#555;text-transform:uppercase}
      .summary-box .value{font-size:14px;font-weight:700;color:#111;margin-top:2px}
      .summary-box.total{background:#dbeafe;border-color:#93c5fd}
      .summary-box.total .value{color:#1e40af;font-size:14px}
      table{width:100%;border-collapse:collapse;font-size:9.5px}
      thead{background:#1e40af;color:white}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}
      .ord{text-align:center;width:28px;font-weight:700;background:#f1f5f9}
      .no{font-family:monospace;font-weight:700;color:#1e40af}
      .num{text-align:right}.bold{font-weight:700}
      .meta{font-size:8.5px;color:#777;margin-top:1px}
      .status{text-align:center}
      tbody tr:nth-child(even){background:#f8fafc}
      tfoot{background:#1e40af;color:white;font-weight:700}
      tfoot td{padding:6px}
      .sign-block{display:flex;gap:30px;margin-top:30px;justify-content:space-around}
      .sign-col{text-align:center;flex:1;max-width:200px}
      .sign-line{border-top:1px solid #333;margin-top:50px;padding-top:4px;font-size:9px}
      .footer{margin-top:24px;font-size:9px;color:#555;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:6px}
    </style></head><body>
    <div class="header"><div>
      <h1>DÜNYASAN — SİPARİŞ TAKİP LİSTESİ</h1>
      <div class="subtitle">Açık ve Devam Eden Müşteri Siparişleri</div>
      <div style="margin-top:6px"><span class="doc-no">Doküman No: DF01</span></div>
    </div><div class="meta">
      <div><b>Çıktı Tarihi:</b> ${today}</div>
      <div><b>Dönem:</b> ${dateRange}</div>
      <div><b>Toplam Kayıt:</b> ${filtered.length}</div>
    </div></div>
    <div class="summary">
      <div class="summary-box"><div class="label">Toplam Sipariş</div><div class="value">${stats.total}</div></div>
      <div class="summary-box"><div class="label">Planlandı</div><div class="value">${stats.planned}</div></div>
      <div class="summary-box"><div class="label">Üretimde</div><div class="value">${stats.inProduction}</div></div>
      <div class="summary-box"><div class="label">Sevk Edildi</div><div class="value">${stats.shipped}</div></div>
      <div class="summary-box total"><div class="label">TL Toplam</div><div class="value">${fmtMoney(stats.totalAmount)}</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Sipariş No</th><th>Tarih</th><th>Müşteri / Proje</th>
      <th>Parça</th><th>Miktar</th><th>Sevk/Plan</th><th>Teslim Tarihi</th>
      <th>Toplam</th><th>Durum</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#999">Kayıt yok</td></tr>'}</tbody>
    <tfoot><tr><td colspan="8" style="text-align:right">GENEL TOPLAM (TL):</td><td class="num">${fmtMoney(stats.totalAmount)}</td><td></td></tr></tfoot>
    </table>
    <div class="sign-block">
      <div class="sign-col"><div class="sign-line">Hazırlayan</div></div>
      <div class="sign-col"><div class="sign-line">Üretim Müdürü</div></div>
      <div class="sign-col"><div class="sign-line">Onaylayan</div></div>
    </div>
    <div class="footer"><div>Bu liste ${today} tarihinde sistemden otomatik oluşturulmuştur.</div><div>DF01 · v1.0</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`)
    win.document.close()
  }

  // ============= PRINT SINGLE ORDER FORM (DF21) =============
  const printApproval = (o: SalesOrder) => {
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) return
    const today = new Date().toLocaleDateString('tr-TR')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sipariş Onay Formu - ${o.order_no}</title>
    <style>
      @page { size: A4; margin: 1.5cm; }
      *{box-sizing:border-box}
      body{font-family:'Helvetica',Arial,sans-serif;color:#111;margin:0;padding:0;font-size:11px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:18px}
      .header h1{margin:0 0 4px 0;font-size:22px;color:#1e40af}
      .header .subtitle{font-size:12px;color:#555}
      .doc-no{display:inline-block;padding:3px 10px;background:#fef3c7;color:#b45309;font-weight:700;border-radius:4px;font-size:11px}
      .order-no{display:inline-block;padding:3px 10px;background:#dbeafe;color:#1e40af;font-weight:700;border-radius:4px;font-size:11px;font-family:monospace;margin-left:6px}
      h3{color:#1e40af;border-bottom:1px solid #cbd5e1;padding-bottom:4px;font-size:12px;margin:18px 0 8px 0;text-transform:uppercase;letter-spacing:0.5px}
      table.kv{width:100%;border-collapse:collapse;margin-bottom:10px}
      table.kv td{padding:5px 8px;border-bottom:1px dotted #e5e7eb;font-size:11px}
      table.kv td.k{font-weight:600;color:#555;width:30%;background:#f9fafb}
      .totals{background:#dbeafe;padding:10px;border-radius:6px;margin-top:10px;display:flex;justify-content:space-between;align-items:center}
      .totals .lbl{font-weight:700;color:#1e40af;font-size:13px}
      .totals .val{font-size:18px;font-weight:700;color:#1e40af}
      .notes-block{background:#fef9c3;border-left:4px solid #fbbf24;padding:8px 10px;margin-top:12px;font-size:11px}
      .sign-block{display:flex;gap:30px;margin-top:50px;justify-content:space-around}
      .sign-col{text-align:center;flex:1;max-width:200px}
      .sign-line{border-top:1px solid #333;margin-top:60px;padding-top:6px;font-size:10px;font-weight:600}
      .footer{margin-top:30px;font-size:9px;color:#555;text-align:right;border-top:1px solid #ddd;padding-top:6px}
    </style></head><body>
    <div class="header"><div>
      <h1>SİPARİŞ ONAY FORMU</h1>
      <div class="subtitle">DÜNYASAN Savunma Sistemleri</div>
      <div style="margin-top:6px"><span class="doc-no">Doküman No: DF21</span><span class="order-no">${o.order_no || ''}</span></div>
    </div><div style="text-align:right;font-size:10px;color:#555">
      <div><b>Sipariş Tarihi:</b> ${fmtDate(o.order_date)}</div>
      <div><b>Çıktı Tarihi:</b> ${today}</div>
    </div></div>

    <h3>Müşteri Bilgileri</h3>
    <table class="kv"><tbody>
      <tr><td class="k">Müşteri / Firma</td><td>${o.customer_name || '-'}</td></tr>
      <tr><td class="k">Yetkili Kişi</td><td>${o.customer_contact || '-'}</td></tr>
      <tr><td class="k">Telefon</td><td>${o.customer_phone || '-'}</td></tr>
      <tr><td class="k">E-posta</td><td>${o.customer_email || '-'}</td></tr>
      ${o.customer_address ? `<tr><td class="k">Adres</td><td>${o.customer_address}</td></tr>` : ''}
    </tbody></table>

    <h3>Ürün / Parça Bilgileri</h3>
    <table class="kv"><tbody>
      <tr><td class="k">Proje</td><td>${o.project_name || '-'}</td></tr>
      <tr><td class="k">Parça No</td><td><b>${o.part_no || '-'}</b></td></tr>
      <tr><td class="k">Parça Adı</td><td>${o.part_name || '-'}</td></tr>
      <tr><td class="k">Miktar</td><td><b>${o.quantity} ${o.unit}</b></td></tr>
      <tr><td class="k">Birim Fiyat</td><td>${fmtMoney(o.unit_price, o.currency)}</td></tr>
    </tbody></table>

    <div class="totals"><div class="lbl">TOPLAM TUTAR:</div><div class="val">${fmtMoney(o.total_amount, o.currency)}</div></div>

    <h3>Teslim ve Durum</h3>
    <table class="kv"><tbody>
      <tr><td class="k">Planlanan Teslim Tarihi</td><td>${fmtDate(o.delivery_date)}</td></tr>
      <tr><td class="k">Sevk Edilen Miktar</td><td>${o.shipped_quantity} / ${o.quantity}</td></tr>
      <tr><td class="k">Kalan Miktar</td><td>${o.remaining_quantity}</td></tr>
      <tr><td class="k">Durum</td><td>${(STATUS_MAP[o.status] || STATUS_MAP.planned).label}</td></tr>
    </tbody></table>

    ${o.notes ? `<div class="notes-block"><b>Notlar:</b><br>${o.notes}</div>` : ''}

    <h3>Onay</h3>
    <table class="kv"><tbody>
      <tr><td class="k">Onaylayan</td><td><b>${o.approved_by || '-'}</b></td></tr>
      <tr><td class="k">Onay Tarihi</td><td>${fmtDate(o.approval_date)}</td></tr>
    </tbody></table>

    <div class="sign-block">
      <div class="sign-col"><div class="sign-line">Müşteri Temsilcisi</div></div>
      <div class="sign-col"><div class="sign-line">Üretim Müdürü</div></div>
      <div class="sign-col"><div class="sign-line">Genel Müdür Onayı</div></div>
    </div>

    <div class="footer">DF21 Sipariş Onay Formu · ${today}</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`)
    win.document.close()
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" /> Sipariş Takip Listesi
            </h2>
            <p className="text-gray-600">
              Müşteri siparişleri ve sevkiyat takibi
              <span className="ml-2 inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">DF01</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={printList} className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 shadow font-semibold">
              <Printer className="w-4 h-4" /> Liste Yazdır (DF01)
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Sipariş
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBox label="Toplam" value={stats.total} color="blue" />
          <StatBox label="Planlandı" value={stats.planned} color="gray" />
          <StatBox label="Üretimde" value={stats.inProduction} color="yellow" />
          <StatBox label="Sevk" value={stats.shipped} color="green" />
          <StatBox label="TL Toplam" value={fmtMoney(stats.totalAmount)} color="purple" big />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sipariş no, müşteri, parça..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">Tüm Durumlar</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Sipariş No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Tarih</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Müşteri / Proje</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Parça</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Miktar / Sevk</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Teslim</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Tutar</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(o => {
                const status = STATUS_MAP[o.status] || STATUS_MAP.planned
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-bold font-mono text-blue-700 text-sm">{o.order_no}</td>
                    <td className="px-3 py-3 text-sm">{fmtDate(o.order_date)}</td>
                    <td className="px-3 py-3 text-sm">
                      <div className="font-semibold text-gray-800">{o.customer_name}</div>
                      {o.project_name && <div className="text-[11px] text-blue-600">📂 {o.project_name}</div>}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="font-mono text-gray-700">{o.part_no}</div>
                      <div className="text-[11px] text-gray-500">{o.part_name}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm">
                      <div className="font-semibold">{o.quantity} {o.unit}</div>
                      <div className="text-[11px] text-gray-500">Sevk: {o.shipped_quantity}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm">{fmtDate(o.delivery_date)}</td>
                    <td className="px-3 py-3 text-right font-bold">{fmtMoney(o.total_amount, o.currency)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => printApproval(o)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="DF21 Onay Formu Yazdır">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(o)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => remove(o)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">{editing ? 'Siparişi Düzenle' : 'Yeni Sipariş'}</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Sipariş No *"><input value={form.order_no} onChange={e => setForm({ ...form, order_no: e.target.value })} className={inputCls} /></Field>
                  <Field label="Sipariş Tarihi *"><input type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} className={inputCls} /></Field>
                  <Field label="Durum">
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                </div>
                <h4 className="text-sm font-bold text-gray-700 border-b pb-1">Müşteri</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Müşteri Adı *"><input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Yetkili"><input value={form.customer_contact} onChange={e => setForm({ ...form, customer_contact: e.target.value })} className={inputCls} /></Field>
                  <Field label="Telefon"><input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className={inputCls} /></Field>
                  <Field label="E-posta"><input value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} className={inputCls} /></Field>
                </div>
                <h4 className="text-sm font-bold text-gray-700 border-b pb-1">Ürün</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Proje"><input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Parça No"><input value={form.part_no} onChange={e => setForm({ ...form, part_no: e.target.value })} className={inputCls} /></Field>
                  <Field label="Parça Adı"><input value={form.part_name} onChange={e => setForm({ ...form, part_name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Miktar">
                    <input type="number" value={form.quantity} onChange={e => { const v = e.target.value; const q = parseFloat(v) || 0; const u = parseFloat(form.unit_price) || 0; setForm({ ...form, quantity: v, total_amount: (q * u).toString() }) }} className={inputCls} />
                  </Field>
                  <Field label="Birim"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} /></Field>
                  <Field label="Birim Fiyat">
                    <input type="number" value={form.unit_price} onChange={e => { const v = e.target.value; const q = parseFloat(form.quantity) || 0; const u = parseFloat(v) || 0; setForm({ ...form, unit_price: v, total_amount: (q * u).toString() }) }} className={inputCls} />
                  </Field>
                  <Field label="Toplam">
                    <div className="flex gap-1">
                      <input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} className={inputCls} />
                      <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="px-2 border border-gray-300 rounded text-sm">
                        <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                      </select>
                    </div>
                  </Field>
                  <Field label="Teslim Tarihi"><input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} className={inputCls} /></Field>
                  <Field label="Sevk Edilen"><input type="number" value={form.shipped_quantity} onChange={e => setForm({ ...form, shipped_quantity: e.target.value })} className={inputCls} /></Field>
                </div>
                <h4 className="text-sm font-bold text-gray-700 border-b pb-1">Onay</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Onaylayan"><input value={form.approved_by} onChange={e => setForm({ ...form, approved_by: e.target.value })} className={inputCls} /></Field>
                  <Field label="Onay Tarihi"><input type="date" value={form.approval_date} onChange={e => setForm({ ...form, approval_date: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label="Notlar"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field>
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
  return <div><label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>{children}</div>
}

function StatBox({ label, value, color, big }: { label: string; value: any; color: string; big?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    gray: 'border-gray-400 text-gray-600',
    yellow: 'border-yellow-500 text-yellow-600',
    green: 'border-green-500 text-green-600',
    purple: 'border-purple-500 text-purple-600',
  }
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${colors[color]}`}>
      <p className="text-[11px] text-gray-600 mb-1">{label}</p>
      <p className={`${big ? 'text-base' : 'text-2xl'} font-bold text-gray-900`}>{value}</p>
    </div>
  )
}

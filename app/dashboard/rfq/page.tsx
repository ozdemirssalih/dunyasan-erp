'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Edit3, Trash2, Search, Eye, Download, Copy, Send, Check, X, ArrowLeft } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Supplier {
  id: string
  company_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
}

interface RFQItem {
  id?: string
  sira: number
  parca_kodu: string
  parca_adi: string
  malzeme: string
  miktar: number
  birim: string
  teknik_detay: string
}

interface RFQ {
  id: string
  rfq_number: string
  rfq_date: string
  deadline: string | null
  delivery_time: string | null
  payment_terms: string | null
  supplier_id: string | null
  supplier_name: string
  supplier_contact: string | null
  supplier_phone: string | null
  supplier_email: string | null
  supplier_address: string | null
  currency: string
  notes: string | null
  internal_notes: string | null
  status: string
  created_at: string
}

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'ABD Doları ($)' },
  { code: 'TRY', symbol: '₺', label: 'Türk Lirası (₺)' },
  { code: 'GBP', symbol: '£', label: 'İngiliz Sterlini (£)' },
]

const UNITS = ['adet', 'kg', 'metre', 'litre', 'set', 'takım', 'paket', 'kutu', 'ton']

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Taslak', bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { label: 'Gönderildi', bg: 'bg-blue-100', text: 'text-blue-700' },
  received: { label: 'Teklif Alındı', bg: 'bg-green-100', text: 'text-green-700' },
  accepted: { label: 'Kabul Edildi', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { label: 'Reddedildi', bg: 'bg-red-100', text: 'text-red-700' },
  expired: { label: 'Süresi Doldu', bg: 'bg-yellow-100', text: 'text-yellow-700' },
}

const emptyItem = (): RFQItem => ({
  sira: 1, parca_kodu: '', parca_adi: '', malzeme: '', miktar: 1, birim: 'adet', teknik_detay: '',
})

export default function RFQPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [view, setView] = useState<'list' | 'form' | 'preview'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [form, setForm] = useState({
    rfq_number: '', rfq_date: new Date().toISOString().split('T')[0],
    deadline: '', delivery_time: '', payment_terms: '',
    supplier_id: '', supplier_name: '', supplier_contact: '', supplier_phone: '', supplier_email: '', supplier_address: '',
    currency: 'EUR', notes: '', internal_notes: '',
  })
  const [items, setItems] = useState<RFQItem[]>([emptyItem()])

  const [previewRFQ, setPreviewRFQ] = useState<RFQ | null>(null)
  const [previewItems, setPreviewItems] = useState<RFQItem[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [rfqRes, suppRes] = await Promise.all([
        supabase.from('rfq').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, company_name, contact_person, phone, email, address').eq('company_id', profile.company_id).eq('is_active', true).order('company_name'),
      ])
      setRfqs(rfqRes.data || [])
      setSuppliers(suppRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const generateNumber = async (): Promise<string> => {
    let next = 1
    try {
      if (companyId) {
        const { data } = await supabase.from('rfq').select('rfq_number').eq('company_id', companyId).like('rfq_number', 'DNYS-RFQ-%').order('created_at', { ascending: false }).limit(1)
        if (data?.[0]?.rfq_number) { const m = data[0].rfq_number.match(/DNYS-RFQ-(\d+)/); if (m) next = parseInt(m[1]) + 1 }
      }
    } catch {}
    return `DNYS-RFQ-${String(next).padStart(4, '0')}`
  }

  const handleSupplierSelect = (supplierId: string) => {
    const s = suppliers.find(x => x.id === supplierId)
    if (s) setForm(prev => ({ ...prev, supplier_id: s.id, supplier_name: s.company_name, supplier_contact: s.contact_person || '', supplier_phone: s.phone || '', supplier_email: s.email || '', supplier_address: s.address || '' }))
  }

  const addItem = () => setItems(prev => [...prev, { ...emptyItem(), sira: prev.length + 1 }])
  const removeItem = (i: number) => { if (items.length <= 1) return; setItems(prev => prev.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, sira: idx + 1 }))) }
  const updateItem = (i: number, field: keyof RFQItem, value: any) => { setItems(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u }) }
  const duplicateItem = (i: number) => setItems(prev => [...prev, { ...prev[i], sira: prev.length + 1 }])

  const handleSave = async (status: string = 'draft') => {
    if (!form.supplier_name.trim()) { alert('Tedarikçi adı zorunludur!'); return }
    if (!items[0]?.parca_adi) { alert('En az bir kalem ekleyin!'); return }
    try {
      const payload = {
        company_id: companyId, rfq_number: form.rfq_number, rfq_date: form.rfq_date,
        deadline: form.deadline || null, delivery_time: form.delivery_time || null, payment_terms: form.payment_terms || null,
        supplier_id: form.supplier_id || null, supplier_name: form.supplier_name,
        supplier_contact: form.supplier_contact || null, supplier_phone: form.supplier_phone || null,
        supplier_email: form.supplier_email || null, supplier_address: form.supplier_address || null,
        currency: form.currency, notes: form.notes || null, internal_notes: form.internal_notes || null,
        status, updated_at: new Date().toISOString(),
      }
      let rfqId = editingId
      if (editingId) {
        await supabase.from('rfq').update(payload).eq('id', editingId)
        await supabase.from('rfq_items').delete().eq('rfq_id', editingId)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('rfq').insert({ ...payload, created_by: user?.id }).select().single()
        rfqId = data.id
      }
      const itemInserts = items.filter(i => i.parca_adi).map((item, idx) => ({
        rfq_id: rfqId, sira: idx + 1, parca_kodu: item.parca_kodu || null, parca_adi: item.parca_adi,
        malzeme: item.malzeme || null, miktar: item.miktar, birim: item.birim, teknik_detay: item.teknik_detay || null,
      }))
      if (itemInserts.length > 0) await supabase.from('rfq_items').insert(itemInserts)
      alert(editingId ? 'Teklif talebi güncellendi!' : 'Teklif talebi kaydedildi!')
      setView('list'); setEditingId(null); loadData()
    } catch (err: any) { alert('Hata: ' + (err.message || '')); console.error(err) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu teklif talebini silmek istediğinizden emin misiniz?')) return
    await supabase.from('rfq_items').delete().eq('rfq_id', id)
    await supabase.from('rfq').delete().eq('id', id)
    loadData()
  }

  const handleEdit = async (r: RFQ) => {
    setEditingId(r.id)
    setForm({
      rfq_number: r.rfq_number, rfq_date: r.rfq_date, deadline: r.deadline || '',
      delivery_time: r.delivery_time || '', payment_terms: r.payment_terms || '',
      supplier_id: r.supplier_id || '', supplier_name: r.supplier_name,
      supplier_contact: r.supplier_contact || '', supplier_phone: r.supplier_phone || '',
      supplier_email: r.supplier_email || '', supplier_address: r.supplier_address || '',
      currency: r.currency, notes: r.notes || '', internal_notes: r.internal_notes || '',
    })
    const { data } = await supabase.from('rfq_items').select('*').eq('rfq_id', r.id).order('sira')
    setItems(data?.map((d: any) => ({ id: d.id, sira: d.sira, parca_kodu: d.parca_kodu || '', parca_adi: d.parca_adi, malzeme: d.malzeme || '', miktar: d.miktar, birim: d.birim || 'adet', teknik_detay: d.teknik_detay || '' })) || [emptyItem()])
    setView('form')
  }

  const handleDuplicate = async (r: RFQ) => {
    const num = await generateNumber()
    setEditingId(null)
    setForm({ ...form, rfq_number: num, rfq_date: new Date().toISOString().split('T')[0], supplier_id: r.supplier_id || '', supplier_name: r.supplier_name, supplier_contact: r.supplier_contact || '', supplier_phone: r.supplier_phone || '', supplier_email: r.supplier_email || '', supplier_address: r.supplier_address || '', currency: r.currency, deadline: '', delivery_time: r.delivery_time || '', payment_terms: r.payment_terms || '', notes: r.notes || '', internal_notes: '' })
    const { data } = await supabase.from('rfq_items').select('*').eq('rfq_id', r.id).order('sira')
    setItems(data?.map((d: any) => ({ sira: d.sira, parca_kodu: d.parca_kodu || '', parca_adi: d.parca_adi, malzeme: d.malzeme || '', miktar: d.miktar, birim: d.birim || 'adet', teknik_detay: d.teknik_detay || '' })) || [emptyItem()])
    setView('form')
  }

  const handlePreview = async (r: RFQ) => {
    setPreviewRFQ(r)
    const { data } = await supabase.from('rfq_items').select('*').eq('rfq_id', r.id).order('sira')
    setPreviewItems(data || [])
    setView('preview')
  }

  const exportPDF = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight, position = 0
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight }
      pdf.save(`teklif-talebi-${previewRFQ?.rfq_number || 'yeni'}.pdf`)
    } catch (err) { console.error(err); alert('PDF oluşturulamadı!') }
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('rfq').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadData()
    if (view === 'preview' && previewRFQ) setPreviewRFQ({ ...previewRFQ, status })
  }

  const handleNew = async () => {
    const num = await generateNumber()
    setEditingId(null)
    setForm({ rfq_number: num, rfq_date: new Date().toISOString().split('T')[0], deadline: '', delivery_time: '', payment_terms: '', supplier_id: '', supplier_name: '', supplier_contact: '', supplier_phone: '', supplier_email: '', supplier_address: '', currency: 'EUR', notes: '', internal_notes: '' })
    setItems([emptyItem()])
    setView('form')
  }

  const filtered = rfqs.filter(r => {
    if (searchTerm && ![r.rfq_number, r.supplier_name, r.supplier_contact].some(f => f?.toLowerCase().includes(searchTerm.toLowerCase()))) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    return true
  })

  if (loading) return (
    <PermissionGuard module="inventory" permission="view">
      <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div></div>
    </PermissionGuard>
  )

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">

        {/* LİSTE */}
        {view === 'list' && (<>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Teklif Talepleri (RFQ)</h2>
              <p className="text-gray-600">Tedarikçilerden fiyat teklifi isteyin</p>
            </div>
            <button onClick={handleNew} className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5" /><span>Yeni Teklif Talebi</span></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500"><p className="text-sm text-gray-500">Toplam</p><p className="text-2xl font-bold">{rfqs.length}</p></div>
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400"><p className="text-sm text-gray-500">Taslak</p><p className="text-2xl font-bold text-gray-600">{rfqs.filter(r => r.status === 'draft').length}</p></div>
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400"><p className="text-sm text-gray-500">Gönderildi</p><p className="text-2xl font-bold text-blue-600">{rfqs.filter(r => r.status === 'sent').length}</p></div>
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500"><p className="text-sm text-gray-500">Teklif Alındı</p><p className="text-2xl font-bold text-green-600">{rfqs.filter(r => r.status === 'received').length}</p></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="RFQ no, tedarikçi ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="all">Tüm Durumlar</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">RFQ No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tedarikçi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Son Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Para Birimi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filtered.map(r => {
                      const st = STATUS_MAP[r.status] || STATUS_MAP.draft
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-semibold text-sm text-blue-700">{r.rfq_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{new Date(r.rfq_date).toLocaleDateString('tr-TR')}</td>
                          <td className="px-4 py-3"><div className="text-sm font-semibold text-gray-900">{r.supplier_name}</div>{r.supplier_contact && <div className="text-xs text-gray-500">{r.supplier_contact}</div>}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.deadline ? new Date(r.deadline).toLocaleDateString('tr-TR') : '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.currency}</td>
                          <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handlePreview(r)} title="Önizle / PDF" className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => handleEdit(r)} title="Düzenle" className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleDuplicate(r)} title="Kopyala" className="p-1.5 rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600"><Copy className="w-4 h-4" /></button>
                              {r.status === 'draft' && <button onClick={() => updateStatus(r.id, 'sent')} title="Gönderildi" className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"><Send className="w-4 h-4" /></button>}
                              <button onClick={() => handleDelete(r.id)} title="Sil" className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 text-lg">Henüz teklif talebi yok</p></div>
            )}
          </div>
        </>)}

        {/* FORM */}
        {view === 'form' && (<>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => { setView('list'); setEditingId(null) }} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
              <div><h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Teklif Talebini Düzenle' : 'Yeni Teklif Talebi'}</h2><p className="text-gray-500 text-sm font-mono">{form.rfq_number}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleSave('draft')} className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold">Taslak Kaydet</button>
              <button onClick={() => handleSave('sent')} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"><Send className="w-4 h-4" /> Kaydet & Gönderildi</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              {/* Talep Bilgileri */}
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2">Talep Bilgileri</h3>
                <div className="space-y-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">RFQ No</label><input type="text" value={form.rfq_number} onChange={e => setForm({ ...form, rfq_number: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Tarih</label><input type="date" value={form.rfq_date} onChange={e => setForm({ ...form, rfq_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Son Teklif Tarihi</label><input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Para Birimi</label><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">İstenen Teslim Süresi</label><input type="text" value={form.delivery_time} onChange={e => setForm({ ...form, delivery_time: e.target.value })} placeholder="Ör: 4-6 hafta" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ödeme Koşulları</label><input type="text" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} placeholder="Ör: 30 gün vadeli" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                </div>
              </div>

              {/* Tedarikçi */}
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2">Tedarikçi Bilgileri</h3>
                <div className="space-y-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Tedarikçi Seçin</label><select onChange={e => handleSupplierSelect(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="">Listeden seçin veya manuel girin</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Firma Adı <span className="text-red-500">*</span></label><input type="text" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Yetkili Kişi</label><input type="text" value={form.supplier_contact} onChange={e => setForm({ ...form, supplier_contact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Telefon</label><input type="text" value={form.supplier_phone} onChange={e => setForm({ ...form, supplier_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">E-posta</label><input type="text" value={form.supplier_email} onChange={e => setForm({ ...form, supplier_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  </div>
                </div>
              </div>

              {/* Notlar */}
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2">Notlar</h3>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Tedarikçiye Not</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Özel gereksinimler, teknik şartlar..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Dahili Not</label><textarea value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} rows={2} placeholder="Dahili notlar..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" /></div>
              </div>
            </div>

            {/* Kalemler */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Teklif İstenen Kalemler ({items.length})</h3>
                  <button onClick={addItem} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Kalem Ekle</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">Parça Kodu</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Parça Adı</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Malzeme</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-16">Miktar</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">Birim</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Teknik Detay</th>
                      <th className="px-2 py-2 w-20"></th>
                    </tr></thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-2 py-1.5"><input type="text" value={item.parca_kodu} onChange={e => updateItem(i, 'parca_kodu', e.target.value)} placeholder="Kod" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono" /></td>
                          <td className="px-2 py-1.5"><input type="text" value={item.parca_adi} onChange={e => updateItem(i, 'parca_adi', e.target.value)} placeholder="Parça adı *" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" /></td>
                          <td className="px-2 py-1.5"><input type="text" value={item.malzeme} onChange={e => updateItem(i, 'malzeme', e.target.value)} placeholder="Malzeme" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" /></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={item.miktar} onChange={e => updateItem(i, 'miktar', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center" /></td>
                          <td className="px-2 py-1.5"><select value={item.birim} onChange={e => updateItem(i, 'birim', e.target.value)} className="w-full px-1 py-1.5 border border-gray-200 rounded text-xs">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className="px-2 py-1.5"><input type="text" value={item.teknik_detay} onChange={e => updateItem(i, 'teknik_detay', e.target.value)} placeholder="Teknik şartlar" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs" /></td>
                          <td className="px-2 py-1.5"><div className="flex gap-1"><button onClick={() => duplicateItem(i)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600"><Copy className="w-3.5 h-3.5" /></button><button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={addItem} className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">+ Yeni Kalem Ekle</button>
              </div>
            </div>
          </div>
        </>)}

        {/* ÖNİZLEME / PDF */}
        {view === 'preview' && previewRFQ && (<>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
              <h2 className="text-2xl font-bold text-gray-800">Teklif Talebi Önizleme</h2>
            </div>
            <div className="flex gap-3">
              {previewRFQ.status === 'sent' && <button onClick={() => updateStatus(previewRFQ.id, 'received')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2"><Check className="w-4 h-4" /> Teklif Alındı</button>}
              <button onClick={exportPDF} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> PDF İndir</button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 mx-auto" style={{ maxWidth: '794px' }}>
            <div ref={printRef} style={{ padding: '28px 30px', fontFamily: "'Segoe UI', sans-serif", fontSize: '10px', color: '#1a1a2e', background: '#fff', width: '734px', margin: '0 auto' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #003366', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img src="/dunyalogopng.png" alt="Logo" style={{ width: '180px' }} />
                  <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.5 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#003366' }}>DÜNYASAN SAVUNMA ANONİM ŞİRKETİ</div>
                    Fabrikalar Mh. Kırıkkale Silah İhtisas OSB 2. Sk. No: 18/1 KIRIKKALE<br />
                    Tel: 0318 606 00 06 | +90 530 389 00 71 | satinalma@dunyasan.com
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#003366' }}>TEKLİF TALEBİ</div>
                  <div style={{ fontSize: '9px', color: '#888', fontStyle: 'italic' }}>Request for Quotation</div>
                </div>
              </div>

              {/* Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ border: '1px solid #dde1e7', borderRadius: '4px', padding: '6px 10px', background: '#fafbfc' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '4px', paddingBottom: '3px', borderBottom: '1px solid #e2e6eb' }}>Tedarikçi Bilgileri</div>
                  <table style={{ fontSize: '9px', lineHeight: 1.5 }}><tbody>
                    <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Firma:</td><td>{previewRFQ.supplier_name}</td></tr>
                    {previewRFQ.supplier_contact && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Yetkili:</td><td>{previewRFQ.supplier_contact}</td></tr>}
                    {previewRFQ.supplier_phone && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Tel:</td><td>{previewRFQ.supplier_phone}</td></tr>}
                    {previewRFQ.supplier_email && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>E-posta:</td><td>{previewRFQ.supplier_email}</td></tr>}
                  </tbody></table>
                </div>
                <div style={{ border: '1px solid #dde1e7', borderRadius: '4px', padding: '6px 10px', background: '#fafbfc' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '4px', paddingBottom: '3px', borderBottom: '1px solid #e2e6eb' }}>Talep Bilgileri</div>
                  <table style={{ fontSize: '9px', lineHeight: 1.5 }}><tbody>
                    <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>RFQ No:</td><td style={{ fontWeight: 700 }}>{previewRFQ.rfq_number}</td></tr>
                    <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Tarih:</td><td>{new Date(previewRFQ.rfq_date).toLocaleDateString('tr-TR')}</td></tr>
                    {previewRFQ.deadline && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Son Teklif:</td><td style={{ fontWeight: 700, color: '#c53030' }}>{new Date(previewRFQ.deadline).toLocaleDateString('tr-TR')}</td></tr>}
                    {previewRFQ.delivery_time && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Teslim:</td><td>{previewRFQ.delivery_time}</td></tr>}
                    {previewRFQ.payment_terms && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Ödeme:</td><td>{previewRFQ.payment_terms}</td></tr>}
                    <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '6px' }}>Para Birimi:</td><td>{previewRFQ.currency}</td></tr>
                  </tbody></table>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', border: '1.5px solid #003366' }}>
                <thead><tr style={{ background: '#003366', color: '#fff' }}>
                  <th style={{ padding: '6px 5px', textAlign: 'center', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80', width: '30px' }}>SIRA</th>
                  <th style={{ padding: '6px 5px', textAlign: 'left', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80' }}>PARÇA KODU</th>
                  <th style={{ padding: '6px 5px', textAlign: 'left', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80' }}>PARÇA ADI</th>
                  <th style={{ padding: '6px 5px', textAlign: 'left', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80' }}>MALZEME</th>
                  <th style={{ padding: '6px 5px', textAlign: 'center', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80', width: '50px' }}>MİKTAR</th>
                  <th style={{ padding: '6px 5px', textAlign: 'center', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80', width: '50px' }}>BİRİM</th>
                  <th style={{ padding: '6px 5px', textAlign: 'right', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80', width: '80px' }}>BİRİM FİYAT</th>
                  <th style={{ padding: '6px 5px', textAlign: 'right', fontSize: '9px', fontWeight: 800, border: '1px solid #1a4d80', width: '80px' }}>TOPLAM</th>
                </tr></thead>
                <tbody>
                  {previewItems.map((item: any, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7fa' }}>
                      <td style={{ padding: '4px 5px', textAlign: 'center', fontWeight: 700, color: '#555', border: '1px solid #bcc3cc' }}>{item.sira}</td>
                      <td style={{ padding: '4px 5px', fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#003366', border: '1px solid #bcc3cc' }}>{item.parca_kodu || '—'}</td>
                      <td style={{ padding: '4px 5px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid #bcc3cc' }}>{item.parca_adi}</td>
                      <td style={{ padding: '4px 5px', fontSize: '8px', color: '#444', border: '1px solid #bcc3cc' }}>{item.malzeme || '—'}</td>
                      <td style={{ padding: '4px 5px', textAlign: 'center', fontWeight: 800, border: '1px solid #bcc3cc' }}>{item.miktar}</td>
                      <td style={{ padding: '4px 5px', textAlign: 'center', color: '#555', border: '1px solid #bcc3cc' }}>{item.birim}</td>
                      <td style={{ padding: '4px 5px', textAlign: 'right', border: '1px solid #bcc3cc', color: '#999', fontStyle: 'italic', fontSize: '8px' }}>Teklif bekleniyor</td>
                      <td style={{ padding: '4px 5px', textAlign: 'right', border: '1px solid #bcc3cc', color: '#999', fontStyle: 'italic', fontSize: '8px' }}>Teklif bekleniyor</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes */}
              {previewRFQ.notes && (
                <div style={{ border: '1px solid #ccc', padding: '6px 10px', marginTop: '10px', background: '#fafbfc' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '3px' }}>Notlar / Teknik Şartlar</div>
                  <p style={{ fontSize: '9px', color: '#444', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{previewRFQ.notes}</p>
                </div>
              )}

              <div style={{ marginTop: '12px', padding: '8px 10px', background: '#f0f4ff', border: '1px solid #c3d4f7', borderRadius: '4px', fontSize: '9px', color: '#003366' }}>
                <strong>Lütfen yukarıdaki kalemler için birim fiyat ve toplam fiyat bilgilerini doldurarak en geç {previewRFQ.deadline ? new Date(previewRFQ.deadline).toLocaleDateString('tr-TR') : '___/___/______'} tarihine kadar tarafımıza iletiniz.</strong>
                <br /><span style={{ fontSize: '8px', color: '#555' }}>Fiyatlar {previewRFQ.currency} cinsinden ve KDV hariç olarak bildirilmelidir.</span>
              </div>

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #003366' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '30px' }}>Talep Eden</div>
                  <div style={{ borderTop: '1px solid #999', width: '180px', margin: '0 auto 3px' }}></div>
                  <div style={{ fontSize: '8px', color: '#888' }}>DÜNYASAN SAVUNMA A.Ş.</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '30px' }}>Tedarikçi Onayı</div>
                  <div style={{ borderTop: '1px solid #999', width: '180px', margin: '0 auto 3px' }}></div>
                  <div style={{ fontSize: '8px', color: '#888' }}>Kaşe / İmza / Tarih</div>
                </div>
              </div>
            </div>
          </div>
        </>)}
      </div>
    </PermissionGuard>
  )
}

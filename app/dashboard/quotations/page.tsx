'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Edit3, Trash2, Search, Eye, Download, Copy, Send, Check, X, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── Tipler ─────────────────────────────────────────────
interface Customer {
  id: string
  customer_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  tax_office: string | null
}

interface QuotationItem {
  id?: string
  sira: number
  parca_kodu: string
  parca_adi: string
  malzeme: string
  miktar: number
  birim: string
  birim_fiyat: number
  toplam_fiyat: number
  aciklama: string
}

interface Quotation {
  id: string
  quotation_number: string
  quotation_date: string
  validity_days: number
  delivery_time: string | null
  payment_terms: string | null
  customer_id: string | null
  customer_name: string
  customer_contact: string | null
  customer_phone: string | null
  customer_email: string | null
  customer_address: string | null
  customer_tax_number: string | null
  customer_tax_office: string | null
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_rate: number
  discount_amount: number
  grand_total: number
  notes: string | null
  internal_notes: string | null
  status: string
  created_at: string
}

// ── Sabitler ───────────────────────────────────────────
const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'ABD Doları ($)' },
  { code: 'TRY', symbol: '₺', label: 'Türk Lirası (₺)' },
  { code: 'GBP', symbol: '£', label: 'İngiliz Sterlini (£)' },
  { code: 'CHF', symbol: 'CHF', label: 'İsviçre Frangı (CHF)' },
]

const UNITS = ['adet', 'kg', 'metre', 'litre', 'set', 'takım', 'paket', 'kutu', 'ton']

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Taslak', bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { label: 'Gönderildi', bg: 'bg-blue-100', text: 'text-blue-700' },
  accepted: { label: 'Kabul Edildi', bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { label: 'Reddedildi', bg: 'bg-red-100', text: 'text-red-700' },
  expired: { label: 'Süresi Doldu', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  revised: { label: 'Revize Edildi', bg: 'bg-purple-100', text: 'text-purple-700' },
}

const emptyItem = (): QuotationItem => ({
  sira: 1,
  parca_kodu: '',
  parca_adi: '',
  malzeme: '',
  miktar: 1,
  birim: 'adet',
  birim_fiyat: 0,
  toplam_fiyat: 0,
  aciklama: '',
})

// ── Ana Bileşen ────────────────────────────────────────
export default function QuotationsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Listeler
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Görünüm
  const [view, setView] = useState<'list' | 'form' | 'preview'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Liste filtreleri
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCurrency, setFilterCurrency] = useState('all')

  // Form state
  const [form, setForm] = useState({
    quotation_number: '',
    quotation_date: new Date().toISOString().split('T')[0],
    validity_days: 30,
    delivery_time: '',
    payment_terms: '',
    customer_id: '',
    customer_name: '',
    customer_contact: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_tax_number: '',
    customer_tax_office: '',
    currency: 'EUR',
    tax_rate: 0,
    discount_rate: 0,
    notes: '',
    internal_notes: '',
  })
  const [items, setItems] = useState<QuotationItem[]>([emptyItem()])

  // Preview
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null)
  const [previewItems, setPreviewItems] = useState<QuotationItem[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  // ── Veri Yükleme ─────────────────────────────────────
  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, full_name')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      setCurrentUser(profile.full_name || '')

      const [quotRes, custRes] = await Promise.all([
        supabase
          .from('quotations')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_companies')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('customer_name'),
      ])

      setQuotations(quotRes.data || [])
      setCustomers(custRes.data || [])
    } catch (err) {
      console.error('Veri yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Teklif Numarası Üretme ───────────────────────────
  const generateNumber = async (): Promise<string> => {
    let next = 1
    try {
      if (companyId) {
        const { data } = await supabase
          .from('quotations')
          .select('quotation_number')
          .eq('company_id', companyId)
          .like('quotation_number', 'DNYS-TKL-%')
          .order('created_at', { ascending: false })
          .limit(1)

        if (data?.[0]?.quotation_number) {
          const m = data[0].quotation_number.match(/DNYS-TKL-(\d+)/)
          if (m) next = parseInt(m[1]) + 1
        }
      }
    } catch {}
    return `DNYS-TKL-${String(next).padStart(4, '0')}`
  }

  // ── Müşteri Seçimi ────────────────────────────────────
  const handleCustomerSelect = (customerId: string) => {
    const c = customers.find(x => x.id === customerId)
    if (c) {
      setForm(prev => ({
        ...prev,
        customer_id: c.id,
        customer_name: c.customer_name,
        customer_contact: c.contact_person || '',
        customer_phone: c.phone || '',
        customer_email: c.email || '',
        customer_address: c.address || '',
        customer_tax_number: c.tax_number || '',
        customer_tax_office: c.tax_office || '',
      }))
    }
  }

  // ── Kalem İşlemleri ───────────────────────────────────
  const addItem = () => {
    setItems(prev => [...prev, { ...emptyItem(), sira: prev.length + 1 }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, sira: i + 1 })))
  }

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'miktar' || field === 'birim_fiyat') {
        const miktar = field === 'miktar' ? (parseFloat(value) || 0) : updated[index].miktar
        const fiyat = field === 'birim_fiyat' ? (parseFloat(value) || 0) : updated[index].birim_fiyat
        updated[index].toplam_fiyat = miktar * fiyat
      }
      return updated
    })
  }

  const duplicateItem = (index: number) => {
    setItems(prev => {
      const copy = { ...prev[index], sira: prev.length + 1 }
      return [...prev, copy]
    })
  }

  // ── Hesaplamalar ──────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + i.toplam_fiyat, 0)
  const discountAmount = subtotal * (parseFloat(String(form.discount_rate)) || 0) / 100
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (parseFloat(String(form.tax_rate)) || 0) / 100
  const grandTotal = afterDiscount + taxAmount

  const currencySymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol || '€'

  const fmtMoney = (n: number) =>
    `${currencySymbol} ${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ── Kaydet ────────────────────────────────────────────
  const handleSave = async (status: string = 'draft') => {
    if (!form.customer_name.trim()) {
      alert('Müşteri adı zorunludur!')
      return
    }
    if (items.length === 0 || !items[0].parca_adi) {
      alert('En az bir kalem ekleyin!')
      return
    }

    try {
      const payload = {
        company_id: companyId,
        quotation_number: form.quotation_number,
        quotation_date: form.quotation_date,
        validity_days: form.validity_days,
        delivery_time: form.delivery_time || null,
        payment_terms: form.payment_terms || null,
        customer_id: form.customer_id || null,
        customer_name: form.customer_name,
        customer_contact: form.customer_contact || null,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        customer_address: form.customer_address || null,
        customer_tax_number: form.customer_tax_number || null,
        customer_tax_office: form.customer_tax_office || null,
        currency: form.currency,
        subtotal,
        tax_rate: parseFloat(String(form.tax_rate)) || 0,
        tax_amount: taxAmount,
        discount_rate: parseFloat(String(form.discount_rate)) || 0,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        notes: form.notes || null,
        internal_notes: form.internal_notes || null,
        status,
        updated_at: new Date().toISOString(),
      }

      let quotationId = editingId

      if (editingId) {
        const { error } = await supabase.from('quotations').update(payload).eq('id', editingId)
        if (error) throw error
        // Eski kalemleri sil
        await supabase.from('quotation_items').delete().eq('quotation_id', editingId)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('quotations')
          .insert({ ...payload, created_by: user?.id })
          .select()
          .single()
        if (error) throw error
        quotationId = data.id
      }

      // Kalemleri ekle
      const itemInserts = items.filter(i => i.parca_adi).map((item, idx) => ({
        quotation_id: quotationId,
        sira: idx + 1,
        parca_kodu: item.parca_kodu || null,
        parca_adi: item.parca_adi,
        malzeme: item.malzeme || null,
        miktar: item.miktar,
        birim: item.birim,
        birim_fiyat: item.birim_fiyat,
        toplam_fiyat: item.toplam_fiyat,
        aciklama: item.aciklama || null,
      }))

      if (itemInserts.length > 0) {
        const { error } = await supabase.from('quotation_items').insert(itemInserts)
        if (error) throw error
      }

      alert(editingId ? 'Teklif güncellendi!' : 'Teklif kaydedildi!')
      setView('list')
      setEditingId(null)
      loadData()
    } catch (err: any) {
      console.error('Kayıt hatası:', err)
      alert('Hata: ' + (err.message || 'Bilinmeyen hata'))
    }
  }

  // ── Sil ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Bu teklifi silmek istediğinizden emin misiniz?')) return
    try {
      await supabase.from('quotation_items').delete().eq('quotation_id', id)
      await supabase.from('quotations').delete().eq('id', id)
      loadData()
    } catch (err) {
      console.error('Silme hatası:', err)
    }
  }

  // ── Düzenle ───────────────────────────────────────────
  const handleEdit = async (q: Quotation) => {
    setEditingId(q.id)
    setForm({
      quotation_number: q.quotation_number,
      quotation_date: q.quotation_date,
      validity_days: q.validity_days,
      delivery_time: q.delivery_time || '',
      payment_terms: q.payment_terms || '',
      customer_id: q.customer_id || '',
      customer_name: q.customer_name,
      customer_contact: q.customer_contact || '',
      customer_phone: q.customer_phone || '',
      customer_email: q.customer_email || '',
      customer_address: q.customer_address || '',
      customer_tax_number: q.customer_tax_number || '',
      customer_tax_office: q.customer_tax_office || '',
      currency: q.currency,
      tax_rate: q.tax_rate,
      discount_rate: q.discount_rate,
      notes: q.notes || '',
      internal_notes: q.internal_notes || '',
    })

    const { data } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', q.id)
      .order('sira')

    setItems(data && data.length > 0 ? data.map((d: any) => ({
      id: d.id,
      sira: d.sira,
      parca_kodu: d.parca_kodu || '',
      parca_adi: d.parca_adi,
      malzeme: d.malzeme || '',
      miktar: d.miktar,
      birim: d.birim || 'adet',
      birim_fiyat: d.birim_fiyat,
      toplam_fiyat: d.toplam_fiyat,
      aciklama: d.aciklama || '',
    })) : [emptyItem()])

    setView('form')
  }

  // ── Kopyala ───────────────────────────────────────────
  const handleDuplicate = async (q: Quotation) => {
    const newNum = await generateNumber()
    setEditingId(null)
    setForm({
      quotation_number: newNum,
      quotation_date: new Date().toISOString().split('T')[0],
      validity_days: q.validity_days,
      delivery_time: q.delivery_time || '',
      payment_terms: q.payment_terms || '',
      customer_id: q.customer_id || '',
      customer_name: q.customer_name,
      customer_contact: q.customer_contact || '',
      customer_phone: q.customer_phone || '',
      customer_email: q.customer_email || '',
      customer_address: q.customer_address || '',
      customer_tax_number: q.customer_tax_number || '',
      customer_tax_office: q.customer_tax_office || '',
      currency: q.currency,
      tax_rate: q.tax_rate,
      discount_rate: q.discount_rate,
      notes: q.notes || '',
      internal_notes: q.internal_notes || '',
    })

    const { data } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', q.id)
      .order('sira')

    setItems(data?.map((d: any) => ({
      sira: d.sira,
      parca_kodu: d.parca_kodu || '',
      parca_adi: d.parca_adi,
      malzeme: d.malzeme || '',
      miktar: d.miktar,
      birim: d.birim || 'adet',
      birim_fiyat: d.birim_fiyat,
      toplam_fiyat: d.toplam_fiyat,
      aciklama: d.aciklama || '',
    })) || [emptyItem()])

    setView('form')
  }

  // ── Önizleme & PDF ────────────────────────────────────
  const handlePreview = async (q: Quotation) => {
    setPreviewQuotation(q)
    const { data } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', q.id)
      .order('sira')
    setPreviewItems(data || [])
    setView('preview')
  }

  const exportPDF = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('l', 'mm', 'a4')
      const imgWidth = 297
      const pageHeight = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`fiyat-teklifi-${previewQuotation?.quotation_number || 'yeni'}.pdf`)
    } catch (err) {
      console.error('PDF hatası:', err)
      alert('PDF oluşturulamadı!')
    }
  }

  // ── Durum Değiştir ────────────────────────────────────
  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quotations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadData()
  }

  // ── Yeni Teklif ───────────────────────────────────────
  const handleNew = async () => {
    const num = await generateNumber()
    setEditingId(null)
    setForm({
      quotation_number: num,
      quotation_date: new Date().toISOString().split('T')[0],
      validity_days: 30,
      delivery_time: 'Siparişten itibaren 8-12 hafta',
      payment_terms: '',
      customer_id: '',
      customer_name: '',
      customer_contact: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      customer_tax_number: '',
      customer_tax_office: '',
      currency: 'EUR',
      tax_rate: 0,
      discount_rate: 0,
      notes: '',
      internal_notes: '',
    })
    setItems([emptyItem()])
    setView('form')
  }

  // ── Filtre ────────────────────────────────────────────
  const filtered = quotations.filter(q => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      if (![q.quotation_number, q.customer_name, q.customer_contact].some(f => f?.toLowerCase().includes(t))) return false
    }
    if (filterStatus !== 'all' && q.status !== filterStatus) return false
    if (filterCurrency !== 'all' && q.currency !== filterCurrency) return false
    return true
  })

  // ── İstatistikler ─────────────────────────────────────
  const totalCount = quotations.length
  const draftCount = quotations.filter(q => q.status === 'draft').length
  const sentCount = quotations.filter(q => q.status === 'sent').length
  const acceptedCount = quotations.filter(q => q.status === 'accepted').length

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <PermissionGuard module="inventory" permission="view">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Yükleniyor...
          </div>
        </div>
      </PermissionGuard>
    )
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">

        {/* ════════════ LİSTE GÖRÜNÜMÜ ════════════ */}
        {view === 'list' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Fiyat Teklifleri</h2>
                <p className="text-gray-600">Müşterilere gönderilecek proforma fiyat tekliflerini yönetin</p>
              </div>
              <button onClick={handleNew} className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-5 h-5" />
                <span>Yeni Teklif</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-500">Toplam</p>
                <p className="text-2xl font-bold text-gray-800">{totalCount}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
                <p className="text-sm text-gray-500">Taslak</p>
                <p className="text-2xl font-bold text-gray-600">{draftCount}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400">
                <p className="text-sm text-gray-500">Gönderildi</p>
                <p className="text-2xl font-bold text-blue-600">{sentCount}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-500">Kabul Edildi</p>
                <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
              </div>
            </div>

            {/* Filtreler */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Teklif no, müşteri ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="all">Tüm Durumlar</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="all">Tüm Para Birimleri</option>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>

            {/* Tablo */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Teklif No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Müşteri</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Para Birimi</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Toplam</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filtered.map(q => {
                        const st = STATUS_MAP[q.status] || STATUS_MAP.draft
                        const sym = CURRENCIES.find(c => c.code === q.currency)?.symbol || '€'
                        return (
                          <tr key={q.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-semibold text-sm text-blue-700">{q.quotation_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{new Date(q.quotation_date).toLocaleDateString('tr-TR')}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">{q.customer_name}</div>
                              {q.customer_contact && <div className="text-xs text-gray-500">{q.customer_contact}</div>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{q.currency}</td>
                            <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                              {sym} {q.grand_total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handlePreview(q)} title="Önizle / PDF" className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => handleEdit(q)} title="Düzenle" className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDuplicate(q)} title="Kopyala" className="p-1.5 rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600"><Copy className="w-4 h-4" /></button>
                                {q.status === 'draft' && (
                                  <button onClick={() => updateStatus(q.id, 'sent')} title="Gönderildi olarak işaretle" className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"><Send className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => handleDelete(q.id)} title="Sil" className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Henüz fiyat teklifi yok</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════ FORM GÖRÜNÜMÜ ════════════ */}
        {view === 'form' && (
          <>
            {/* Form Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => { setView('list'); setEditingId(null) }} className="p-2 rounded-lg hover:bg-gray-100">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Teklifi Düzenle' : 'Yeni Fiyat Teklifi'}</h2>
                  <p className="text-gray-500 text-sm font-mono">{form.quotation_number}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleSave('draft')} className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold">Taslak Kaydet</button>
                <button onClick={() => handleSave('sent')} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4" /> Kaydet & Gönderildi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sol: Teklif Bilgileri */}
              <div className="lg:col-span-1 space-y-6">
                {/* Teklif Detayları */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2">Teklif Bilgileri</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Teklif No</label>
                      <input type="text" value={form.quotation_number} onChange={e => setForm({ ...form, quotation_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tarih</label>
                        <input type="date" value={form.quotation_date} onChange={e => setForm({ ...form, quotation_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Geçerlilik (Gün)</label>
                        <input type="number" min="1" value={form.validity_days} onChange={e => setForm({ ...form, validity_days: parseInt(e.target.value) || 30 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Para Birimi</label>
                      <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Teslim Süresi</label>
                      <input type="text" value={form.delivery_time} onChange={e => setForm({ ...form, delivery_time: e.target.value })}
                        placeholder="Ör: Siparişten itibaren 8-12 hafta"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Ödeme Koşulları</label>
                      <input type="text" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                        placeholder="Ör: %30 peşin, %70 teslimde"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Müşteri Bilgileri */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2">Müşteri Bilgileri</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Müşteri Seçin</label>
                      <select onChange={e => handleCustomerSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Listeden seçin veya manuel girin</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Firma Adı <span className="text-red-500">*</span></label>
                      <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Yetkili Kişi</label>
                      <input type="text" value={form.customer_contact} onChange={e => setForm({ ...form, customer_contact: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Telefon</label>
                        <input type="text" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">E-posta</label>
                        <input type="text" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Adres</label>
                      <textarea value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Vergi No</label>
                        <input type="text" value={form.customer_tax_number} onChange={e => setForm({ ...form, customer_tax_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Vergi Dairesi</label>
                        <input type="text" value={form.customer_tax_office} onChange={e => setForm({ ...form, customer_tax_office: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vergi & İndirim & Toplam */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2">Toplam & Vergi</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">İndirim (%)</label>
                        <input type="number" min="0" max="100" step="0.01" value={form.discount_rate}
                          onChange={e => setForm({ ...form, discount_rate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">KDV (%)</label>
                        <input type="number" min="0" max="100" step="0.01" value={form.tax_rate}
                          onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Ara Toplam:</span><span className="font-semibold">{fmtMoney(subtotal)}</span></div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-red-600"><span>İndirim ({form.discount_rate}%):</span><span>-{fmtMoney(discountAmount)}</span></div>
                      )}
                      {taxAmount > 0 && (
                        <div className="flex justify-between"><span className="text-gray-600">KDV ({form.tax_rate}%):</span><span className="font-semibold">{fmtMoney(taxAmount)}</span></div>
                      )}
                      <div className="flex justify-between border-t pt-2 text-lg font-bold text-blue-700">
                        <span>GENEL TOPLAM:</span><span>{fmtMoney(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notlar */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2">Notlar</h3>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Müşteriye Not (teklifte görünür)</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                      placeholder="Teslim şartları, özel koşullar..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Dahili Not (sadece siz görürsünüz)</label>
                    <textarea value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} rows={2}
                      placeholder="Dahili notlar..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              </div>

              {/* Sağ: Ürünler Tablosu */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">Teklif Kalemleri ({items.length})</h3>
                    <button onClick={addItem} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Kalem Ekle
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">Parça Kodu</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Parça Adı</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Malzeme</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-16">Miktar</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-20">Birim</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-28">Birim Fiyat</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 w-28">Toplam</th>
                          <th className="px-2 py-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                            <td className="px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={item.parca_kodu} onChange={e => updateItem(i, 'parca_kodu', e.target.value)}
                                placeholder="Kod" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={item.parca_adi} onChange={e => updateItem(i, 'parca_adi', e.target.value)}
                                placeholder="Parça adı *" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={item.malzeme} onChange={e => updateItem(i, 'malzeme', e.target.value)}
                                placeholder="Malzeme" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" step="0.01" value={item.miktar} onChange={e => updateItem(i, 'miktar', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={item.birim} onChange={e => updateItem(i, 'birim', e.target.value)}
                                className="w-full px-1 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400">
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" step="0.01" value={item.birim_fiyat} onChange={e => updateItem(i, 'birim_fiyat', e.target.value)}
                                placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono font-semibold text-xs text-blue-700">
                              {fmtMoney(item.toplam_fiyat)}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <button onClick={() => duplicateItem(i)} title="Kopyala" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600"><Copy className="w-3.5 h-3.5" /></button>
                                <button onClick={() => removeItem(i)} title="Sil" className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={addItem} className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    + Yeni Kalem Ekle
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════ ÖNİZLEME / PDF GÖRÜNÜMÜ ════════════ */}
        {view === 'preview' && previewQuotation && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('list')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
                <h2 className="text-2xl font-bold text-gray-800">Teklif Önizleme</h2>
              </div>
              <div className="flex gap-3">
                <button onClick={() => updateStatus(previewQuotation.id, 'accepted')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" /> Kabul Edildi
                </button>
                <button onClick={() => updateStatus(previewQuotation.id, 'rejected')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold flex items-center gap-2">
                  <X className="w-4 h-4" /> Reddedildi
                </button>
                <button onClick={exportPDF} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" /> PDF İndir
                </button>
              </div>
            </div>

            {/* PDF Çıktı Alanı */}
            <div className="bg-white rounded-xl shadow-lg p-2">
              <div ref={printRef} style={{ padding: '30px 40px', fontFamily: "'Segoe UI', sans-serif", fontSize: '11px', color: '#1a1a2e', background: '#fff' }}>
                {/* PDF Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #003366', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src="/dunyalogopng.png" alt="Logo" style={{ width: '160px' }} />
                    <div style={{ fontSize: '10px', color: '#444', lineHeight: 1.6 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#003366', marginBottom: '2px' }}>DÜNYASAN SAVUNMA ANONİM ŞİRKETİ</div>
                      Fabrikalar Mh. Kırıkkale Silah İhtisas OSB 2. Sk. No: 18/1 KIRIKKALE<br />
                      Tel: 0318 606 00 06 | +90 530 389 00 71<br />
                      satinalma@dunyasan.com | VKN: 123 110 3150
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#003366', letterSpacing: '1px' }}>PROFORMA FİYAT TEKLİFİ</div>
                    <div style={{ fontSize: '10px', color: '#888', fontStyle: 'italic' }}>Proforma Price Quotation</div>
                  </div>
                </div>

                {/* Info Boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                  <div style={{ border: '1px solid #dde1e7', borderRadius: '6px', padding: '12px 16px', background: '#fafbfc' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid #e2e6eb' }}>Müşteri Bilgileri</div>
                    <table style={{ fontSize: '10px', lineHeight: 1.8 }}>
                      <tbody>
                        <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Firma:</td><td>{previewQuotation.customer_name}</td></tr>
                        {previewQuotation.customer_contact && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Yetkili:</td><td>{previewQuotation.customer_contact}</td></tr>}
                        {previewQuotation.customer_phone && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Tel:</td><td>{previewQuotation.customer_phone}</td></tr>}
                        {previewQuotation.customer_email && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>E-posta:</td><td>{previewQuotation.customer_email}</td></tr>}
                        {previewQuotation.customer_address && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Adres:</td><td>{previewQuotation.customer_address}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ border: '1px solid #dde1e7', borderRadius: '6px', padding: '12px 16px', background: '#fafbfc' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid #e2e6eb' }}>Teklif Bilgileri</div>
                    <table style={{ fontSize: '10px', lineHeight: 1.8 }}>
                      <tbody>
                        <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Teklif No:</td><td style={{ fontWeight: 700 }}>{previewQuotation.quotation_number}</td></tr>
                        <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Tarih:</td><td>{new Date(previewQuotation.quotation_date).toLocaleDateString('tr-TR')}</td></tr>
                        <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Geçerlilik:</td><td>{previewQuotation.validity_days} gün</td></tr>
                        {previewQuotation.delivery_time && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Teslim:</td><td>{previewQuotation.delivery_time}</td></tr>}
                        {previewQuotation.payment_terms && <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Ödeme:</td><td>{previewQuotation.payment_terms}</td></tr>}
                        <tr><td style={{ fontWeight: 600, color: '#555', paddingRight: '10px' }}>Para Birimi:</td><td>{previewQuotation.currency}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Products Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#003366', color: '#fff' }}>
                      <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 600 }}>Sıra</th>
                      <th style={{ padding: '7px 6px', textAlign: 'left', fontSize: '9px', fontWeight: 600 }}>Parça Kodu</th>
                      <th style={{ padding: '7px 6px', textAlign: 'left', fontSize: '9px', fontWeight: 600 }}>Parça Adı</th>
                      <th style={{ padding: '7px 6px', textAlign: 'left', fontSize: '9px', fontWeight: 600 }}>Malzeme</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 600 }}>Miktar</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 600 }}>Birim</th>
                      <th style={{ padding: '7px 6px', textAlign: 'right', fontSize: '9px', fontWeight: 600 }}>Birim Fiyat</th>
                      <th style={{ padding: '7px 6px', textAlign: 'right', fontSize: '9px', fontWeight: 600 }}>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item: any, i: number) => {
                      const sym = CURRENCIES.find(c => c.code === previewQuotation.currency)?.symbol || '€'
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #eef0f3', background: i % 2 === 0 ? '#fff' : '#f8f9fb' }}>
                          <td style={{ padding: '5px 6px', textAlign: 'center', color: '#666', fontWeight: 600 }}>{item.sira}</td>
                          <td style={{ padding: '5px 6px', fontFamily: 'Consolas, monospace', fontWeight: 600, color: '#003366' }}>{item.parca_kodu || '—'}</td>
                          <td style={{ padding: '5px 6px', fontWeight: 600, textTransform: 'uppercase', fontSize: '9.5px' }}>{item.parca_adi}</td>
                          <td style={{ padding: '5px 6px', fontSize: '9px', color: '#555', maxWidth: '200px', wordBreak: 'break-word' as const }}>{item.malzeme || '—'}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>{item.miktar}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'center', color: '#666' }}>{item.birim}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Consolas, monospace', color: '#2c5f8a', fontWeight: 600 }}>
                            {sym} {item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#003366' }}>
                            {sym} {item.toplam_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <div style={{ width: '320px', border: '2px solid #003366', borderRadius: '6px', overflow: 'hidden' }}>
                    {(() => {
                      const sym = CURRENCIES.find(c => c.code === previewQuotation.currency)?.symbol || '€'
                      const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '7px 14px', fontSize: '11px', borderBottom: '1px solid #e2e6eb' }
                      return (
                        <>
                          <div style={rowStyle}><span style={{ fontWeight: 600, color: '#444' }}>Ara Toplam:</span><span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#003366' }}>{sym} {previewQuotation.subtotal?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                          {previewQuotation.discount_amount > 0 && (
                            <div style={rowStyle}><span style={{ fontWeight: 600, color: '#c53030' }}>İndirim ({previewQuotation.discount_rate}%):</span><span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#c53030' }}>-{sym} {previewQuotation.discount_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                          )}
                          {previewQuotation.tax_amount > 0 && (
                            <div style={rowStyle}><span style={{ fontWeight: 600, color: '#444' }}>KDV ({previewQuotation.tax_rate}%):</span><span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#003366' }}>{sym} {previewQuotation.tax_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#003366' }}>
                            <span style={{ fontWeight: 700, color: '#fff', fontSize: '12px' }}>GENEL TOPLAM</span>
                            <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#fff', fontSize: '14px' }}>{sym} {previewQuotation.grand_total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Notes */}
                {previewQuotation.notes && (
                  <div style={{ border: '1px solid #dde1e7', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', background: '#fafbfc' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '6px' }}>Notlar</div>
                    <p style={{ fontSize: '10px', color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewQuotation.notes}</p>
                  </div>
                )}

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #003366' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '40px' }}>Teklifi Hazırlayan</div>
                    <div style={{ borderTop: '1px solid #999', width: '200px', margin: '0 auto 4px' }}></div>
                    <div style={{ fontSize: '9px', color: '#888' }}>DÜNYASAN SAVUNMA A.Ş.</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', marginBottom: '40px' }}>Müşteri Onayı</div>
                    <div style={{ borderTop: '1px solid #999', width: '200px', margin: '0 auto 4px' }}></div>
                    <div style={{ fontSize: '9px', color: '#888' }}>Kaşe / İmza / Tarih</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '8px', color: '#999', marginTop: '12px', fontStyle: 'italic' }}>
                  Bu belge DÜNYASAN SAVUNMA ANONİM ŞİRKETİ tarafından hazırlanmıştır. Gizli ve özeldir.
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </PermissionGuard>
  )
}

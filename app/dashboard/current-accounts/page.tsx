'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, DollarSign, Eye, ArrowLeft, Search, Plus, X, Edit2, Trash2, Tag, Check, Printer } from 'lucide-react'

// Türkiye'deki yaygın bankalar
const BANKS = [
  'Garanti BBVA', 'Yapı Kredi', 'İş Bankası', 'Akbank', 'Halkbank',
  'Ziraat Bankası', 'VakıfBank', 'Denizbank', 'TEB', 'ING Bank',
  'QNB Finansbank', 'Şekerbank', 'HSBC', 'Albaraka Türk', 'Kuveyt Türk',
  'Türkiye Finans', 'Ziraat Katılım', 'Vakıf Katılım', 'Emlak Katılım',
  'Odeabank', 'Anadolubank', 'Burgan Bank', 'Fibabanka', 'ICBC Turkey',
  'Citibank', 'Türk Eximbank', 'Diğer'
]

// Yaygın sektörler
const SECTORS = [
  'Savunma Sanayi', 'Havacılık', 'Otomotiv', 'Makine İmalatı', 'Elektronik',
  'İnşaat', 'Tekstil', 'Gıda', 'Sağlık', 'Eğitim', 'Yazılım / IT',
  'Lojistik / Nakliye', 'Enerji', 'Madencilik', 'Kimya / Petrokimya',
  'Mobilya', 'Plastik', 'Metal', 'Tarım / Hayvancılık', 'Turizm',
  'Finans / Bankacılık', 'Telekom', 'Medya / Reklam', 'Perakende',
  'Toptan Ticaret', 'Hizmet', 'Personel', 'Diğer'
]

// Cari hesap özet/geçmiş yazdırma — yeni pencerede print-friendly HTML
function printContactSummary(contact: any, transactions: any[]) {
  const fmtMoney = (v: number, cur: string = 'TRY') => {
    const sign = v < 0 ? '-' : ''
    const abs = Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (cur === 'TRY') return `${sign}₺${abs}`
    if (cur === 'USD') return `${sign}$${abs}`
    if (cur === 'EUR') return `${sign}€${abs}`
    return `${sign}${abs} ${cur}`
  }
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR')
  const today = new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  const invoiceLabels: Record<string, string> = {
    sales: 'Satış Faturası', purchase: 'Alış Faturası', incoming_return: 'Gelen İade',
    outgoing_return: 'Giden İade', withholding: 'Tevkifatlı', exempt: 'İstisna',
    purchase_fx: 'Alış Kur Farkı', sales_fx: 'Satış Kur Farkı',
  }

  const sorted = [...transactions].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())

  const rows = sorted.map((t: any, i: number) => {
    const isCash = t.source === 'cash'
    const isIncome = isCash && t.transaction_type === 'income'
    const isReceivable = !isCash && t.transaction_type === 'receivable'
    const amount = parseFloat(t.amount) || 0
    const cur = t.currency || 'TRY'
    // Borç/Alacak sütun değerleri
    let alacak = '', borc = ''
    if (isCash) {
      if (isIncome) borc = fmtMoney(amount, cur)
      else alacak = fmtMoney(amount, cur)
    } else {
      if (isReceivable) alacak = fmtMoney(amount, cur)
      else borc = fmtMoney(amount, cur)
    }
    const tip = isCash
      ? (isIncome ? 'Gelen Ödeme' : 'Giden Ödeme')
      : (isReceivable ? 'Alacak' : 'Borç')
    const aciklama = [
      t.description || t.reference_number || '-',
      t.invoice_type ? `<span class="tag">${invoiceLabels[t.invoice_type] || t.invoice_type}</span>` : '',
      t.invoice_category ? `<span class="tag tag-purple">${t.invoice_category}</span>` : '',
      isCash && t.payment_method ? `<span class="tag">${t.payment_method === 'cash' ? 'Nakit' : t.payment_method === 'transfer' ? 'Havale' : t.payment_method === 'check' ? 'Çek' : t.payment_method}</span>` : '',
      isCash && t.cash_account_name ? `<span class="tag tag-indigo">${t.cash_account_name}</span>` : '',
    ].filter(Boolean).join(' ')
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${fmtDate(t.transaction_date)}</td>
        <td>${aciklama}</td>
        <td><span class="tip ${isReceivable || (isCash && !isIncome) ? 'tip-green' : 'tip-red'}">${tip}</span></td>
        <td class="num green">${alacak}</td>
        <td class="num red">${borc}</td>
      </tr>
    `
  }).join('')

  const balanceRows = Object.entries(contact.balanceByCurrency || {}).map(([cur, val]: any) => {
    const v = parseFloat(val)
    if (Math.abs(v) < 0.005) return ''
    return `<div class="bal ${v >= 0 ? 'pos' : 'neg'}">${fmtMoney(v, cur)}</div>`
  }).join('') || `<div class="bal">${fmtMoney(0, 'TRY')}</div>`

  const receivableRows = Object.entries(contact.totalReceivableByCurrency || {}).map(([cur, val]: any) =>
    `<div>${fmtMoney(parseFloat(val), cur)}</div>`
  ).join('') || `<div>${fmtMoney(0, 'TRY')}</div>`

  const payableRows = Object.entries(contact.totalPayableByCurrency || {}).map(([cur, val]: any) =>
    `<div>${fmtMoney(parseFloat(val), cur)}</div>`
  ).join('') || `<div>${fmtMoney(0, 'TRY')}</div>`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Cari Hesap Özeti — ${contact.contact_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1f2937; padding: 20mm; font-size: 11pt; }
  .head { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 18px; }
  .head h1 { font-size: 22pt; font-weight: 800; }
  .head .meta { text-align: right; font-size: 9pt; color: #6b7280; }
  .info { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .card .label { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 700; }
  .card .value { font-size: 11pt; color: #1f2937; font-weight: 600; line-height: 1.5; }
  .card .small { font-size: 9pt; color: #4b5563; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .sum-box { padding: 12px; border-radius: 6px; text-align: center; }
  .sum-box .lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
  .sum-box .val { font-size: 14pt; font-weight: 800; }
  .sum-box.balance { background: #f3f4f6; }
  .sum-box.receivable { background: #ecfdf5; color: #065f46; }
  .sum-box.payable { background: #fef2f2; color: #991b1b; }
  .sum-box.count { background: #eef2ff; color: #3730a3; }
  .bal.pos { color: #15803d; }
  .bal.neg { color: #b91c1c; }
  .sum-box .bal { font-size: 13pt; font-weight: 800; line-height: 1.4; }
  h2 { font-size: 13pt; margin: 14px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead th { background: #1f2937; color: #fff; text-align: left; padding: 6px 8px; font-size: 8.5pt; font-weight: 700; }
  thead th.num { text-align: right; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  tbody td.green { color: #15803d; font-weight: 600; }
  tbody td.red { color: #b91c1c; font-weight: 600; }
  .tag { display: inline-block; background: #f3f4f6; color: #4b5563; padding: 1px 6px; border-radius: 3px; font-size: 7.5pt; margin-right: 3px; }
  .tag-purple { background: #f3e8ff; color: #6b21a8; }
  .tag-indigo { background: #e0e7ff; color: #3730a3; }
  .tip { padding: 1px 8px; border-radius: 3px; font-size: 7.5pt; font-weight: 700; }
  .tip-green { background: #dcfce7; color: #166534; }
  .tip-red { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #6b7280; display: flex; justify-content: space-between; }
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    body { padding: 0; }
    .actions { display: none !important; }
  }
  .actions { position: fixed; top: 12px; right: 12px; }
  .actions button { background: #1f2937; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 11pt; }
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">🖨 Yazdır</button></div>

<div class="head">
  <div>
    <h1>${contact.contact_name}</h1>
    <div class="meta" style="text-align: left; margin-top: 4px;">Cari Hesap Geçmişi / Özet</div>
  </div>
  <div class="meta">
    <div><b>Yazdırma:</b> ${today}</div>
    <div><b>İşlem Sayısı:</b> ${contact.transactionCount || transactions.length}</div>
  </div>
</div>

<div class="info">
  <div class="card">
    <div class="label">İletişim</div>
    <div class="value">${contact.contact_name}</div>
    <div class="small">${contact.phone || ''}${contact.phone && contact.email ? ' · ' : ''}${contact.email || ''}</div>
    ${contact.address ? `<div class="small">${contact.address}</div>` : ''}
  </div>
  <div class="card">
    <div class="label">VKN</div>
    <div class="value">${contact.tax_number || '—'}</div>
    <div class="small">${contact.tax_office || ''}</div>
  </div>
  <div class="card">
    <div class="label">Sektör</div>
    <div class="value">${contact.sector || '—'}</div>
  </div>
  <div class="card">
    <div class="label">Banka / IBAN</div>
    <div class="value" style="font-size: 9pt;">${contact.bank_name || '—'}</div>
    <div class="small" style="font-family: monospace;">${contact.iban || ''}</div>
  </div>
</div>

<div class="summary">
  <div class="sum-box balance">
    <div class="lbl">Bakiye</div>
    ${balanceRows}
  </div>
  <div class="sum-box receivable">
    <div class="lbl">Toplam Alacak</div>
    ${receivableRows}
  </div>
  <div class="sum-box payable">
    <div class="lbl">Toplam Borç</div>
    ${payableRows}
  </div>
  <div class="sum-box count">
    <div class="lbl">İşlem Sayısı</div>
    <div class="val">${contact.transactionCount || transactions.length}</div>
  </div>
</div>

<h2>İşlem Geçmişi (${transactions.length} kayıt)</h2>
${transactions.length === 0 ? '<p style="text-align:center; color:#9ca3af; padding: 20px;">Henüz işlem yok</p>' : `
<table>
  <thead>
    <tr>
      <th class="num" style="width: 28px;">#</th>
      <th style="width: 78px;">Tarih</th>
      <th>Açıklama</th>
      <th style="width: 90px;">Tip</th>
      <th class="num" style="width: 110px;">Alacak</th>
      <th class="num" style="width: 110px;">Borç</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`}

<div class="footer">
  <div>DÜNYASAN ERP — Cari Hesap Geçmişi</div>
  <div>${today}</div>
</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) { alert('Pop-up engellendi. Lütfen bu site için pop-up\'a izin verin.'); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Render bitince otomatik print dialogunu aç
  w.onload = () => { setTimeout(() => w.print(), 250) }
}

export default function CurrentAccountsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [contactTransactions, setContactTransactions] = useState<any[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [newForm, setNewForm] = useState({
    contact_name: '', phone: '', email: '', address: '', tax_number: '', tax_office: '', sector: '',
    bank_name: '', iban: '', bank_account_no: '', bank_branch: ''
  })

  // Kategori yönetimi
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  useEffect(() => { loadData(); loadCategories() }, [])

  // Para birimi sembolleri
  const currencySymbol = (c?: string | null) => {
    const k = (c || 'TRY').toUpperCase()
    return k === 'TRY' ? '₺' : k === 'USD' ? '$' : k === 'EUR' ? '€' : k === 'GBP' ? '£' : k + ' '
  }
  const fmtByCurrency = (n: number, currency?: string | null) => {
    const sym = currencySymbol(currency)
    const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    return `${sym}${formatted}`
  }

  const loadCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return
    const { data } = await supabase.from('contact_categories').select('id, name').eq('company_id', profile.company_id).order('name')
    setCategories(data || [])
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !companyId) return
    const { error } = await supabase.from('contact_categories').insert({ company_id: companyId, name: newCategoryName.trim() })
    if (error) return alert('Hata: ' + error.message)
    setNewCategoryName('')
    await loadCategories()
  }

  const handleSaveCategoryEdit = async (categoryId: string) => {
    const oldCat = categories.find(c => c.id === categoryId)
    if (!oldCat || !editingCategoryName.trim() || oldCat.name === editingCategoryName.trim()) {
      setEditingCategoryId(null)
      return
    }
    const newName = editingCategoryName.trim()
    // Kategoriyi güncelle
    const { error: catErr } = await supabase.from('contact_categories').update({ name: newName }).eq('id', categoryId)
    if (catErr) return alert('Hata: ' + catErr.message)
    // Bu sektöre sahip tüm cari hesapları güncelle
    await supabase.from('contacts').update({ sector: newName }).eq('sector', oldCat.name)
    setEditingCategoryId(null)
    setEditingCategoryName('')
    await loadCategories()
    await loadData()
  }

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const count = contacts.filter(c => c.sector === categoryName).length
    const msg = count > 0
      ? `"${categoryName}" kategorisini silmek istediğine emin misin?\n\n${count} cari hesabın sektörü boşaltılacak.`
      : `"${categoryName}" kategorisini silmek istediğine emin misin?`
    if (!confirm(msg)) return
    // Kategoriyi sil
    await supabase.from('contact_categories').delete().eq('id', categoryId)
    // İlgili contactları null yap
    if (count > 0) {
      await supabase.from('contacts').update({ sector: null }).eq('sector', categoryName)
    }
    await loadCategories()
    await loadData()
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      const cid = profile?.company_id
      if (!cid) return
      setCompanyId(cid)

      // Contacts yükle
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', cid)
        .eq('is_active', true)
        .order('contact_name')

      // Tüm cari ve kasa verilerini batch olarak çek (currency dahil — FX işlemler için)
      const [allCariRes, allCashRes] = await Promise.all([
        supabase.from('current_account_transactions').select('amount, currency, transaction_type, customer_id, supplier_id, contact_id').eq('company_id', cid),
        supabase.from('cash_transactions').select('amount, currency, transaction_type, customer_id, supplier_id, contact_id').eq('company_id', cid)
      ])

      const allCari = allCariRes.data || []
      const allCash = allCashRes.data || []

      // Her contact için bakiye hesapla — para birimi bazında ayrı tutulur (çevirim yapılmaz)
      // Mantık: Fatura toplam tutarları vs Kasa toplam ödemeleri karşılaştırılır
      // paid_amount KULLANILMAZ çünkü çift düşmeye neden olur
      const contactsWithBalance = (contactsData || []).map((contact) => {
        const isContact = (r: any) => r.customer_id === contact.id || r.supplier_id === contact.id || r.contact_id === contact.id
        const cur = (r: any) => (r.currency || 'TRY').toUpperCase()

        // Para birimi bazlı toplamlar
        const balanceByCurrency: Record<string, number> = {}
        const receivableByCurrency: Record<string, number> = {}
        const payableByCurrency: Record<string, number> = {}

        // Fatura: receivable +, payable -
        allCari.filter(isContact).forEach(r => {
          const c = cur(r)
          const amt = parseFloat(r.amount || 0)
          balanceByCurrency[c] = (balanceByCurrency[c] || 0) + (r.transaction_type === 'receivable' ? amt : -amt)
          if (r.transaction_type === 'receivable') receivableByCurrency[c] = (receivableByCurrency[c] || 0) + amt
          else payableByCurrency[c] = (payableByCurrency[c] || 0) + amt
        })

        // Kasa: income (tahsilat) -, expense (ödeme) +  (cari açısından tersi)
        allCash.filter(isContact).forEach(r => {
          const c = cur(r)
          const amt = parseFloat(r.amount || 0)
          balanceByCurrency[c] = (balanceByCurrency[c] || 0) + (r.transaction_type === 'income' ? -amt : amt)
          if (r.transaction_type === 'income') receivableByCurrency[c] = (receivableByCurrency[c] || 0) - amt
          else payableByCurrency[c] = (payableByCurrency[c] || 0) - amt
        })

        // Net alacak/borç (negatif olan tarafları sıfırla)
        const totalReceivableByCurrency: Record<string, number> = {}
        const totalPayableByCurrency: Record<string, number> = {}
        Object.keys(balanceByCurrency).forEach(c => {
          const b = balanceByCurrency[c]
          if (b > 0) totalReceivableByCurrency[c] = b
          if (b < 0) totalPayableByCurrency[c] = Math.abs(b)
        })

        // Geri uyumluluk için TL tek değerleri (filtreler ve liste tablosu hala kullanıyor)
        const balance = balanceByCurrency['TRY'] || 0
        const totalReceivable = totalReceivableByCurrency['TRY'] || 0
        const totalPayable = totalPayableByCurrency['TRY'] || 0

        const txCount = allCari.filter(isContact).length + allCash.filter(isContact).length

        return {
          ...contact,
          balance,
          totalReceivable,
          totalPayable,
          balanceByCurrency,
          totalReceivableByCurrency,
          totalPayableByCurrency,
          transactionCount: txCount
        }
      })

      setContacts(contactsWithBalance)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditContact = (contact: any) => {
    setEditingContact(contact)
    setNewForm({
      contact_name: contact.contact_name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      tax_number: contact.tax_number || '',
      tax_office: contact.tax_office || '',
      sector: contact.sector || '',
      bank_name: contact.bank_name || '',
      iban: contact.iban || '',
      bank_account_no: contact.bank_account_no || '',
      bank_branch: contact.bank_branch || '',
    })
    setShowNewModal(true)
  }

  const handleDeleteContact = async (contact: any) => {
    if (!confirm(`"${contact.contact_name}" cari hesabını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.`)) return
    try {
      const { error } = await supabase.from('contacts').update({ is_active: false }).eq('id', contact.id)
      if (error) throw error
      alert('Cari hesap silindi!')
      loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const openContactDetail = async (contact: any) => {
    setSelectedContact(contact)
    if (!companyId) return

    // Cari kayıtları (faturalar)
    const { data: cariData } = await supabase
      .from('current_account_transactions')
      .select('*')
      .eq('company_id', companyId)
      .or(`customer_id.eq.${contact.id},supplier_id.eq.${contact.id},contact_id.eq.${contact.id}`)
      .order('transaction_date', { ascending: false })

    // Fatura bilgilerini reference_number üzerinden eşleştir
    const refNumbers = (cariData || []).map(t => t.reference_number).filter(Boolean)
    let invoiceMap: Record<string, any> = {}
    if (refNumbers.length > 0) {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, invoice_type, category, document_url')
        .eq('company_id', companyId)
        .in('invoice_number', refNumbers)
      if (invoices) {
        invoices.forEach(inv => { invoiceMap[inv.invoice_number] = inv })
      }
    }

    // Kasa işlemlerini (gelen/giden ödemeler)
    const { data: cashData } = await supabase
      .from('cash_transactions')
      .select('*, cash_account:cash_accounts(account_name)')
      .eq('company_id', companyId)
      .or(`customer_id.eq.${contact.id},supplier_id.eq.${contact.id},contact_id.eq.${contact.id}`)
      .order('transaction_date', { ascending: false })

    // Birleştir
    const cariItems = (cariData || []).map(t => {
      const inv = invoiceMap[t.reference_number] || null
      return {
        ...t,
        source: 'cari' as const,
        invoice_type: inv?.invoice_type || null,
        invoice_category: inv?.category || null,
        document_url: inv?.document_url || null,
      }
    })

    const cashItems = (cashData || []).map(t => ({
      id: t.id,
      amount: t.amount,
      transaction_type: t.transaction_type,
      transaction_date: t.transaction_date,
      description: t.description,
      reference_number: t.reference_number,
      paid_amount: null,
      status: null,
      currency: t.currency || 'TRY',
      source: 'cash' as const,
      payment_method: t.payment_method,
      cash_account_name: (t as any).cash_account?.account_name || null,
      invoice_type: null,
      invoice_category: null,
    }))

    const all = [...cariItems, ...cashItems].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    setContactTransactions(all)
  }

  // Sektöre göre gruplandırma
  const groups = Array.from(new Set(contacts.map(c => c.sector || 'Diğer').filter(Boolean))).sort()

  // Banka listesi (mevcutlardan + ön tanımlılar)
  const usedBanks = Array.from(new Set(contacts.map(c => c.bank_name).filter(Boolean))).sort()

  const filtered = contacts.filter(c => {
    const matchSearch = searchQuery === '' || c.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchBalance = balanceFilter === 'all' ||
      (balanceFilter === 'positive' && c.balance > 0) ||
      (balanceFilter === 'negative' && c.balance < 0)
    const matchGroup = groupFilter === 'all' || (c.sector || 'Diğer') === groupFilter
    const matchBank = bankFilter === 'all' ||
      (bankFilter === 'none' && !c.bank_name) ||
      (c.bank_name === bankFilter)
    return matchSearch && matchBalance && matchGroup && matchBank
  })

  // Para birimi bazında toplamlar (TL conversion yok)
  const receivablesByCurrency: Record<string, number> = {}
  const payablesByCurrency: Record<string, number> = {}
  const netByCurrency: Record<string, number> = {}
  contacts.forEach(c => {
    const bbc = c.balanceByCurrency || {}
    Object.entries(bbc).forEach(([cur, v]: any) => {
      const num = parseFloat(v)
      netByCurrency[cur] = (netByCurrency[cur] || 0) + num
      if (num > 0) receivablesByCurrency[cur] = (receivablesByCurrency[cur] || 0) + num
      else if (num < 0) payablesByCurrency[cur] = (payablesByCurrency[cur] || 0) + Math.abs(num)
    })
  })

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' TL'

  // DF66 — Müşteri Listesi Yazdır
  const printCustomerList = () => {
    const win = window.open('', '_blank', 'width=1200,height=800')
    if (!win) return
    const today = new Date().toLocaleDateString('tr-TR')
    const rows = filtered.map((c, i) => `
      <tr>
        <td class="ord">${i + 1}</td>
        <td>${c.contact_name || '-'}</td>
        <td>${c.sector || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td>${c.tax_number || '-'}<div class="meta">${c.tax_office || ''}</div></td>
        <td>${c.address || '-'}</td>
        <td class="num">${c.balance >= 0 ? '+' : ''}${(c.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Müşteri Listesi - DF66</title>
    <style>
      @page { size: A4 landscape; margin: 1cm; }
      *{box-sizing:border-box}
      body{font-family:'Helvetica',Arial,sans-serif;color:#111;margin:0;padding:0;font-size:10px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:14px}
      .header h1{margin:0 0 4px 0;font-size:22px;color:#1e40af}
      .header .subtitle{font-size:12px;color:#555}
      .header .meta{text-align:right;font-size:10px;color:#555;line-height:1.5}
      .doc-no{display:inline-block;padding:3px 10px;background:#fef3c7;color:#b45309;font-weight:700;border-radius:4px;font-size:11px}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
      .summary-box{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;background:#f9fafb}
      .summary-box .label{font-size:9px;color:#555;text-transform:uppercase}
      .summary-box .value{font-size:14px;font-weight:700;color:#111;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:9.5px}
      thead{background:#1e40af;color:white}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}
      .ord{text-align:center;width:28px;font-weight:700;background:#f1f5f9}
      .num{text-align:right;font-weight:700}
      .meta{font-size:8.5px;color:#777;margin-top:1px}
      tbody tr:nth-child(even){background:#f8fafc}
      .sign-block{display:flex;gap:30px;margin-top:30px;justify-content:space-around}
      .sign-col{text-align:center;flex:1;max-width:200px}
      .sign-line{border-top:1px solid #333;margin-top:50px;padding-top:4px;font-size:9px}
      .footer{margin-top:24px;font-size:9px;color:#555;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:6px}
    </style></head><body>
    <div class="header"><div>
      <h1>DÜNYASAN — MÜŞTERİ LİSTESİ</h1>
      <div class="subtitle">Cari Hesaplar — Müşteri ve Tedarikçi Kayıtları</div>
      <div style="margin-top:6px"><span class="doc-no">Doküman No: DF66</span></div>
    </div><div class="meta">
      <div><b>Çıktı Tarihi:</b> ${today}</div>
      <div><b>Toplam Kayıt:</b> ${filtered.length}</div>
    </div></div>
    <div class="summary">
      <div class="summary-box"><div class="label">Toplam Cari</div><div class="value">${filtered.length}</div></div>
      <div class="summary-box"><div class="label">Alacaklı (Bakiye +)</div><div class="value">${filtered.filter(c => c.balance > 0).length}</div></div>
      <div class="summary-box"><div class="label">Borçlu (Bakiye -)</div><div class="value">${filtered.filter(c => c.balance < 0).length}</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Müşteri / Firma</th><th>Sektör</th><th>Telefon</th><th>E-posta</th>
      <th>VKN / Vergi Dairesi</th><th>Adres</th><th>Bakiye (₺)</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">Kayıt yok</td></tr>'}</tbody></table>
    <div class="sign-block">
      <div class="sign-col"><div class="sign-line">Hazırlayan</div></div>
      <div class="sign-col"><div class="sign-line">Mali İşler</div></div>
      <div class="sign-col"><div class="sign-line">Onaylayan</div></div>
    </div>
    <div class="footer"><div>Bu liste ${today} tarihinde sistemden otomatik oluşturulmuştur.</div><div>DF66 · v1.0</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`)
    win.document.close()
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cari Hesaplar</h2>
          <p className="text-gray-600">{contacts.length} cari hesap</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={printCustomerList} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg font-semibold">
            <Search className="w-4 h-4" /> Müşteri Listesi (DF66)
          </button>
          <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-semibold">
            <Tag className="w-4 h-4" /> Kategoriler
          </button>
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold">
            <Plus className="w-4 h-4" /> Yeni Cari
          </button>
        </div>
      </div>

      {/* Kategori Yönetim Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowCategoryModal(false); setEditingCategoryId(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-600" /> Sektör / Kategori Yönetimi
              </h3>
              <button onClick={() => setShowCategoryModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Yeni kategori ekle */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <label className="block text-xs font-semibold text-purple-700 mb-2">Yeni Kategori Ekle</label>
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                  placeholder="Örn: KESİCİ TAKIM, HAMMADDE..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold"
                >
                  Ekle
                </button>
              </div>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              {categories.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">Henüz kategori yok</p>
              ) : (
                <div className="space-y-1">
                  {categories.map(cat => {
                    const count = contacts.filter(c => c.sector === cat.name).length
                    const isEditing = editingCategoryId === cat.id
                    return (
                      <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                        {isEditing ? (
                          <>
                            <input
                              value={editingCategoryName}
                              onChange={e => setEditingCategoryName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveCategoryEdit(cat.id) }}
                              autoFocus
                              className="flex-1 px-3 py-1.5 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-300"
                            />
                            <button onClick={() => handleSaveCategoryEdit(cat.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Kaydet">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setEditingCategoryId(null); setEditingCategoryName('') }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="İptal">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full">{count} cari</span>
                            <button
                              onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Adı değiştir"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
              💡 Kategori adını değiştirdiğinde o sektörü kullanan tüm cari hesaplar otomatik güncellenir.
            </div>
          </div>
        </div>
      )}

      {/* Yeni Cari Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowNewModal(false); setEditingContact(null); setNewForm({ contact_name: '', phone: '', email: '', address: '', tax_number: '', tax_office: '', sector: '', bank_name: '', iban: '', bank_account_no: '', bank_branch: '' }) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">{editingContact ? 'Cari Hesap Düzenle' : 'Yeni Cari Hesap'}</h3>
              <button onClick={() => setShowNewModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              {/* Temel Bilgiler */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-2 pb-1 border-b border-gray-200">Temel Bilgiler</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma / Kişi Adı *</label>
                    <input value={newForm.contact_name} onChange={e => setNewForm({...newForm, contact_name: e.target.value})} placeholder="Firma veya kişi adı" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                      <input value={newForm.phone} onChange={e => setNewForm({...newForm, phone: e.target.value})} placeholder="0532..." className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                      <input value={newForm.email} onChange={e => setNewForm({...newForm, email: e.target.value})} placeholder="info@..." className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                    <input value={newForm.address} onChange={e => setNewForm({...newForm, address: e.target.value})} placeholder="Adres" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vergi No</label>
                      <input value={newForm.tax_number} onChange={e => setNewForm({...newForm, tax_number: e.target.value})} placeholder="VKN" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Dairesi</label>
                      <input value={newForm.tax_office} onChange={e => setNewForm({...newForm, tax_office: e.target.value})} placeholder="Örn: Kadıköy" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sektör / Kategori
                        <button type="button" onClick={() => setShowCategoryModal(true)} className="ml-2 text-xs text-blue-600 hover:underline">+ Yönet</button>
                      </label>
                      <select value={newForm.sector} onChange={e => setNewForm({...newForm, sector: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white">
                        <option value="">Seçiniz...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banka Bilgileri */}
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-2 pb-1 border-b border-gray-200">🏦 Banka Bilgileri</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banka</label>
                      <select value={newForm.bank_name} onChange={e => setNewForm({...newForm, bank_name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white">
                        <option value="">Seçiniz...</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        {usedBanks.filter(b => !BANKS.includes(b)).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Şube</label>
                      <input value={newForm.bank_branch} onChange={e => setNewForm({...newForm, bank_branch: e.target.value})} placeholder="Örn: Ankara Şubesi" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                    <input value={newForm.iban} onChange={e => setNewForm({...newForm, iban: e.target.value.toUpperCase()})} placeholder="TR..." maxLength={32} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hesap No (opsiyonel)</label>
                    <input value={newForm.bank_account_no} onChange={e => setNewForm({...newForm, bank_account_no: e.target.value})} placeholder="Hesap numarası" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!newForm.contact_name || !companyId) return alert('Firma/kişi adı zorunludur!')
                  const payload = {
                    contact_name: newForm.contact_name,
                    phone: newForm.phone || null, email: newForm.email || null,
                    address: newForm.address || null, tax_number: newForm.tax_number || null,
                    tax_office: newForm.tax_office || null,
                    sector: newForm.sector || null,
                    bank_name: newForm.bank_name || null,
                    iban: newForm.iban || null,
                    bank_account_no: newForm.bank_account_no || null,
                    bank_branch: newForm.bank_branch || null,
                  }
                  if (editingContact) {
                    const { error } = await supabase.from('contacts').update(payload).eq('id', editingContact.id)
                    if (error) return alert('Hata: ' + error.message)
                    alert('Cari hesap güncellendi!')
                  } else {
                    const { error } = await supabase.from('contacts').insert({ ...payload, company_id: companyId, is_active: true })
                    if (error) return alert('Hata: ' + error.message)
                    alert('Cari hesap eklendi!')
                  }
                  setShowNewModal(false)
                  setEditingContact(null)
                  setNewForm({ contact_name: '', phone: '', email: '', address: '', tax_number: '', tax_office: '', sector: '', bank_name: '', iban: '', bank_account_no: '', bank_branch: '' })
                  loadData()
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
              >
                {editingContact ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartlar — para birimi bazında */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm">Toplam Alacak</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          {Object.keys(receivablesByCurrency).length === 0 ? (
            <div className="text-3xl font-bold">₺0,00</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(receivablesByCurrency).map(([cur, val]) => (
                <div key={cur} className="text-2xl font-bold">{fmtByCurrency(val, cur)}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm">Toplam Borç</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          {Object.keys(payablesByCurrency).length === 0 ? (
            <div className="text-3xl font-bold">₺0,00</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(payablesByCurrency).map(([cur, val]) => (
                <div key={cur} className="text-2xl font-bold">{fmtByCurrency(val, cur)}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm opacity-90">Net Bakiye</span>
            <DollarSign className="w-5 h-5 opacity-90" />
          </div>
          {Object.keys(netByCurrency).filter(c => Math.abs(netByCurrency[c]) >= 0.005).length === 0 ? (
            <div className="text-3xl font-bold">₺0,00</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(netByCurrency).map(([cur, val]) => {
                if (Math.abs(val) < 0.005) return null
                return (
                  <div key={cur} className="text-2xl font-bold">
                    {fmtByCurrency(val, cur)} <span className="text-xs font-normal opacity-80">{val >= 0 ? '(alacak)' : '(borç)'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Seçili Cari Detay */}
      {selectedContact ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button onClick={() => setSelectedContact(null)} className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800">
              <ArrowLeft className="w-4 h-4" /> Listeye Dön
            </button>
            <button
              onClick={() => printContactSummary(selectedContact, contactTransactions)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
            >
              <Printer className="w-4 h-4" /> Geçmişi Yazdır
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedContact.contact_name}</h3>
                <div className="flex gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                  {selectedContact.phone && <span>{selectedContact.phone}</span>}
                  {selectedContact.email && <span>{selectedContact.email}</span>}
                  {selectedContact.tax_number && <span>VKN: {selectedContact.tax_number}</span>}
                  {selectedContact.tax_office && <span>Vergi Dairesi: {selectedContact.tax_office}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Bakiye</p>
                <div className="flex flex-col items-end gap-0.5">
                  {Object.keys(selectedContact.balanceByCurrency || {}).length === 0 ? (
                    <span className="text-2xl font-bold text-gray-400">₺0,00</span>
                  ) : (
                    Object.entries(selectedContact.balanceByCurrency).map(([c, bal]: any) => {
                      const v = parseFloat(bal)
                      if (Math.abs(v) < 0.005) return null
                      return (
                        <span key={c} className={`text-xl font-bold ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {fmtByCurrency(v, c)}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-700 mb-1">Toplam Alacak</p>
                {Object.keys(selectedContact.totalReceivableByCurrency || {}).length === 0 ? (
                  <p className="text-lg font-bold text-green-800">₺0,00</p>
                ) : (
                  Object.entries(selectedContact.totalReceivableByCurrency).map(([c, val]: any) => (
                    <p key={c} className="text-base font-bold text-green-800">{fmtByCurrency(parseFloat(val), c)}</p>
                  ))
                )}
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-700 mb-1">Toplam Borç</p>
                {Object.keys(selectedContact.totalPayableByCurrency || {}).length === 0 ? (
                  <p className="text-lg font-bold text-red-800">₺0,00</p>
                ) : (
                  Object.entries(selectedContact.totalPayableByCurrency).map(([c, val]: any) => (
                    <p key={c} className="text-base font-bold text-red-800">{fmtByCurrency(parseFloat(val), c)}</p>
                  ))
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-700">İşlem Sayısı</p>
                <p className="text-lg font-bold text-gray-800">{selectedContact.transactionCount}</p>
              </div>
            </div>
          </div>

          {/* İşlem Geçmişi */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="p-5 border-b"><h3 className="font-bold text-gray-800">İşlem Geçmişi</h3></div>
            <div className="p-5">
              {contactTransactions.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Henüz işlem yok</p>
              ) : (
                <div className="space-y-2">
                  {contactTransactions.map((t: any) => {
                    const isCash = t.source === 'cash'
                    const isIncome = isCash && t.transaction_type === 'income'
                    const invoiceLabels: Record<string, string> = {
                      sales: 'Satış Faturası', purchase: 'Alış Faturası', incoming_return: 'Gelen İade',
                      outgoing_return: 'Giden İade', withholding: 'Tevkifatlı', exempt: 'İstisna',
                      purchase_fx: 'Alış Kur Farkı', sales_fx: 'Satış Kur Farkı',
                    }
                    return (
                      <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg text-sm ${isCash ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${isIncome ? 'bg-red-500' : isCash ? 'bg-green-500' : t.transaction_type === 'receivable' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div>
                            <p className="font-semibold text-gray-800">{t.description || t.reference_number || '-'}</p>
                            {t.description && t.reference_number && t.description !== t.reference_number && (
                              <p className="text-xs text-gray-400">{t.reference_number}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {isCash ? (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isIncome ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {isIncome ? 'Gelen Ödeme' : 'Giden Ödeme'}
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.transaction_type === 'receivable' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {t.transaction_type === 'receivable' ? 'Alacak' : 'Borç'}
                                </span>
                              )}
                              {t.invoice_type && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-700">{invoiceLabels[t.invoice_type] || t.invoice_type}</span>}
                              {t.invoice_category && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">{t.invoice_category}</span>}
                              {isCash && t.payment_method && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-600">{t.payment_method === 'cash' ? 'Nakit' : t.payment_method === 'transfer' ? 'Havale' : t.payment_method === 'check' ? 'Çek' : t.payment_method}</span>}
                              {isCash && t.cash_account_name && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700">{t.cash_account_name}</span>}
                              {!isCash && t.status === 'paid' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">Kapatıldı</span>}
                              {!isCash && t.status === 'partial' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700">Kısmi Ödeme</span>}
                              {t.document_url && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const { data } = await supabase.storage.from('accounting-documents').createSignedUrl(t.document_url, 3600)
                                    if (data?.signedUrl) {
                                      window.open(data.signedUrl, '_blank')
                                    } else {
                                      const { data: pub } = supabase.storage.from('accounting-documents').getPublicUrl(t.document_url)
                                      if (pub?.publicUrl) window.open(pub.publicUrl, '_blank')
                                      else alert('Dosya açılamadı')
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] font-semibold rounded-md hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                                  Belge
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            isCash
                              ? (isIncome ? 'text-red-600' : 'text-green-600')
                              : (t.transaction_type === 'receivable' ? 'text-green-600' : 'text-red-600')
                          }`}>
                            {isCash
                              ? (isIncome ? '-' : '+')
                              : (t.transaction_type === 'receivable' ? '+' : '-')
                            }
                            {t.currency && t.currency !== 'TRY'
                              ? `${parseFloat(t.amount).toLocaleString('tr-TR', {minimumFractionDigits: 2})} ${t.currency}`
                              : fmt(parseFloat(t.amount))
                            }
                          </p>
                          {!isCash && parseFloat(t.paid_amount || 0) > 0 && (
                            <p className="text-[10px] text-gray-500">Kalan: {fmt(parseFloat(t.amount) - parseFloat(t.paid_amount || 0))}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grup Butonları */}
          {groups.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-600 mr-2">Sektör:</span>
                <button
                  onClick={() => setGroupFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${groupFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Tümü ({contacts.length})
                </button>
                {groups.map(g => {
                  const count = contacts.filter(c => (c.sector || 'Diğer') === g).length
                  const groupBalance = contacts.filter(c => (c.sector || 'Diğer') === g).reduce((s, c) => s + c.balance, 0)
                  return (
                    <button
                      key={g}
                      onClick={() => setGroupFilter(groupFilter === g ? 'all' : g)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${groupFilter === g ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {g} ({count})
                      <span className={`ml-1 text-xs ${groupFilter === g ? 'text-blue-200' : groupBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {groupBalance >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(groupBalance)}₺
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filtreler */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari hesap ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tüm Bakiyeler</option>
                <option value="positive">Alacaklı (+)</option>
                <option value="negative">Borçlu (-)</option>
              </select>
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tüm Bankalar</option>
                <option value="none">— Bankası Yok —</option>
                {usedBanks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {filtered.length} / {contacts.length} cari gösteriliyor
              {groupFilter !== 'all' && <span className="ml-1 text-blue-600 font-semibold">• Sektör: {groupFilter}</span>}
              {bankFilter !== 'all' && <span className="ml-1 text-purple-600 font-semibold">• Banka: {bankFilter === 'none' ? 'Yok' : bankFilter}</span>}
            </p>
          </div>

          {/* Cari Hesap Listesi */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Cari Hesap</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Alacak</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Borç</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Bakiye</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Detay</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openContactDetail(c)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900">{c.contact_name}</p>
                          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                      {Object.keys(c.totalReceivableByCurrency || {}).length === 0 ? '-' : (
                        <div className="flex flex-col items-end gap-0.5">
                          {Object.entries(c.totalReceivableByCurrency).map(([cur, val]: any) => (
                            <span key={cur}>{fmtByCurrency(parseFloat(val), cur)}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                      {Object.keys(c.totalPayableByCurrency || {}).length === 0 ? '-' : (
                        <div className="flex flex-col items-end gap-0.5">
                          {Object.entries(c.totalPayableByCurrency).map(([cur, val]: any) => (
                            <span key={cur}>{fmtByCurrency(parseFloat(val), cur)}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {Object.keys(c.balanceByCurrency || {}).length === 0 ? (
                        <span className="text-gray-500 font-bold">₺0,00</span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          {Object.entries(c.balanceByCurrency).map(([cur, bal]: any) => {
                            const v = parseFloat(bal)
                            if (Math.abs(v) < 0.005) return null
                            return (
                              <span key={cur} className={`font-bold ${v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {fmtByCurrency(v, cur)}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">{c.transactionCount}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEditContact(c)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="Düzenle">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteContact(c)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Sil">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-center text-gray-400 py-12">Cari hesap bulunamadı</p>}
          </div>
        </>
      )}
    </div>
  )
}

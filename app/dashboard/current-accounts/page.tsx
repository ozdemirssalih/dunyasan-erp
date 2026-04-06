'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, DollarSign, Eye, ArrowLeft, Search, Plus, X } from 'lucide-react'

export default function CurrentAccountsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [contactTransactions, setContactTransactions] = useState<any[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ contact_name: '', phone: '', email: '', address: '', tax_number: '', tax_office: '' })

  useEffect(() => { loadData() }, [])

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

      // Tüm cari ve kasa verilerini batch olarak çek
      const [allCariRes, allCashRes] = await Promise.all([
        supabase.from('current_account_transactions').select('amount, transaction_type, customer_id, supplier_id, contact_id').eq('company_id', cid),
        supabase.from('cash_transactions').select('amount, transaction_type, customer_id, supplier_id, contact_id').eq('company_id', cid)
      ])

      const allCari = allCariRes.data || []
      const allCash = allCashRes.data || []

      // Her contact için bakiye hesapla
      // Mantık: Fatura TOPLAM tutarları vs Kasa TOPLAM ödemeleri karşılaştırılır
      // paid_amount KULLANILMAZ çünkü çift düşmeye neden olur
      const contactsWithBalance = (contactsData || []).map((contact) => {
        const isContact = (r: any) => r.customer_id === contact.id || r.supplier_id === contact.id || r.contact_id === contact.id

        // Fatura tutarları (ham amount, paid_amount kullanılmaz)
        const totalReceivableInvoice = allCari.filter(r => isContact(r) && r.transaction_type === 'receivable')
          .reduce((s, r) => s + parseFloat(r.amount || 0), 0)
        const totalPayableInvoice = allCari.filter(r => isContact(r) && r.transaction_type === 'payable')
          .reduce((s, r) => s + parseFloat(r.amount || 0), 0)

        // Kasa ödemeleri
        const totalCashIncome = allCash.filter(r => isContact(r) && r.transaction_type === 'income')
          .reduce((s, r) => s + parseFloat(r.amount || 0), 0)
        const totalCashExpense = allCash.filter(r => isContact(r) && r.transaction_type === 'expense')
          .reduce((s, r) => s + parseFloat(r.amount || 0), 0)

        // Net alacak = fatura alacağı - gelen tahsilat (kalan alacak, negatifse fazla tahsilat)
        const netReceivable = totalReceivableInvoice - totalCashIncome
        // Net borç = fatura borcu - giden ödeme (kalan borç, negatifse fazla ödeme yaptık = alacaklıyız)
        const netPayable = totalPayableInvoice - totalCashExpense

        // Bakiye: pozitif = bize borçlu, negatif = biz borçluyuz
        // netReceivable pozitif = müşteri bize borçlu, netPayable pozitif = biz tedarikçiye borçluyuz
        const balance = netReceivable - netPayable

        const totalReceivable = Math.max(netReceivable, 0)
        const totalPayable = Math.max(netPayable, 0)
        // Fazla ödeme durumları
        const excessReceivable = netPayable < 0 ? Math.abs(netPayable) : 0  // Biz fazla ödedik = alacaklıyız
        const excessPayable = netReceivable < 0 ? Math.abs(netReceivable) : 0  // Fazla tahsilat = biz borçluyuz

        const txCount = allCari.filter(r => isContact(r)).length + allCash.filter(r => isContact(r)).length

        return {
          ...contact,
          balance: balance,
          totalReceivable: totalReceivable + excessReceivable,
          totalPayable: totalPayable + excessPayable,
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
        .select('invoice_number, invoice_type, category')
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
      source: 'cash' as const,
      payment_method: t.payment_method,
      cash_account_name: (t as any).cash_account?.account_name || null,
      invoice_type: null,
      invoice_category: null,
    }))

    const all = [...cariItems, ...cashItems].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    setContactTransactions(all)
  }

  const filtered = contacts.filter(c => {
    const matchSearch = searchQuery === '' || c.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchBalance = balanceFilter === 'all' ||
      (balanceFilter === 'positive' && c.balance > 0) ||
      (balanceFilter === 'negative' && c.balance < 0)
    return matchSearch && matchBalance
  })

  const totalReceivables = contacts.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)
  const totalPayables = contacts.reduce((s, c) => s + (c.balance < 0 ? Math.abs(c.balance) : 0), 0)
  const netBalance = contacts.reduce((s, c) => s + c.balance, 0)

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' TL'

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cari Hesaplar</h2>
          <p className="text-gray-600">{contacts.length} cari hesap</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold">
          <Plus className="w-4 h-4" /> Yeni Cari
        </button>
      </div>

      {/* Yeni Cari Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Yeni Cari Hesap</h3>
              <button onClick={() => setShowNewModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
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
                  <input value={newForm.tax_office} onChange={e => setNewForm({...newForm, tax_office: e.target.value})} placeholder="Vergi dairesi" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!newForm.contact_name || !companyId) return alert('Firma/kişi adı zorunludur!')
                  const { error } = await supabase.from('contacts').insert({
                    company_id: companyId, contact_name: newForm.contact_name,
                    phone: newForm.phone || null, email: newForm.email || null,
                    address: newForm.address || null, tax_number: newForm.tax_number || null,
                    tax_office: newForm.tax_office || null, is_active: true
                  })
                  if (error) return alert('Hata: ' + error.message)
                  alert('Cari hesap eklendi!')
                  setShowNewModal(false)
                  setNewForm({ contact_name: '', phone: '', email: '', address: '', tax_number: '', tax_office: '' })
                  loadData()
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm">Toplam Alacak</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          <div className="text-3xl font-bold">{fmt(totalReceivables)}</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm">Toplam Borç</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <div className="text-3xl font-bold">{fmt(totalPayables)}</div>
        </div>

        <div className={`bg-gradient-to-br ${netBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm opacity-90">Net Bakiye</span>
            <DollarSign className="w-5 h-5 opacity-90" />
          </div>
          <div className="text-3xl font-bold">{fmt(netBalance)}</div>
          <p className="text-white text-xs mt-2 opacity-90">{netBalance >= 0 ? 'Alacak fazlası' : 'Borç fazlası'}</p>
        </div>
      </div>

      {/* Seçili Cari Detay */}
      {selectedContact ? (
        <div className="space-y-4">
          <button onClick={() => setSelectedContact(null)} className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800">
            <ArrowLeft className="w-4 h-4" /> Listeye Dön
          </button>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedContact.contact_name}</h3>
                <div className="flex gap-4 text-sm text-gray-500 mt-1">
                  {selectedContact.phone && <span>{selectedContact.phone}</span>}
                  {selectedContact.email && <span>{selectedContact.email}</span>}
                  {selectedContact.tax_number && <span>VKN: {selectedContact.tax_number}</span>}
                </div>
              </div>
              <div className={`text-3xl font-bold ${selectedContact.balance > 0 ? 'text-green-600' : selectedContact.balance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {fmt(selectedContact.balance)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-700">Toplam Alacak</p>
                <p className="text-lg font-bold text-green-800">{fmt(selectedContact.totalReceivable)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-red-700">Toplam Borç</p>
                <p className="text-lg font-bold text-red-800">{fmt(selectedContact.totalPayable)}</p>
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
                          <div className={`w-2 h-8 rounded-full ${isIncome ? 'bg-blue-500' : isCash ? 'bg-orange-500' : t.transaction_type === 'receivable' ? 'bg-green-500' : 'bg-red-500'}`}></div>
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
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${isIncome ? 'text-blue-600' : isCash ? 'text-orange-600' : t.transaction_type === 'receivable' ? 'text-green-600' : 'text-red-600'}`}>
                            {(isIncome || t.transaction_type === 'receivable') ? '+' : '-'}{fmt(parseFloat(t.amount))}
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
          {/* Filtreler */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
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
            </div>
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
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">{c.totalReceivable > 0 ? fmt(c.totalReceivable) : '-'}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-red-600">{c.totalPayable > 0 ? fmt(c.totalPayable) : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${c.balance > 0 ? 'text-green-600' : c.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {fmt(c.balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">{c.transactionCount}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
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

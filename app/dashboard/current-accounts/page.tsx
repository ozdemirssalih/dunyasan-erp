'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, DollarSign, Eye, ArrowLeft, Search } from 'lucide-react'

export default function CurrentAccountsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [contactTransactions, setContactTransactions] = useState<any[]>([])

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

      // Her contact için bakiye hesapla
      const contactsWithBalance = await Promise.all((contactsData || []).map(async (contact) => {
        // Alacak kayıtları (amount - paid_amount = kalan alacak)
        const { data: receivables } = await supabase
          .from('current_account_transactions')
          .select('amount, paid_amount')
          .eq('company_id', cid)
          .eq('transaction_type', 'receivable')
          .or(`customer_id.eq.${contact.id},supplier_id.eq.${contact.id},contact_id.eq.${contact.id}`)

        // Borç kayıtları (amount - paid_amount = kalan borç)
        const { data: payables } = await supabase
          .from('current_account_transactions')
          .select('amount, paid_amount')
          .eq('company_id', cid)
          .eq('transaction_type', 'payable')
          .or(`customer_id.eq.${contact.id},supplier_id.eq.${contact.id},contact_id.eq.${contact.id}`)

        // Kalan alacak = toplam fatura tutarı - ödenen kısım
        const totalReceivable = receivables?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
        // Kalan borç = toplam fatura tutarı - ödenen kısım
        const totalPayable = payables?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
        const balance = totalReceivable - totalPayable

        return { ...contact, balance, totalReceivable, totalPayable, transactionCount: (receivables?.length || 0) + (payables?.length || 0) }
      }))

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
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Cari Hesaplar</h2>
        <p className="text-gray-600">{contacts.length} cari hesap</p>
      </div>

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

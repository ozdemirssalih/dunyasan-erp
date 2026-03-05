'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, Plus, Eye, DollarSign, Calendar, AlertCircle, FileDown } from 'lucide-react'

interface Account {
  id: string
  type: 'customer' | 'supplier'
  name: string
  totalReceivable: number // Toplam alacak (ödenecek)
  totalPayable: number // Toplam borç (ödenecek)
  currency: string
  balancesByCurrency: Record<string, { receivable: number, payable: number }> // Para birimi bazında bakiyeler
  lastTransactionDate?: string
  transactionCount: number
  overdueCount: number // Vadesi geçmiş işlem sayısı
}

interface AccountTransaction {
  id: string
  transaction_type: 'receivable' | 'payable'
  amount: number
  paid_amount: number
  currency: string
  status: 'unpaid' | 'partial' | 'paid'
  transaction_date: string
  due_date: string
  description: string
  reference_number: string
  customer_id?: string
  supplier_id?: string
}

export default function CurrentAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filters
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'receivable' | 'payable'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedAccountTransactions, setSelectedAccountTransactions] = useState<AccountTransaction[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)

      await loadAccounts(fetchedCompanyId)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (companyId: string) => {
    try {
      // Müşterileri yükle
      const { data: customers } = await supabase
        .from('customer_companies')
        .select('id, customer_name')
        .eq('company_id', companyId)

      // Tedarikçileri yükle
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', companyId)
        .eq('is_active', true)

      // Tüm cari işlemleri yükle
      const { data: allTransactions } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)

      // Tüm kasa işlemlerini yükle
      const { data: allCashTransactions } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('company_id', companyId)

      const accountsData: Account[] = []
      const today = new Date()

      // Müşterileri işle
      customers?.forEach(customer => {
        const customerTxs = allTransactions?.filter(t => t.customer_id === customer.id) || []
        const customerCashTxs = allCashTransactions?.filter(t => t.customer_id === customer.id) || []

        // Para birimi bazında bakiyeleri hesapla
        const balancesByCurrency: Record<string, { receivable: number, payable: number }> = {}

        customerTxs
          .filter(t => t.transaction_type === 'receivable' && t.status !== 'paid')
          .forEach(tx => {
            const currency = tx.currency || 'TRY'
            const remaining = parseFloat(tx.amount) - parseFloat(tx.paid_amount || 0)

            if (!balancesByCurrency[currency]) {
              balancesByCurrency[currency] = { receivable: 0, payable: 0 }
            }
            balancesByCurrency[currency].receivable += remaining
          })

        // Toplam alacak (TRY bazlı - backward compatibility için)
        const totalReceivable = Object.values(balancesByCurrency)
          .reduce((sum, b) => sum + b.receivable, 0)

        // Vadesi geçmiş işlem sayısı
        const overdueCount = customerTxs.filter(t =>
          t.status !== 'paid' &&
          new Date(t.due_date) < today
        ).length

        // Tüm işlemleri birleştir (cari + kasa) ve sırala
        const allCustomerTxs = [
          ...customerTxs.map(tx => ({ ...tx, transaction_date: tx.transaction_date })),
          ...customerCashTxs.map(tx => ({ ...tx, transaction_date: tx.transaction_date }))
        ].sort((a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )

        // Para birimini en son işlemden al, yoksa TRY
        const mainCurrency = allCustomerTxs[0]?.currency || 'TRY'

        accountsData.push({
          id: customer.id,
          type: 'customer',
          name: customer.customer_name,
          totalReceivable,
          totalPayable: 0,
          currency: mainCurrency,
          balancesByCurrency,
          lastTransactionDate: allCustomerTxs[0]?.transaction_date,
          transactionCount: customerTxs.length + customerCashTxs.length, // Hem cari hem kasa işlemleri
          overdueCount
        })
      })

      // Tedarikçileri işle
      suppliers?.forEach(supplier => {
        const supplierTxs = allTransactions?.filter(t => t.supplier_id === supplier.id) || []
        const supplierCashTxs = allCashTransactions?.filter(t => t.supplier_id === supplier.id) || []

        // Para birimi bazında bakiyeleri hesapla
        const balancesByCurrency: Record<string, { receivable: number, payable: number }> = {}

        supplierTxs
          .filter(t => t.transaction_type === 'payable' && t.status !== 'paid')
          .forEach(tx => {
            const currency = tx.currency || 'TRY'
            const remaining = parseFloat(tx.amount) - parseFloat(tx.paid_amount || 0)

            if (!balancesByCurrency[currency]) {
              balancesByCurrency[currency] = { receivable: 0, payable: 0 }
            }
            balancesByCurrency[currency].payable += remaining
          })

        // Toplam borç (TRY bazlı - backward compatibility için)
        const totalPayable = Object.values(balancesByCurrency)
          .reduce((sum, b) => sum + b.payable, 0)

        // Vadesi geçmiş işlem sayısı
        const overdueCount = supplierTxs.filter(t =>
          t.status !== 'paid' &&
          new Date(t.due_date) < today
        ).length

        // Tüm işlemleri birleştir (cari + kasa) ve sırala
        const allSupplierTxs = [
          ...supplierTxs.map(tx => ({ ...tx, transaction_date: tx.transaction_date })),
          ...supplierCashTxs.map(tx => ({ ...tx, transaction_date: tx.transaction_date }))
        ].sort((a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )

        // Para birimini en son işlemden al, yoksa TRY
        const mainCurrency = allSupplierTxs[0]?.currency || 'TRY'

        accountsData.push({
          id: supplier.id,
          type: 'supplier',
          name: supplier.company_name,
          totalReceivable: 0,
          totalPayable,
          currency: mainCurrency,
          balancesByCurrency,
          lastTransactionDate: allSupplierTxs[0]?.transaction_date,
          transactionCount: supplierTxs.length + supplierCashTxs.length, // Hem cari hem kasa işlemleri
          overdueCount
        })
      })

      setAccounts(accountsData)
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  const handleViewAccountDetail = async (account: Account) => {
    setSelectedAccount(account)

    try {
      // İlgili hesabın tüm cari işlemlerini çek
      const { data: accountTxns } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId!)
        .eq(account.type === 'customer' ? 'customer_id' : 'supplier_id', account.id)

      // İlgili hesabın tüm kasa ödemelerini çek
      const { data: cashTxns } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('company_id', companyId!)
        .eq(account.type === 'customer' ? 'customer_id' : 'supplier_id', account.id)

      // İkisini birleştir ve transaction_date'e göre sırala
      const allTransactions = [
        ...(accountTxns || []).map(tx => ({ ...tx, source: 'account' })),
        ...(cashTxns || []).map(tx => ({ ...tx, source: 'cash' }))
      ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())

      setSelectedAccountTransactions(allTransactions as any)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading account transactions:', error)
    }
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesType = accountTypeFilter === 'all' || account.type === accountTypeFilter
    const matchesBalance = balanceFilter === 'all' ||
      (balanceFilter === 'receivable' && account.totalReceivable > 0) ||
      (balanceFilter === 'payable' && account.totalPayable > 0)
    const matchesSearch = account.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesType && matchesBalance && matchesSearch
  })

  // Para birimi bazında toplam alacak ve borçları hesapla
  const receivablesByCurrency: Record<string, number> = {}
  const payablesByCurrency: Record<string, number> = {}

  accounts.forEach(acc => {
    Object.entries(acc.balancesByCurrency).forEach(([currency, balance]) => {
      if (balance.receivable > 0) {
        receivablesByCurrency[currency] = (receivablesByCurrency[currency] || 0) + balance.receivable
      }
      if (balance.payable > 0) {
        payablesByCurrency[currency] = (payablesByCurrency[currency] || 0) + balance.payable
      }
    })
  })

  // Backward compatibility için
  const totalReceivables = accounts.reduce((sum, acc) => sum + acc.totalReceivable, 0)
  const totalPayables = accounts.reduce((sum, acc) => sum + acc.totalPayable, 0)
  const netBalance = totalReceivables - totalPayables

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date()
  }

  const handleDownloadDocument = async (documentPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('accounting-documents')
        .createSignedUrl(documentPath, 60) // 60 saniye geçerli URL

      if (error) {
        console.error('Download error:', error)
        alert('Belge indirme hatası: ' + error.message)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
      alert('Belge indirilemedi!')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cari Hesaplar</h2>
          <p className="text-gray-600">Müşteri ve tedarikçi alacak/borç takibi</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm">Toplam Alacak</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          {Object.keys(receivablesByCurrency).length === 0 ? (
            <div className="text-3xl font-bold">0.00 TRY</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(receivablesByCurrency).map(([currency, amount]) => (
                <div key={currency} className="text-2xl font-bold">
                  {formatCurrency(amount, currency)}
                </div>
              ))}
            </div>
          )}
          <p className="text-green-100 text-xs mt-2">Müşterilerden tahsil edilecek</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm">Toplam Borç</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          {Object.keys(payablesByCurrency).length === 0 ? (
            <div className="text-3xl font-bold">0.00 TRY</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(payablesByCurrency).map(([currency, amount]) => (
                <div key={currency} className="text-2xl font-bold">
                  {formatCurrency(amount, currency)}
                </div>
              ))}
            </div>
          )}
          <p className="text-red-100 text-xs mt-2">Tedarikçilere ödenecek</p>
        </div>

        <div className={`bg-gradient-to-br ${netBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm opacity-90">Net Bakiye</span>
            <DollarSign className="w-5 h-5 opacity-90" />
          </div>
          <div className="text-3xl font-bold">{formatCurrency(netBalance)}</div>
          <p className="text-white text-xs mt-2 opacity-90">{netBalance >= 0 ? 'Pozitif bakiye' : 'Negatif bakiye'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Cari hesap ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Hesaplar</option>
            <option value="customer">Müşteriler</option>
            <option value="supplier">Tedarikçiler</option>
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Bakiyeler</option>
            <option value="receivable">Alacaklı Olanlar</option>
            <option value="payable">Borçlu Olanlar</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cari Hesap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alacak</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borç</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem Sayısı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vadesi Geçmiş</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Son İşlem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={`${account.type}-${account.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{account.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      account.type === 'customer' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {account.type === 'customer' ? 'Müşteri' : 'Tedarikçi'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-green-600">
                      {Object.keys(account.balancesByCurrency).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(account.balancesByCurrency)
                            .filter(([_, balance]) => balance.receivable > 0)
                            .map(([currency, balance]) => (
                              <div key={currency}>
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: currency
                                }).format(balance.receivable)}
                              </div>
                            ))}
                        </div>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-red-600">
                      {Object.keys(account.balancesByCurrency).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(account.balancesByCurrency)
                            .filter(([_, balance]) => balance.payable > 0)
                            .map(([currency, balance]) => (
                              <div key={currency}>
                                {new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: currency
                                }).format(balance.payable)}
                              </div>
                            ))}
                        </div>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.transactionCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.overdueCount > 0 ? (
                      <span className="flex items-center text-xs text-red-700 font-medium">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {account.overdueCount}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.lastTransactionDate
                      ? formatDate(account.lastTransactionDate)
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewAccountDetail(account)}
                      className="text-blue-600 hover:text-blue-900 flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Cari hesap bulunamadı</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedAccount.name}</h3>
                <p className="text-gray-600">
                  {selectedAccount.type === 'customer' ? 'Müşteri' : 'Tedarikçi'} -
                  <span className="ml-2 font-bold text-green-600">
                    Alacak: {formatCurrency(selectedAccount.totalReceivable)}
                  </span>
                  <span className="ml-2 font-bold text-red-600">
                    Borç: {formatCurrency(selectedAccount.totalPayable)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedAccount(null)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Kaynak</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tarih</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Vade</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tip</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tutar</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Ödenen</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Kalan</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Durum</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Açıklama</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Referans</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Belge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedAccountTransactions.map((tx: any) => {
                    const isCashTransaction = tx.source === 'cash'
                    const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount)

                    // Cari işlem hesaplamaları
                    const paidAmount = tx.paid_amount ? (typeof tx.paid_amount === 'number' ? tx.paid_amount : parseFloat(tx.paid_amount)) : 0
                    const remaining = amount - paidAmount
                    const overdue = !isCashTransaction && tx.due_date && isOverdue(tx.due_date) && tx.status !== 'paid'

                    return (
                      <tr key={tx.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50' : ''} ${isCashTransaction ? 'bg-blue-50' : ''}`}>
                        {/* Kaynak */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            isCashTransaction ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isCashTransaction ? 'Kasa' : 'Cari'}
                          </span>
                        </td>

                        {/* Tarih */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(tx.transaction_date)}
                        </td>

                        {/* Vade */}
                        <td className="px-4 py-3 text-sm">
                          {isCashTransaction ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <div className="flex items-center">
                              {overdue && <AlertCircle className="w-4 h-4 text-red-600 mr-1" />}
                              <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-900'}>
                                {formatDate(tx.due_date)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Tip */}
                        <td className="px-4 py-3">
                          {isCashTransaction ? (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              tx.transaction_type === 'income'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tx.transaction_type === 'income' ? 'Tahsilat' : 'Ödeme'}
                            </span>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              tx.transaction_type === 'receivable'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tx.transaction_type === 'receivable' ? 'Alacak' : 'Borç'}
                            </span>
                          )}
                        </td>

                        {/* Tutar */}
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          {formatCurrency(amount, tx.currency)}
                        </td>

                        {/* Ödenen */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {isCashTransaction ? (
                            <span className="text-green-600 font-bold">{formatCurrency(amount, tx.currency)}</span>
                          ) : (
                            formatCurrency(paidAmount, tx.currency)
                          )}
                        </td>

                        {/* Kalan */}
                        <td className={`px-4 py-3 text-sm font-bold ${
                          isCashTransaction ? 'text-gray-400' :
                          tx.transaction_type === 'receivable' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isCashTransaction ? '-' : formatCurrency(remaining, tx.currency)}
                        </td>

                        {/* Durum */}
                        <td className="px-4 py-3">
                          {isCashTransaction ? (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                              Tamamlandı
                            </span>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              tx.status === 'paid' ? 'bg-gray-100 text-gray-800' :
                              tx.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {tx.status === 'paid' ? 'Ödendi' : tx.status === 'partial' ? 'Kısmi' : 'Bekliyor'}
                            </span>
                          )}
                        </td>

                        {/* Açıklama */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {tx.description || '-'}
                          {isCashTransaction && tx.payment_method && (
                            <div className="text-xs text-gray-500 mt-1">
                              ({tx.payment_method === 'cash' ? 'Nakit' :
                                tx.payment_method === 'transfer' ? 'Transfer' :
                                tx.payment_method === 'check' ? 'Çek' : 'Diğer'})
                            </div>
                          )}
                        </td>

                        {/* Referans */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {tx.reference_number || '-'}
                        </td>

                        {/* Belge */}
                        <td className="px-4 py-3 text-center">
                          {tx.document_url ? (
                            <button
                              onClick={() => handleDownloadDocument(tx.document_url)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                              title="Belgeyi İndir"
                            >
                              <FileDown className="w-3 h-3" />
                              PDF
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {selectedAccountTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Henüz işlem kaydı yok</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

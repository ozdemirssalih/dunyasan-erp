'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, Plus, Eye, DollarSign, Calendar, FileDown, Edit2, Trash2, Users } from 'lucide-react'

interface CurrentAccount {
  id: string
  account_code: string
  account_name: string
  account_type: 'customer' | 'supplier' | 'both'
  current_balance: number
  currency: string
  tax_number?: string
  phone?: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface AccountTransaction {
  id: string
  transaction_type: string
  direction: 'debit' | 'credit'
  amount: number
  currency: string
  exchange_rate: number
  amount_tl?: number
  invoice_id?: string
  description?: string
  transaction_date: string
  due_date?: string
  created_at: string
  invoice?: {
    invoice_number: string
    invoice_type: string
  }
}

export default function CurrentAccountsPage() {
  const [accounts, setAccounts] = useState<CurrentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filters
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'customer' | 'supplier' | 'both'>('all')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<CurrentAccount | null>(null)
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
      // Unified current accounts tablosundan tüm cari hesapları çek
      const { data: accountsData, error } = await supabase
        .from('current_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('account_code', { ascending: true })

      if (error) {
        console.error('Error loading accounts:', error)
        return
      }

      setAccounts(accountsData || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  const handleViewAccountDetail = async (account: CurrentAccount) => {
    setSelectedAccount(account)

    try {
      // İlgili hesabın tüm işlemlerini çek
      const { data: transactions, error } = await supabase
        .from('current_account_transactions')
        .select(`
          *,
          invoice:invoices(invoice_number, invoice_type)
        `)
        .eq('company_id', companyId!)
        .eq('account_id', account.id)
        .order('transaction_date', { ascending: false })

      if (error) {
        console.error('Error loading transactions:', error)
        return
      }

      setSelectedAccountTransactions(transactions || [])
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading account transactions:', error)
    }
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesType = accountTypeFilter === 'all' || account.account_type === accountTypeFilter
    const matchesBalance = balanceFilter === 'all' ||
      (balanceFilter === 'positive' && account.current_balance > 0) ||
      (balanceFilter === 'negative' && account.current_balance < 0)
    const matchesSearch = account.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.account_code.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesType && matchesBalance && matchesSearch
  })

  // Toplam alacak ve borç hesapla
  const totalReceivables = accounts.reduce((sum, acc) =>
    sum + (acc.current_balance > 0 ? acc.current_balance : 0), 0)

  const totalPayables = accounts.reduce((sum, acc) =>
    sum + (acc.current_balance < 0 ? Math.abs(acc.current_balance) : 0), 0)

  const netBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)

  const formatCurrency = (amount: number, currency: string = 'TL') => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + currency
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const getTransactionTypeBadge = (type: string) => {
    const badges: Record<string, { label: string, color: string }> = {
      'sales': { label: '💰 Satış Faturası', color: 'bg-green-100 text-green-800' },
      'purchase': { label: '🛒 Alış Faturası', color: 'bg-red-100 text-red-800' },
      'incoming_return': { label: '↪️ Gelen İade', color: 'bg-orange-100 text-orange-800' },
      'outgoing_return': { label: '↩️ Giden İade', color: 'bg-blue-100 text-blue-800' },
      'withholding': { label: '📋 Tevkifatlı', color: 'bg-purple-100 text-purple-800' },
      'exempt': { label: '🆓 İstisna', color: 'bg-yellow-100 text-yellow-800' },
      'purchase_fx': { label: '💱 Alış Kur Farkı', color: 'bg-pink-100 text-pink-800' },
      'sales_fx': { label: '💱 Satış Kur Farkı', color: 'bg-teal-100 text-teal-800' },
      'payment': { label: '💸 Ödeme', color: 'bg-red-100 text-red-800' },
      'receipt': { label: '💵 Tahsilat', color: 'bg-green-100 text-green-800' },
      'manual': { label: '✏️ Manuel İşlem', color: 'bg-gray-100 text-gray-800' },
      'receivable': { label: '📈 Alacak', color: 'bg-green-100 text-green-800' },
      'payable': { label: '📉 Borç', color: 'bg-red-100 text-red-800' },
    }

    const badge = badges[type] || { label: type, color: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 text-xs font-medium rounded ${badge.color}`}>{badge.label}</span>
  }

  const getAccountTypeBadge = (type: string) => {
    const badges: Record<string, { label: string, color: string }> = {
      'customer': { label: '👤 Müşteri', color: 'bg-purple-100 text-purple-800' },
      'supplier': { label: '🏭 Tedarikçi', color: 'bg-blue-100 text-blue-800' },
      'both': { label: '🔄 Her İkisi', color: 'bg-indigo-100 text-indigo-800' },
    }

    const badge = badges[type] || { label: type, color: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 text-xs font-medium rounded ${badge.color}`}>{badge.label}</span>
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
          <p className="text-gray-600">Birleşik cari hesap yönetimi - Müşteri ve tedarikçi takibi</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm">Toplam Alacak</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          <div className="text-3xl font-bold">{formatCurrency(totalReceivables)}</div>
          <p className="text-green-100 text-xs mt-2">Müşterilerden tahsil edilecek</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm">Toplam Borç</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <div className="text-3xl font-bold">{formatCurrency(totalPayables)}</div>
          <p className="text-red-100 text-xs mt-2">Tedarikçilere ödenecek</p>
        </div>

        <div className={`bg-gradient-to-br ${netBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm opacity-90">Net Bakiye</span>
            <DollarSign className="w-5 h-5 opacity-90" />
          </div>
          <div className="text-3xl font-bold">{formatCurrency(netBalance)}</div>
          <p className="text-white text-xs mt-2 opacity-90">
            {netBalance >= 0 ? 'Alacak (Pozitif)' : 'Borç (Negatif)'}
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Birleşik Cari Hesap Sistemi</h3>
            <p className="text-sm text-blue-800">
              Bu sistem müşteri ve tedarikçileri tek bir listede birleştirir. Faturalar otomatik olarak cari hesaplara işlenir.
              8 fatura tipi desteklenir: Satış (+), Alış (-), Gelen/Giden İade, Tevkifatlı, İstisna, Kur Farkları.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Cari hesap ara (isim veya kod)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Tipler</option>
            <option value="customer">Sadece Müşteriler</option>
            <option value="supplier">Sadece Tedarikçiler</option>
            <option value="both">Her İkisi</option>
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Bakiyeler</option>
            <option value="positive">Alacaklı (Pozitif)</option>
            <option value="negative">Borçlu (Negatif)</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cari Hesap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bakiye</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Para Birimi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{account.account_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.account_name}</div>
                        {account.tax_number && (
                          <div className="text-xs text-gray-500">VKN: {account.tax_number}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getAccountTypeBadge(account.account_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-bold ${
                      account.current_balance > 0 ? 'text-green-600' :
                      account.current_balance < 0 ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {formatCurrency(account.current_balance, account.currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.current_balance > 0 ? 'Alacak' :
                       account.current_balance < 0 ? 'Borç' :
                       'Dengede'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.currency || 'TL'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {account.is_active ? 'Aktif' : 'Pasif'}
                    </span>
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
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
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
                <h3 className="text-2xl font-bold text-gray-800">{selectedAccount.account_name}</h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-gray-600">Kod: {selectedAccount.account_code}</span>
                  <span className="text-gray-400">|</span>
                  {getAccountTypeBadge(selectedAccount.account_type)}
                  <span className="text-gray-400">|</span>
                  <span className={`font-bold ${
                    selectedAccount.current_balance > 0 ? 'text-green-600' :
                    selectedAccount.current_balance < 0 ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    Bakiye: {formatCurrency(selectedAccount.current_balance, selectedAccount.currency)}
                  </span>
                </div>
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
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tarih</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">İşlem Tipi</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Yön</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tutar</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Fatura</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedAccountTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-3">
                        {getTransactionTypeBadge(tx.transaction_type)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          tx.direction === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.direction === 'credit' ? '➕ Alacak' : '➖ Borç'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${
                        tx.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.direction === 'credit' ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency)}
                        {tx.exchange_rate !== 1 && (
                          <div className="text-xs text-gray-500">
                            Kur: {tx.exchange_rate} = {formatCurrency(tx.amount_tl || (tx.amount * tx.exchange_rate))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.invoice ? (
                          <div>
                            <div className="font-medium">{tx.invoice.invoice_number}</div>
                            <div className="text-xs text-gray-500">{tx.invoice.invoice_type}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))}
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

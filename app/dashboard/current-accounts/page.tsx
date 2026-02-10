'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, TrendingUp, TrendingDown, Plus, Eye, DollarSign, Receipt, Calendar } from 'lucide-react'

interface Account {
  id: string
  type: 'customer' | 'supplier'
  name: string
  balance: number
  lastTransactionDate?: string
  transactionCount: number
}

interface Transaction {
  id: string
  account_id: string
  account_name: string
  account_type: string
  transaction_type: 'debit' | 'credit'
  amount: number
  description: string
  reference_number: string
  document_type: string
  transaction_date: string
  created_at: string
}

export default function CurrentAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Filters
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  // Form state
  const [transactionForm, setTransactionForm] = useState({
    account_id: '',
    account_type: 'customer' as 'customer' | 'supplier',
    account_name: '',
    transaction_type: 'debit' as 'debit' | 'credit',
    amount: 0,
    description: '',
    reference_number: '',
    document_type: 'invoice',
    transaction_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)

      await loadAccounts(fetchedCompanyId)
      await loadTransactions(fetchedCompanyId)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (companyId: string) => {
    try {
      // Load customers
      const { data: customers } = await supabase
        .from('customer_companies')
        .select('id, customer_name')
        .eq('company_id', companyId)

      // Load suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', companyId)
        .eq('is_active', true)

      // Load transactions for balance calculation
      const { data: txs } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)

      // Calculate balances
      const accountsData: Account[] = []

      // Process customers
      customers?.forEach(customer => {
        const customerTxs = txs?.filter(t => t.account_id === customer.id && t.account_type === 'customer') || []
        const balance = customerTxs.reduce((sum, tx) => {
          return sum + (tx.transaction_type === 'debit' ? tx.amount : -tx.amount)
        }, 0)

        const sortedTxs = customerTxs.sort((a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )

        accountsData.push({
          id: customer.id,
          type: 'customer',
          name: customer.customer_name,
          balance,
          lastTransactionDate: sortedTxs[0]?.transaction_date,
          transactionCount: customerTxs.length
        })
      })

      // Process suppliers
      suppliers?.forEach(supplier => {
        const supplierTxs = txs?.filter(t => t.account_id === supplier.id && t.account_type === 'supplier') || []
        const balance = supplierTxs.reduce((sum, tx) => {
          return sum + (tx.transaction_type === 'debit' ? tx.amount : -tx.amount)
        }, 0)

        const sortedTxs = supplierTxs.sort((a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )

        accountsData.push({
          id: supplier.id,
          type: 'supplier',
          name: supplier.company_name,
          balance,
          lastTransactionDate: sortedTxs[0]?.transaction_date,
          transactionCount: supplierTxs.length
        })
      })

      setAccounts(accountsData)
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  const loadTransactions = async (companyId: string) => {
    try {
      const { data } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })
        .limit(100)

      setTransactions(data || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const handleCreateTransaction = async () => {
    if (!companyId || !transactionForm.account_id || transactionForm.amount <= 0) {
      alert('Lütfen tüm zorunlu alanları doldurun!')
      return
    }

    try {
      const { error } = await supabase
        .from('current_account_transactions')
        .insert({
          company_id: companyId,
          account_id: transactionForm.account_id,
          account_type: transactionForm.account_type,
          account_name: transactionForm.account_name,
          transaction_type: transactionForm.transaction_type,
          amount: transactionForm.amount,
          description: transactionForm.description || null,
          reference_number: transactionForm.reference_number || null,
          document_type: transactionForm.document_type,
          transaction_date: transactionForm.transaction_date,
          created_by: currentUserId
        })

      if (error) throw error

      alert('✅ İşlem kaydedildi!')
      setShowTransactionModal(false)
      resetTransactionForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating transaction:', error)
      alert(`❌ Hata: ${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleViewAccountDetail = async (account: Account) => {
    setSelectedAccount(account)
    setShowDetailModal(true)
  }

  const resetTransactionForm = () => {
    setTransactionForm({
      account_id: '',
      account_type: 'customer',
      account_name: '',
      transaction_type: 'debit',
      amount: 0,
      description: '',
      reference_number: '',
      document_type: 'invoice',
      transaction_date: new Date().toISOString().split('T')[0]
    })
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesType = accountTypeFilter === 'all' || account.type === accountTypeFilter
    const matchesBalance = balanceFilter === 'all' ||
      (balanceFilter === 'debit' && account.balance > 0) ||
      (balanceFilter === 'credit' && account.balance < 0)
    const matchesSearch = account.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesType && matchesBalance && matchesSearch
  })

  const totalDebit = accounts.reduce((sum, acc) => sum + (acc.balance > 0 ? acc.balance : 0), 0)
  const totalCredit = accounts.reduce((sum, acc) => sum + (acc.balance < 0 ? Math.abs(acc.balance) : 0), 0)
  const netBalance = totalDebit - totalCredit

  const accountTransactions = selectedAccount
    ? transactions.filter(t => t.account_id === selectedAccount.id && t.account_type === selectedAccount.type)
    : []

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
          <p className="text-gray-600">Müşteri ve tedarikçi borç/alacak takibi</p>
        </div>
        <button
          onClick={() => setShowTransactionModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Yeni İşlem</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-sm">Toplam Alacak</span>
            <TrendingUp className="w-5 h-5 text-green-100" />
          </div>
          <div className="text-3xl font-bold">{totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          <p className="text-green-100 text-xs mt-2">Müşterilerden tahsil edilecek</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm">Toplam Borç</span>
            <TrendingDown className="w-5 h-5 text-red-100" />
          </div>
          <div className="text-3xl font-bold">{totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          <p className="text-red-100 text-xs mt-2">Tedarikçilere ödenecek</p>
        </div>

        <div className={`bg-gradient-to-br ${netBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm opacity-90">Net Bakiye</span>
            <DollarSign className="w-5 h-5 opacity-90" />
          </div>
          <div className="text-3xl font-bold">{netBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
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
            <option value="debit">Borçlu Olanlar</option>
            <option value="credit">Alacaklı Olanlar</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bakiye</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem Sayısı</th>
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
                    <div className={`text-sm font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(account.balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.balance > 0 ? (
                      <span className="flex items-center text-xs text-green-700">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Borçlu
                      </span>
                    ) : account.balance < 0 ? (
                      <span className="flex items-center text-xs text-red-700">
                        <TrendingDown className="w-4 h-4 mr-1" />
                        Alacaklı
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Dengede</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.transactionCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.lastTransactionDate
                      ? new Date(account.lastTransactionDate).toLocaleDateString('tr-TR')
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

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Yeni Cari İşlem</h3>
              <button
                onClick={() => {
                  setShowTransactionModal(false)
                  resetTransactionForm()
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hesap Tipi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transactionForm.account_type}
                    onChange={(e) => {
                      setTransactionForm({
                        ...transactionForm,
                        account_type: e.target.value as 'customer' | 'supplier',
                        account_id: '',
                        account_name: ''
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="customer">Müşteri</option>
                    <option value="supplier">Tedarikçi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cari Hesap <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transactionForm.account_id}
                    onChange={(e) => {
                      const selectedAccount = accounts.find(a => a.id === e.target.value && a.type === transactionForm.account_type)
                      setTransactionForm({
                        ...transactionForm,
                        account_id: e.target.value,
                        account_name: selectedAccount?.name || ''
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçin...</option>
                    {accounts
                      .filter(a => a.type === transactionForm.account_type)
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    İşlem Tipi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transactionForm.transaction_type}
                    onChange={(e) => setTransactionForm({ ...transactionForm, transaction_type: e.target.value as 'debit' | 'credit' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="debit">Borç (Alacak Girişi)</option>
                    <option value="credit">Alacak (Ödeme)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tutar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Belge Tipi</label>
                  <select
                    value={transactionForm.document_type}
                    onChange={(e) => setTransactionForm({ ...transactionForm, document_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="invoice">Fatura</option>
                    <option value="payment">Ödeme</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Referans No</label>
                  <input
                    type="text"
                    value={transactionForm.reference_number}
                    onChange={(e) => setTransactionForm({ ...transactionForm, reference_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Fatura/İrsaliye no"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">İşlem Tarihi</label>
                <input
                  type="date"
                  value={transactionForm.transaction_date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                <textarea
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="İşlem açıklaması..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTransactionModal(false)
                  resetTransactionForm()
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleCreateTransaction}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedAccount.name}</h3>
                <p className="text-gray-600">
                  {selectedAccount.type === 'customer' ? 'Müşteri' : 'Tedarikçi'} -
                  Bakiye: <span className={`font-bold ${selectedAccount.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(selectedAccount.balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tarih</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tip</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tutar</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Açıklama</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Referans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accountTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(tx.transaction_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          tx.transaction_type === 'debit'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.transaction_type === 'debit' ? 'Borç' : 'Alacak'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${
                        tx.transaction_type === 'debit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.transaction_type === 'debit' ? '+' : '-'}
                        {tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.reference_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {accountTransactions.length === 0 && (
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

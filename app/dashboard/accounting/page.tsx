'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  FileText,
  Users,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  BarChart3,
  X,
} from 'lucide-react'

interface Stats {
  totalIncome: number
  totalExpense: number
  netProfit: number
  cashBalance: number
  bankBalance: number
  pendingInvoices: number
  currentAccountsReceivable: number
  currentAccountsPayable: number
}

interface Transaction {
  id: string
  transaction_type: 'income' | 'expense'
  amount: number
  description: string
  transaction_date: string
  category_name?: string
  payment_account_name?: string
}

export default function AccountingPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    cashBalance: 0,
    bankBalance: 0,
    pendingInvoices: 0,
    currentAccountsReceivable: 0,
    currentAccountsPayable: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month')

  // Modal states
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([])
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    category_id: '',
    payment_account_id: '',
    amount: 0,
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [selectedPeriod])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)
      await loadStats(profile.company_id)
      await loadRecentTransactions(profile.company_id)
      await loadCategories(profile.company_id)
      await loadPaymentAccounts(profile.company_id)
    } catch (error) {
      console.error('Error loading accounting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async (companyId: string) => {
    const { data } = await supabase
      .from('accounting_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setCategories(data || [])
  }

  const loadPaymentAccounts = async (companyId: string) => {
    const { data } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setPaymentAccounts(data || [])
  }

  const loadStats = async (companyId: string) => {
    // Tarih aralığını belirle
    const now = new Date()
    let startDate = new Date()

    switch (selectedPeriod) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    // Gelir/Gider verilerini çek
    const { data: transactions } = await supabase
      .from('accounting_transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('transaction_date', startDate.toISOString().split('T')[0])

    const totalIncome = transactions
      ?.filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0

    const totalExpense = transactions
      ?.filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0

    // Kasa/Banka bakiyelerini çek
    const { data: paymentAccounts } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const cashBalance = paymentAccounts
      ?.filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + parseFloat(a.current_balance), 0) || 0

    const bankBalance = paymentAccounts
      ?.filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + parseFloat(a.current_balance), 0) || 0

    // Bekleyen faturalar
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .in('payment_status', ['pending', 'partial'])

    const pendingInvoices = invoices?.length || 0

    // Cari hesap alacak/borç
    const { data: currentAccounts } = await supabase
      .from('current_accounts')
      .select('*')
      .eq('company_id', companyId)

    const currentAccountsReceivable = currentAccounts
      ?.filter(a => a.type === 'customer' && parseFloat(a.current_balance) > 0)
      .reduce((sum, a) => sum + parseFloat(a.current_balance), 0) || 0

    const currentAccountsPayable = currentAccounts
      ?.filter(a => a.type === 'supplier' && parseFloat(a.current_balance) < 0)
      .reduce((sum, a) => sum + Math.abs(parseFloat(a.current_balance)), 0) || 0

    setStats({
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      cashBalance,
      bankBalance,
      pendingInvoices,
      currentAccountsReceivable,
      currentAccountsPayable,
    })
  }

  const loadRecentTransactions = async (companyId: string) => {
    const { data } = await supabase
      .from('accounting_transactions')
      .select(`
        *,
        category:accounting_categories(name),
        payment_account:payment_accounts(name)
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })
      .limit(10)

    setRecentTransactions(data?.map(t => ({
      id: t.id,
      transaction_type: t.transaction_type,
      amount: parseFloat(t.amount),
      description: t.description,
      transaction_date: t.transaction_date,
      category_name: t.category?.name,
      payment_account_name: t.payment_account?.name,
    })) || [])
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      // İşlemi kaydet
      const { data: transaction, error: transactionError } = await supabase
        .from('accounting_transactions')
        .insert({
          company_id: companyId,
          transaction_type: transactionForm.transaction_type,
          category_id: transactionForm.category_id || null,
          payment_account_id: transactionForm.payment_account_id || null,
          amount: transactionForm.amount,
          description: transactionForm.description,
          transaction_date: transactionForm.transaction_date,
          reference_number: transactionForm.reference_number || null,
          notes: transactionForm.notes || null,
          created_by: currentUserId,
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Kasa/Banka bakiyesini güncelle
      if (transactionForm.payment_account_id) {
        const account = paymentAccounts.find(a => a.id === transactionForm.payment_account_id)
        if (account) {
          const balanceChange = transactionForm.transaction_type === 'income'
            ? transactionForm.amount
            : -transactionForm.amount

          await supabase
            .from('payment_accounts')
            .update({
              current_balance: parseFloat(account.current_balance) + balanceChange,
              updated_at: new Date().toISOString(),
            })
            .eq('id', transactionForm.payment_account_id)
        }
      }

      // Modal'ı kapat ve verileri yenile
      setShowTransactionModal(false)
      setTransactionForm({
        transaction_type: 'income',
        category_id: '',
        payment_account_id: '',
        amount: 0,
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
      })

      await loadData()
      alert('İşlem başarıyla kaydedildi!')
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      alert('Hata: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Muhasebe</h1>
            <p className="text-gray-600 mt-1">Finansal yönetim ve raporlama</p>
          </div>
          <div className="flex gap-3">
            {/* Period Selector */}
            <div className="flex gap-2 bg-white rounded-lg border border-gray-200 p-1">
              {(['today', 'week', 'month', 'year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                    selectedPeriod === period
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {period === 'today' && 'Bugün'}
                  {period === 'week' && 'Hafta'}
                  {period === 'month' && 'Ay'}
                  {period === 'year' && 'Yıl'}
                </button>
              ))}
            </div>

            <PermissionGuard module="accounting" permission="create">
              <button
                onClick={() => setShowTransactionModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-5 h-5" />
                Yeni İşlem
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Income */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingUp className="w-7 h-7" />
              </div>
              <ArrowUpRight className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(stats.totalIncome)}</div>
            <div className="text-emerald-100 text-sm font-medium">Toplam Gelir</div>
            <div className="mt-3 pt-3 border-t border-emerald-400/30 text-xs text-emerald-100">
              {selectedPeriod === 'month' ? 'Bu ay' : selectedPeriod === 'year' ? 'Bu yıl' : 'Seçili dönem'}
            </div>
          </div>

          {/* Total Expense */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingDown className="w-7 h-7" />
              </div>
              <ArrowDownRight className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(stats.totalExpense)}</div>
            <div className="text-rose-100 text-sm font-medium">Toplam Gider</div>
            <div className="mt-3 pt-3 border-t border-rose-400/30 text-xs text-rose-100">
              {selectedPeriod === 'month' ? 'Bu ay' : selectedPeriod === 'year' ? 'Bu yıl' : 'Seçili dönem'}
            </div>
          </div>

          {/* Net Profit */}
          <div className={`bg-gradient-to-br ${stats.netProfit >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all`}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <DollarSign className="w-7 h-7" />
              </div>
              <PieChart className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(stats.netProfit)}</div>
            <div className="text-blue-100 text-sm font-medium">Net Kar/Zarar</div>
            <div className="mt-3 pt-3 border-t border-blue-400/30 text-xs text-blue-100">
              {stats.netProfit >= 0 ? 'Kar' : 'Zarar'}
            </div>
          </div>

          {/* Cash + Bank */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <Wallet className="w-7 h-7" />
              </div>
              <CreditCard className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(stats.cashBalance + stats.bankBalance)}</div>
            <div className="text-purple-100 text-sm font-medium">Toplam Bakiye</div>
            <div className="mt-3 pt-3 border-t border-purple-400/30 text-xs text-purple-100 flex justify-between">
              <span>Kasa: {formatCurrency(stats.cashBalance)}</span>
              <span>Banka: {formatCurrency(stats.bankBalance)}</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 rounded-lg p-3">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.pendingInvoices}</div>
                <div className="text-sm text-gray-600">Bekleyen Fatura</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-lg p-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.currentAccountsReceivable)}</div>
                <div className="text-sm text-gray-600">Alacaklar</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 rounded-lg p-3">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.currentAccountsPayable)}</div>
                <div className="text-sm text-gray-600">Borçlar</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Son İşlemler
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Açıklama</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hesap</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tutar</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(transaction.transaction_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{transaction.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{transaction.category_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{transaction.payment_account_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`font-bold ${transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.transaction_type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-gray-300" />
                        <p>Henüz işlem kaydı yok</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Yeni İşlem Ekle</h3>
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">İşlem Tipi *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'income' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        transactionForm.transaction_type === 'income'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      💰 Gelir
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'expense' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        transactionForm.transaction_type === 'expense'
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      💸 Gider
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama *</label>
                  <input
                    type="text"
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="İşlem açıklaması"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tutar (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tarih *</label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori</label>
                  <select
                    value={transactionForm.category_id}
                    onChange={(e) => setTransactionForm({ ...transactionForm, category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Kategori seçin...</option>
                    {categories
                      .filter(cat => cat.type === transactionForm.transaction_type)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                  {categories.filter(cat => cat.type === transactionForm.transaction_type).length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">⚠️ Önce kategori oluşturun</p>
                  )}
                </div>

                {/* Payment Account */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kasa/Banka</label>
                  <select
                    value={transactionForm.payment_account_id}
                    onChange={(e) => setTransactionForm({ ...transactionForm, payment_account_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Hesap seçin...</option>
                    {paymentAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'cash' ? 'Kasa' : 'Banka'}) - {formatCurrency(parseFloat(acc.current_balance))}
                      </option>
                    ))}
                  </select>
                  {paymentAccounts.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">⚠️ Önce kasa/banka hesabı oluşturun</p>
                  )}
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Referans No</label>
                  <input
                    type="text"
                    value={transactionForm.reference_number}
                    onChange={(e) => setTransactionForm({ ...transactionForm, reference_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dekont no, fiş no, vb."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={transactionForm.notes}
                    onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Ek notlar..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTransactionModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

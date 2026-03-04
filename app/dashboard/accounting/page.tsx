'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  Wallet, TrendingUp, TrendingDown, Clock, AlertCircle,
  Plus, X, Save, DollarSign, Calendar, FileText, History
} from 'lucide-react'

export default function AccountingPage() {
  const { canCreate } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')

  // Data states - Para birimi bazında
  const [cashBalances, setCashBalances] = useState<Record<string, number>>({})
  const [totalIncome, setTotalIncome] = useState<Record<string, number>>({})
  const [totalExpense, setTotalExpense] = useState<Record<string, number>>({})
  const [pendingPaymentsByType, setPendingPaymentsByType] = useState<{sales: Record<string, number>, purchase: Record<string, number>}>(
    {sales: {}, purchase: {}}
  )
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [currentAccountsData, setCurrentAccountsData] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [incomeCategories, setIncomeCategories] = useState<any[]>([])
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])

  // Modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // Form state
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'other',
    currency: 'TRY',
    customer_id: '',
    supplier_id: '',
    category_id: ''
  })

  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profile?.company_id) {
        setCompanyId(profile.company_id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!companyId) return

    try {
      // Cari hesap işlemlerini yükle (tümü)
      const { data: transactions } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })

      setAllTransactions(transactions || [])
      setRecentTransactions(transactions?.slice(0, 10) || [])

      // Para birimi bazında hesaplamalar
      const incomeByCurrency: Record<string, number> = {}
      const expenseByCurrency: Record<string, number> = {}
      const cashByCurrency: Record<string, number> = {}

      transactions?.forEach(t => {
        const currency = t.currency || 'TRY'
        const amount = parseFloat(t.amount)

        if (t.transaction_type === 'credit') {
          // Gelir
          incomeByCurrency[currency] = (incomeByCurrency[currency] || 0) + amount
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) + amount
        } else {
          // Gider
          expenseByCurrency[currency] = (expenseByCurrency[currency] || 0) + amount
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) - amount
        }
      })

      setTotalIncome(incomeByCurrency)
      setTotalExpense(expenseByCurrency)
      setCashBalances(cashByCurrency)

      // Beklenen ödemeleri para birimi bazında hesapla
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })

      setPendingPayments(invoices || [])

      const salesByCurrency: Record<string, number> = {}
      const purchaseByCurrency: Record<string, number> = {}

      invoices?.forEach(inv => {
        const currency = 'TRY' // Faturalarda henüz para birimi yok, varsayılan TRY
        const amount = parseFloat(inv.total_amount)

        if (inv.invoice_type === 'sales') {
          salesByCurrency[currency] = (salesByCurrency[currency] || 0) + amount
        } else {
          purchaseByCurrency[currency] = (purchaseByCurrency[currency] || 0) + amount
        }
      })

      setPendingPaymentsByType({ sales: salesByCurrency, purchase: purchaseByCurrency })

      // Müşterileri ve tedarikçileri yükle
      const { data: customersData } = await supabase
        .from('customer_companies')
        .select('id, customer_name')
        .eq('company_id', companyId)
        .order('customer_name')

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('company_name')

      setCustomers(customersData || [])
      setSuppliers(suppliersData || [])

      const accountsData = [
        ...(customersData || []).map(c => ({ ...c, type: 'customer', name: c.customer_name })),
        ...(suppliersData || []).map(s => ({ ...s, type: 'supplier', name: s.company_name }))
      ]

      setCurrentAccountsData(accountsData)

      // Kategorileri yükle
      const { data: incomeCats } = await supabase
        .from('accounting_categories')
        .select('*')
        .eq('company_id', companyId)
        .eq('type', 'income')
        .eq('is_active', true)
        .order('name')

      const { data: expenseCats } = await supabase
        .from('accounting_categories')
        .select('*')
        .eq('company_id', companyId)
        .eq('type', 'expense')
        .eq('is_active', true)
        .order('name')

      setIncomeCategories(incomeCats || [])
      setExpenseCategories(expenseCats || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSaveTransaction = async () => {
    if (!transactionForm.amount || !companyId) {
      return alert('Tutar zorunludur!')
    }

    // Gelir ise müşteri, gider ise tedarikçi zorunlu
    if (transactionForm.transaction_type === 'income' && !transactionForm.customer_id) {
      return alert('Gelir işlemleri için müşteri seçimi zorunludur!')
    }
    if (transactionForm.transaction_type === 'expense' && !transactionForm.supplier_id) {
      return alert('Gider işlemleri için tedarikçi seçimi zorunludur!')
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const transactionData: any = {
        company_id: companyId,
        transaction_type: transactionForm.transaction_type === 'income' ? 'credit' : 'debit',
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        transaction_date: transactionForm.transaction_date,
        due_date: transactionForm.due_date || null,
        document_type: 'manual',
        reference_number: `MAN-${Date.now()}`,
        created_by: user?.id,
        currency: transactionForm.currency,
        payment_method: transactionForm.payment_method
      }

      // Gelir ise müşteri, gider ise tedarikçi
      if (transactionForm.transaction_type === 'income') {
        transactionData.customer_id = transactionForm.customer_id
      } else {
        transactionData.supplier_id = transactionForm.supplier_id
      }

      // Kategori varsa ekle
      if (transactionForm.category_id) {
        transactionData.category_id = transactionForm.category_id
      }

      await supabase.from('current_account_transactions').insert(transactionData)

      setShowTransactionModal(false)
      setTransactionForm({
        transaction_type: 'income',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        due_date: '',
        payment_method: 'cash',
        currency: 'TRY',
        customer_id: '',
        supplier_id: '',
        category_id: ''
      })
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="min-h-screen bg-gray-50 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Muhasebe</h1>
              <p className="text-gray-600">Gelir, gider ve cari hesap yönetimi</p>
            </div>
            {canCreate('accounting') && (
              <button
                onClick={() => setShowTransactionModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Yeni İşlem
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="w-4 h-4" />
              Geçmiş İşlemler
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Kasa */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Kasa Bakiyesi</div>
            {Object.keys(cashBalances).length === 0 ? (
              <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(cashBalances).map(([currency, amount]) => (
                  <div key={currency} className="text-lg font-bold text-gray-900">
                    {formatCurrency(amount, currency)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gelirler */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Toplam Gelir</div>
            {Object.keys(totalIncome).length === 0 ? (
              <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(totalIncome).map(([currency, amount]) => (
                  <div key={currency} className="text-lg font-bold text-green-600">
                    {formatCurrency(amount, currency)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Giderler */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Toplam Gider</div>
            {Object.keys(totalExpense).length === 0 ? (
              <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(totalExpense).map(([currency, amount]) => (
                  <div key={currency} className="text-lg font-bold text-red-600">
                    {formatCurrency(amount, currency)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Beklenen Ödemeler */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Beklenen Ödemeler</div>
            {Object.keys(pendingPaymentsByType.sales).length === 0 && Object.keys(pendingPaymentsByType.purchase).length === 0 ? (
              <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(pendingPaymentsByType.sales).map(([currency, amount]) => (
                  <div key={`sales-${currency}`} className="text-sm">
                    <span className="text-green-600 font-bold">{formatCurrency(amount, currency)}</span>
                    <span className="text-gray-500 ml-1">(Satış)</span>
                  </div>
                ))}
                {Object.entries(pendingPaymentsByType.purchase).map(([currency, amount]) => (
                  <div key={`purchase-${currency}`} className="text-sm">
                    <span className="text-orange-600 font-bold">{formatCurrency(amount, currency)}</span>
                    <span className="text-gray-500 ml-1">(Alış)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Son İşlemler</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{transaction.description || 'İşlem'}</div>
                      <div className="text-sm text-gray-600">{formatDate(transaction.transaction_date)}</div>
                    </div>
                    <div className={`text-lg font-semibold ${
                      transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'credit' ? '+' : '-'}
                      {formatCurrency(parseFloat(transaction.amount), transaction.currency || 'TRY')}
                    </div>
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Henüz işlem bulunmuyor
                </div>
              )}
            </div>
          </div>

          {/* Pending Payments */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Beklenen Ödemeler</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {pendingPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">{payment.invoice_number}</div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.invoice_type === 'sales' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {payment.invoice_type === 'sales' ? 'Satış' : 'Alış'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Vade: {formatDate(payment.due_date)}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(parseFloat(payment.total_amount))}
                    </div>
                  </div>
                </div>
              ))}
              {pendingPayments.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Beklenen ödeme bulunmuyor
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        ) : (
          /* Geçmiş İşlemler */
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Tüm İşlemler</h3>
              <p className="text-sm text-gray-600 mt-1">Toplam {allTransactions.length} işlem</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tür</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Para Birimi</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referans</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allTransactions.map((transaction) => {
                    const paymentMethodLabels = {
                      'cash': 'Nakit',
                      'transfer': 'Havale',
                      'check': 'Çek',
                      'other': 'Diğer'
                    }
                    return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.transaction_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.due_date ? formatDate(transaction.due_date) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.transaction_type === 'credit'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.transaction_type === 'credit' ? 'Gelir' : 'Gider'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.payment_method ? paymentMethodLabels[transaction.payment_method as keyof typeof paymentMethodLabels] || '-' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className={transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.transaction_type === 'credit' ? '+' : '-'}
                          {formatCurrency(parseFloat(transaction.amount), transaction.currency || 'TRY')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.currency || 'TRY'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.reference_number || '-'}
                      </td>
                    </tr>
                    )
                  })}
                  {allTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Henüz işlem bulunmuyor
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Yeni İşlem</h3>
                  <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İşlem Türü *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'income', customer_id: '', supplier_id: '', category_id: ''})}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        transactionForm.transaction_type === 'income'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Gelir
                    </button>
                    <button
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'expense', customer_id: '', supplier_id: '', category_id: ''})}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        transactionForm.transaction_type === 'expense'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Gider
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tutar *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi *</label>
                    <select
                      value={transactionForm.currency}
                      onChange={(e) => setTransactionForm({...transactionForm, currency: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="TRY">TRY - Türk Lirası</option>
                      <option value="USD">USD - Amerikan Doları</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - İngiliz Sterlini</option>
                    </select>
                  </div>
                </div>

                {transactionForm.transaction_type === 'income' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri *</label>
                    <select
                      value={transactionForm.customer_id}
                      onChange={(e) => setTransactionForm({...transactionForm, customer_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Müşteri Seçiniz...</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.customer_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi *</label>
                    <select
                      value={transactionForm.supplier_id}
                      onChange={(e) => setTransactionForm({...transactionForm, supplier_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Tedarikçi Seçiniz...</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Yöntemi *</label>
                    <select
                      value={transactionForm.payment_method}
                      onChange={(e) => setTransactionForm({...transactionForm, payment_method: e.target.value as any})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="cash">Nakit</option>
                      <option value="transfer">Havale</option>
                      <option value="check">Çek</option>
                      <option value="other">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                    <select
                      value={transactionForm.category_id}
                      onChange={(e) => setTransactionForm({...transactionForm, category_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Kategori Seçiniz...</option>
                      {(transactionForm.transaction_type === 'income' ? incomeCategories : expenseCategories).map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                    placeholder="İşlem açıklaması..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                    <input
                      type="date"
                      value={transactionForm.transaction_date}
                      onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vade Günü</label>
                    <input
                      type="date"
                      value={transactionForm.due_date}
                      onChange={(e) => setTransactionForm({...transactionForm, due_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTransaction}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  Wallet, TrendingUp, TrendingDown, Clock, Plus, X, Save, Calendar, History
} from 'lucide-react'

type TransactionType = 'receivable' | 'payable' | 'payment'

export default function AccountingPageV2() {
  const { canCreate } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')

  // Data states - Para birimi bazında
  const [cashBalances, setCashBalances] = useState<Record<string, number>>({})
  const [totalReceivables, setTotalReceivables] = useState<Record<string, number>>({})
  const [totalPayables, setTotalPayables] = useState<Record<string, number>>({})
  const [monthlyIncome, setMonthlyIncome] = useState<Record<string, number>>({})
  const [monthlyExpense, setMonthlyExpense] = useState<Record<string, number>>({})

  // Lists
  const [recentCashTransactions, setRecentCashTransactions] = useState<any[]>([])
  const [allCashTransactions, setAllCashTransactions] = useState<any[]>([])
  const [unpaidReceivables, setUnpaidReceivables] = useState<any[]>([])
  const [unpaidPayables, setUnpaidPayables] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // Form state
  const [formMode, setFormMode] = useState<'account' | 'payment'>('account') // Cari kayıt mı, ödeme mi?
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'receivable' as TransactionType,
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'other',
    currency: 'TRY',
    customer_id: '',
    supplier_id: '',
    related_account_transaction_id: '' // Ödeme yaparken hangi alacak/borcu kapatıyoruz
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
      // Kasa işlemlerini yükle
      const { data: cashTxns } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })

      setAllCashTransactions(cashTxns || [])
      setRecentCashTransactions(cashTxns?.slice(0, 10) || [])

      // Kasa bakiyesini hesapla (sadece ödemelerden)
      const cashByCurrency: Record<string, number> = {}
      cashTxns?.forEach(t => {
        const currency = t.currency || 'TRY'
        const amount = parseFloat(t.amount)
        if (t.transaction_type === 'income') {
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) + amount
        } else {
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) - amount
        }
      })
      setCashBalances(cashByCurrency)

      // Ödenmeyi bekleyen alacakları yükle
      const { data: receivables, error: recError } = await supabase
        .from('current_account_transactions')
        .select('*, customer:customer_companies(customer_name)')
        .eq('company_id', companyId)
        .eq('transaction_type', 'receivable')
        .in('status', ['unpaid', 'partial'])
        .order('due_date')

      if (recError) console.error('Receivables error:', recError)

      setUnpaidReceivables(receivables || [])

      // Alacak toplamını hesapla
      const receivableByCurrency: Record<string, number> = {}
      receivables?.forEach(r => {
        const currency = r.currency || 'TRY'
        const remaining = parseFloat(r.amount) - parseFloat(r.paid_amount || 0)
        receivableByCurrency[currency] = (receivableByCurrency[currency] || 0) + remaining
      })
      setTotalReceivables(receivableByCurrency)

      // Ödenmeyi bekleyen borçları yükle
      const { data: payables, error: payError } = await supabase
        .from('current_account_transactions')
        .select('*, supplier:suppliers(company_name)')
        .eq('company_id', companyId)
        .eq('transaction_type', 'payable')
        .in('status', ['unpaid', 'partial'])
        .order('due_date')

      if (payError) console.error('Payables error:', payError)

      setUnpaidPayables(payables || [])

      // Borç toplamını hesapla
      const payableByCurrency: Record<string, number> = {}
      payables?.forEach(p => {
        const currency = p.currency || 'TRY'
        const remaining = parseFloat(p.amount) - parseFloat(p.paid_amount || 0)
        payableByCurrency[currency] = (payableByCurrency[currency] || 0) + remaining
      })
      setTotalPayables(payableByCurrency)

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

      // Bu ayki gelir/gider hesapla
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const monthlyIncomeByCurrency: Record<string, number> = {}
      const monthlyExpenseByCurrency: Record<string, number> = {}

      cashTxns?.forEach(t => {
        const txDate = new Date(t.transaction_date)
        if (txDate >= firstDayOfMonth && txDate <= lastDayOfMonth) {
          const currency = t.currency || 'TRY'
          const amount = parseFloat(t.amount)

          if (t.transaction_type === 'income') {
            monthlyIncomeByCurrency[currency] = (monthlyIncomeByCurrency[currency] || 0) + amount
          } else {
            monthlyExpenseByCurrency[currency] = (monthlyExpenseByCurrency[currency] || 0) + amount
          }
        }
      })

      setMonthlyIncome(monthlyIncomeByCurrency)
      setMonthlyExpense(monthlyExpenseByCurrency)

    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSaveTransaction = async () => {
    if (!transactionForm.amount || !companyId) {
      return alert('Tutar zorunludur!')
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (formMode === 'account') {
        // CARİ KAYIT (ALACAK veya BORÇ)
        if (!transactionForm.customer_id && !transactionForm.supplier_id) {
          return alert('Müşteri veya tedarikçi seçimi zorunludur!')
        }
        if (!transactionForm.due_date) {
          return alert('Vade tarihi zorunludur!')
        }

        const isReceivable = !!transactionForm.customer_id

        await supabase.from('current_account_transactions').insert({
          company_id: companyId,
          transaction_type: isReceivable ? 'receivable' : 'payable',
          customer_id: isReceivable ? transactionForm.customer_id : null,
          supplier_id: !isReceivable ? transactionForm.supplier_id : null,
          amount: parseFloat(transactionForm.amount),
          paid_amount: 0,
          currency: transactionForm.currency,
          status: 'unpaid',
          transaction_date: transactionForm.transaction_date,
          due_date: transactionForm.due_date,
          description: transactionForm.description,
          reference_number: `${isReceivable ? 'RCV' : 'PAY'}-${Date.now()}`,
          created_by: user?.id
        })

      } else if (formMode === 'payment') {
        // ÖDEME KAYDI (Kasa işlemi)
        const amount = parseFloat(transactionForm.amount)

        // Kasa kaydı oluştur
        const cashData: any = {
          company_id: companyId,
          transaction_type: transactionForm.customer_id ? 'income' : 'expense',
          amount: amount,
          currency: transactionForm.currency,
          payment_method: transactionForm.payment_method,
          transaction_date: transactionForm.transaction_date,
          description: transactionForm.description,
          reference_number: `CASH-${Date.now()}`,
          created_by: user?.id
        }

        if (transactionForm.customer_id) {
          cashData.customer_id = transactionForm.customer_id
        }
        if (transactionForm.supplier_id) {
          cashData.supplier_id = transactionForm.supplier_id
        }
        if (transactionForm.related_account_transaction_id) {
          cashData.related_account_transaction_id = transactionForm.related_account_transaction_id
        }

        await supabase.from('cash_transactions').insert(cashData)

        // Eğer bir alacak/borcu kapatıyorsa, cari kaydı güncelle
        if (transactionForm.related_account_transaction_id) {
          const { data: accountTxn } = await supabase
            .from('current_account_transactions')
            .select('*')
            .eq('id', transactionForm.related_account_transaction_id)
            .single()

          if (accountTxn) {
            const newPaidAmount = parseFloat(accountTxn.paid_amount || 0) + amount
            const totalAmount = parseFloat(accountTxn.amount)
            const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial'

            await supabase
              .from('current_account_transactions')
              .update({
                paid_amount: newPaidAmount,
                status: newStatus
              })
              .eq('id', transactionForm.related_account_transaction_id)
          }
        }
      }

      setShowTransactionModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const resetForm = () => {
    setFormMode('account')
    setTransactionForm({
      transaction_type: 'receivable',
      amount: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
      due_date: '',
      payment_method: 'cash',
      currency: 'TRY',
      customer_id: '',
      supplier_id: '',
      related_account_transaction_id: ''
    })
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

  // Ödeme formunda gösterilecek açık alacak/borçlar
  const getUnpaidTransactions = () => {
    if (transactionForm.customer_id) {
      return unpaidReceivables.filter(r => r.customer_id === transactionForm.customer_id)
    }
    if (transactionForm.supplier_id) {
      return unpaidPayables.filter(p => p.supplier_id === transactionForm.supplier_id)
    }
    return []
  }

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="min-h-screen bg-gray-50 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Muhasebe</h1>
              <p className="text-gray-600">Alacak, borç ve kasa yönetimi</p>
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
              Kasa Geçmişi
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {/* Kasa Bakiyesi */}
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

              {/* Toplam Alacak */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">Toplam Alacak</div>
                {Object.keys(totalReceivables).length === 0 ? (
                  <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(totalReceivables).map(([currency, amount]) => (
                      <div key={currency} className="text-lg font-bold text-green-600">
                        {formatCurrency(amount, currency)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toplam Borç */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">Toplam Borç</div>
                {Object.keys(totalPayables).length === 0 ? (
                  <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(totalPayables).map(([currency, amount]) => (
                      <div key={currency} className="text-lg font-bold text-red-600">
                        {formatCurrency(amount, currency)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bu Ayki Gelir */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-sm text-emerald-100 mb-2">Bu Ayki Gelir</div>
                {Object.keys(monthlyIncome).length === 0 ? (
                  <div className="text-xl font-bold">0.00 TRY</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(monthlyIncome).map(([currency, amount]) => (
                      <div key={currency} className="text-lg font-bold">
                        {formatCurrency(amount, currency)}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-emerald-100 text-xs mt-2">
                  {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Bu Ayki Gider */}
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-sm text-rose-100 mb-2">Bu Ayki Gider</div>
                {Object.keys(monthlyExpense).length === 0 ? (
                  <div className="text-xl font-bold">0.00 TRY</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(monthlyExpense).map(([currency, amount]) => (
                      <div key={currency} className="text-lg font-bold">
                        {formatCurrency(amount, currency)}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-rose-100 text-xs mt-2">
                  {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vadesi Gelecek Alacaklar */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Vadesi Gelecek Alacaklar</h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {unpaidReceivables.slice(0, 10).map((rec) => {
                    const remaining = parseFloat(rec.amount) - parseFloat(rec.paid_amount || 0)
                    return (
                      <div key={rec.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">
                            {rec.customer?.customer_name || 'Müşteri'}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            rec.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {rec.status === 'partial' ? 'Kısmi Ödendi' : 'Ödenmedi'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Vade: {formatDate(rec.due_date)}
                          </div>
                          <div className="text-lg font-semibold text-green-600">
                            {formatCurrency(remaining, rec.currency || 'TRY')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {unpaidReceivables.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      Bekleyen alacak yok
                    </div>
                  )}
                </div>
              </div>

              {/* Vadesi Gelecek Borçlar */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Vadesi Gelecek Borçlar</h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {unpaidPayables.slice(0, 10).map((pay) => {
                    const remaining = parseFloat(pay.amount) - parseFloat(pay.paid_amount || 0)
                    return (
                      <div key={pay.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">
                            {pay.supplier?.company_name || 'Tedarikçi'}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pay.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {pay.status === 'partial' ? 'Kısmi Ödendi' : 'Ödenmedi'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Vade: {formatDate(pay.due_date)}
                          </div>
                          <div className="text-lg font-semibold text-red-600">
                            {formatCurrency(remaining, pay.currency || 'TRY')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {unpaidPayables.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      Bekleyen borç yok
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          // Kasa Geçmişi
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Kasa Hareketleri</h3>
              <p className="text-sm text-gray-600 mt-1">Toplam {allCashTransactions.length} işlem</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tür</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allCashTransactions.map((transaction) => {
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
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            transaction.transaction_type === 'income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.transaction_type === 'income' ? 'Tahsilat' : 'Ödeme'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.payment_method ? paymentMethodLabels[transaction.payment_method as keyof typeof paymentMethodLabels] || '-' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          <span className={transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.transaction_type === 'income' ? '+' : '-'}
                            {formatCurrency(parseFloat(transaction.amount), transaction.currency || 'TRY')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {allCashTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Yeni İşlem</h3>
                  <button onClick={() => { setShowTransactionModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* İşlem Modu */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İşlem Türü *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setFormMode('account')
                        setTransactionForm({...transactionForm, customer_id: '', supplier_id: '', related_account_transaction_id: ''})
                      }}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        formMode === 'account'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Cari Kayıt (Alacak/Borç)
                    </button>
                    <button
                      onClick={() => {
                        setFormMode('payment')
                        setTransactionForm({...transactionForm, customer_id: '', supplier_id: '', related_account_transaction_id: '', due_date: ''})
                      }}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        formMode === 'payment'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Ödeme/Tahsilat
                    </button>
                  </div>
                </div>

                {/* CARİ KAYIT FORMU */}
                {formMode === 'account' && (
                  <>
                    {/* Müşteri veya Tedarikçi Seçimi */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri (Alacak)</label>
                        <select
                          value={transactionForm.customer_id}
                          onChange={(e) => setTransactionForm({...transactionForm, customer_id: e.target.value, supplier_id: '', transaction_type: 'receivable'})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.customer_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi (Borç)</label>
                        <select
                          value={transactionForm.supplier_id}
                          onChange={(e) => setTransactionForm({...transactionForm, supplier_id: e.target.value, customer_id: '', transaction_type: 'payable'})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.company_name}
                            </option>
                          ))}
                        </select>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vade Günü *</label>
                        <input
                          type="date"
                          value={transactionForm.due_date}
                          onChange={(e) => setTransactionForm({...transactionForm, due_date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ÖDEME FORMU */}
                {formMode === 'payment' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri (Tahsilat)</label>
                        <select
                          value={transactionForm.customer_id}
                          onChange={(e) => setTransactionForm({...transactionForm, customer_id: e.target.value, supplier_id: '', related_account_transaction_id: ''})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.customer_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi (Ödeme)</label>
                        <select
                          value={transactionForm.supplier_id}
                          onChange={(e) => setTransactionForm({...transactionForm, supplier_id: e.target.value, customer_id: '', related_account_transaction_id: ''})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.company_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Açık Alacak/Borç Seçimi */}
                    {(transactionForm.customer_id || transactionForm.supplier_id) && getUnpaidTransactions().length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hangi {transactionForm.customer_id ? 'Alacağı' : 'Borcu'} Kapatıyorsunuz?
                        </label>
                        <select
                          value={transactionForm.related_account_transaction_id}
                          onChange={(e) => setTransactionForm({...transactionForm, related_account_transaction_id: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz (opsiyonel)</option>
                          {getUnpaidTransactions().map(txn => {
                            const remaining = parseFloat(txn.amount) - parseFloat(txn.paid_amount || 0)
                            return (
                              <option key={txn.id} value={txn.id}>
                                {formatDate(txn.due_date)} - {formatCurrency(remaining, txn.currency)} - {txn.description || 'Açıklama yok'}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )}

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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                        <input
                          type="date"
                          value={transactionForm.transaction_date}
                          onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Ortak Alanlar */}
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
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => { setShowTransactionModal(false); resetForm(); }}
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

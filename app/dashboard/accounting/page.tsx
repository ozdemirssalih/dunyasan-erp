'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  Wallet, TrendingUp, TrendingDown, Clock, AlertCircle,
  Plus, X, Save, DollarSign, Calendar, FileText
} from 'lucide-react'

export default function AccountingPage() {
  const { canCreate } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Data states
  const [cashBalance, setCashBalance] = useState(0)
  const [receivables, setReceivables] = useState(0) // Alacaklar
  const [payables, setPayables] = useState(0) // Borçlar
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [currentAccountsData, setCurrentAccountsData] = useState<any[]>([])

  // Modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // Form state
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash'
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
      // Cari hesap işlemlerini yükle
      const { data: transactions } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })
        .limit(10)

      setRecentTransactions(transactions || [])

      // Alacakları hesapla (credit - bize gelecek)
      const receivablesData = transactions?.filter(t => t.transaction_type === 'credit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
      setReceivables(receivablesData)

      // Borçları hesapla (debit - bizim ödeyeceğimiz)
      const payablesData = transactions?.filter(t => t.transaction_type === 'debit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
      setPayables(payablesData)

      // Kasa bakiyesi (alacaklar - borçlar)
      setCashBalance(receivablesData - payablesData)

      // Beklenen ödemeleri yükle (vadesi gelmemiş faturalar)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })

      setPendingPayments(invoices || [])

      // Cari hesaplar özeti
      const { data: customers } = await supabase
        .from('customer_companies')
        .select('id, customer_name')
        .eq('company_id', companyId)

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', companyId)
        .eq('is_active', true)

      const accountsData = [
        ...(customers || []).map(c => ({ ...c, type: 'customer', name: c.customer_name })),
        ...(suppliers || []).map(s => ({ ...s, type: 'supplier', name: s.company_name }))
      ]

      setCurrentAccountsData(accountsData)
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

      await supabase.from('current_account_transactions').insert({
        company_id: companyId,
        transaction_type: transactionForm.transaction_type === 'income' ? 'credit' : 'debit',
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        transaction_date: transactionForm.transaction_date,
        document_type: 'manual',
        reference_number: `MAN-${Date.now()}`,
        created_by: user?.id
      })

      setShowTransactionModal(false)
      setTransactionForm({
        transaction_type: 'income',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash'
      })
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
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
        <div className="mb-8 flex items-center justify-between">
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Kasa */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Kasa Bakiyesi</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(cashBalance)}</div>
          </div>

          {/* Alacaklar */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Toplam Alacak</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(receivables)}</div>
          </div>

          {/* Borçlar */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Toplam Borç</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(payables)}</div>
          </div>

          {/* Beklenen Ödemeler */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-1">Beklenen Ödemeler</div>
            <div className="text-2xl font-bold text-orange-600">{pendingPayments.length}</div>
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
                      {formatCurrency(parseFloat(transaction.amount))}
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
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'income'})}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        transactionForm.transaction_type === 'income'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Gelir
                    </button>
                    <button
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'expense'})}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                    placeholder="İşlem açıklaması..."
                  />
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

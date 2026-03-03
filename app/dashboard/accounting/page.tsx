'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  BarChart3, Tag, Wallet, Users, FileText, CreditCard,
  Plus, TrendingUp, TrendingDown, Calendar, DollarSign,
  Edit2, Trash2, X, Save, Search, Filter
} from 'lucide-react'

type Tab = 'dashboard' | 'categories' | 'accounts' | 'current-accounts' | 'invoices' | 'checks' | 'transactions'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  description: string | null
  color: string | null
  is_active: boolean
}

interface PaymentAccount {
  id: string
  name: string
  type: 'cash' | 'bank'
  currency: string
  current_balance: number
  iban: string | null
  bank_name: string | null
  is_active: boolean
}

interface CurrentAccount {
  id: string
  code: string
  name: string
  type: 'customer' | 'supplier'
  tax_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  current_balance: number
  is_active: boolean
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'sales' | 'purchase'
  current_account_id: string
  current_account_name: string
  invoice_date: string
  due_date: string | null
  total_amount: number
  tax_amount: number
  status: 'draft' | 'approved' | 'paid' | 'cancelled'
}

interface Check {
  id: string
  check_number: string
  check_type: 'received' | 'issued'
  current_account_id: string
  current_account_name: string
  amount: number
  due_date: string
  status: 'portfolio' | 'deposited' | 'collected' | 'bounced' | 'cancelled'
  bank_name: string | null
}

interface Transaction {
  id: string
  transaction_type: 'income' | 'expense'
  amount: number
  description: string
  transaction_date: string
  category_name: string
  account_name: string
}

export default function AccountingPage() {
  const { canCreate, canEdit, canDelete } = usePermissions()

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Data states
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [checks, setChecks] = useState<Check[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Stats
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    cashBalance: 0,
    bankBalance: 0,
    pendingInvoices: 0,
    receivables: 0,
    payables: 0
  })

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showCurrentAccountModal, setShowCurrentAccountModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // Filters
  const [periodFilter, setPeriodFilter] = useState('month') // today, week, month, year, all
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId, activeTab, periodFilter])

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profile?.company_id) {
        setCompanyId(profile.company_id)
      }
    } catch (error) {
      console.error('Error initializing:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!companyId) return

    try {
      switch (activeTab) {
        case 'dashboard':
          await loadDashboardData()
          break
        case 'categories':
          await loadCategories()
          break
        case 'accounts':
          await loadAccounts()
          break
        case 'current-accounts':
          await loadCurrentAccounts()
          break
        case 'invoices':
          await loadInvoices()
          break
        case 'checks':
          await loadChecks()
          break
        case 'transactions':
          await loadTransactions()
          break
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const loadDashboardData = async () => {
    // Load all necessary data for dashboard
    await Promise.all([
      loadCategories(),
      loadAccounts(),
      loadCurrentAccounts(),
      loadTransactions()
    ])
    calculateStats()
  }

  const loadCategories = async () => {
    const { data } = await supabase
      .from('accounting_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setCategories(data || [])
  }

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setAccounts(data || [])
  }

  const loadCurrentAccounts = async () => {
    const { data } = await supabase
      .from('current_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setCurrentAccounts(data || [])
  }

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        current_accounts(name)
      `)
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false })
      .limit(100)

    const formattedData = data?.map(inv => ({
      ...inv,
      current_account_name: inv.current_accounts?.name || 'N/A'
    })) || []

    setInvoices(formattedData)
  }

  const loadChecks = async () => {
    const { data } = await supabase
      .from('checks')
      .select(`
        *,
        current_accounts(name)
      `)
      .eq('company_id', companyId)
      .order('due_date', { ascending: false })
      .limit(100)

    const formattedData = data?.map(chk => ({
      ...chk,
      current_account_name: chk.current_accounts?.name || 'N/A'
    })) || []

    setChecks(formattedData)
  }

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('accounting_transactions')
      .select(`
        *,
        category:accounting_categories(name),
        account:payment_accounts(name)
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })
      .limit(50)

    const formattedData = data?.map(txn => ({
      id: txn.id,
      transaction_type: txn.transaction_type,
      amount: parseFloat(txn.amount),
      description: txn.description,
      transaction_date: txn.transaction_date,
      category_name: txn.category?.name || 'N/A',
      account_name: txn.account?.name || 'N/A'
    })) || []

    setTransactions(formattedData)
  }

  const calculateStats = () => {
    const income = transactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expense = transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const cash = accounts
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)

    const bank = accounts
      .filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)

    const receivables = currentAccounts
      .filter(ca => ca.type === 'customer' && parseFloat(ca.current_balance.toString()) > 0)
      .reduce((sum, ca) => sum + Math.abs(parseFloat(ca.current_balance.toString())), 0)

    const payables = currentAccounts
      .filter(ca => ca.type === 'supplier' && parseFloat(ca.current_balance.toString()) < 0)
      .reduce((sum, ca) => sum + Math.abs(parseFloat(ca.current_balance.toString())), 0)

    setStats({
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
      cashBalance: cash,
      bankBalance: bank,
      pendingInvoices: invoices.filter(inv => inv.status === 'approved').length,
      receivables,
      payables
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
    { id: 'categories' as Tab, label: 'Kategoriler', icon: Tag },
    { id: 'accounts' as Tab, label: 'Kasa & Banka', icon: Wallet },
    { id: 'current-accounts' as Tab, label: 'Cari Hesaplar', icon: Users },
    { id: 'invoices' as Tab, label: 'Faturalar', icon: FileText },
    { id: 'checks' as Tab, label: 'Çekler', icon: CreditCard },
    { id: 'transactions' as Tab, label: 'İşlemler', icon: DollarSign },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">💰 Muhasebe Yönetimi</h1>
          <p className="text-gray-400">Finansal işlemlerinizi yönetin</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800 rounded-lg p-2 mb-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Genel Bakış</h2>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                  <div className="text-sm text-green-400 mb-1">Toplam Gelir</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(stats.totalIncome)}</div>
                </div>

                <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  </div>
                  <div className="text-sm text-red-400 mb-1">Toplam Gider</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(stats.totalExpense)}</div>
                </div>

                <div className={`bg-gradient-to-br ${stats.netProfit >= 0 ? 'from-blue-500/20 to-blue-600/20 border-blue-500/30' : 'from-orange-500/20 to-orange-600/20 border-orange-500/30'} border rounded-lg p-6`}>
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className={`w-8 h-8 ${stats.netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
                  </div>
                  <div className={`text-sm ${stats.netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'} mb-1`}>
                    {stats.netProfit >= 0 ? 'Net Kar' : 'Net Zarar'}
                  </div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(Math.abs(stats.netProfit))}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Wallet className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="text-sm text-purple-400 mb-1">Toplam Bakiye</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(stats.cashBalance + stats.bankBalance)}</div>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Kasa</div>
                  <div className="text-xl font-semibold text-white">{formatCurrency(stats.cashBalance)}</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Banka</div>
                  <div className="text-xl font-semibold text-white">{formatCurrency(stats.bankBalance)}</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Alacaklar</div>
                  <div className="text-xl font-semibold text-green-400">{formatCurrency(stats.receivables)}</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Borçlar</div>
                  <div className="text-xl font-semibold text-red-400">{formatCurrency(stats.payables)}</div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Son İşlemler</h3>
                  {canCreate('accounting') && (
                    <button
                      onClick={() => setShowTransactionModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Yeni İşlem
                    </button>
                  )}
                </div>

                <div className="bg-gray-700/50 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-600/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Tarih</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Açıklama</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Kategori</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Hesap</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 10).map((txn) => (
                        <tr key={txn.id} className="border-t border-gray-600/50">
                          <td className="px-4 py-3 text-sm text-gray-300">{formatDate(txn.transaction_date)}</td>
                          <td className="px-4 py-3 text-sm text-white">{txn.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{txn.category_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{txn.account_name}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${
                            txn.transaction_type === 'income' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {txn.transaction_type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Henüz işlem bulunmuyor
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Kategoriler</h2>
                {canCreate('accounting') && (
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Kategori
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Categories */}
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Gelir Kategorileri
                  </h3>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === 'income').map((cat) => (
                      <div key={cat.id} className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#10B981' }}></div>
                          <div>
                            <div className="font-medium text-white">{cat.name}</div>
                            {cat.description && (
                              <div className="text-sm text-gray-400">{cat.description}</div>
                            )}
                          </div>
                        </div>
                        {canEdit('accounting') && (
                          <div className="flex gap-2">
                            <button className="text-gray-400 hover:text-blue-400 p-2 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDelete('accounting') && (
                              <button className="text-gray-400 hover:text-red-400 p-2 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {categories.filter(c => c.type === 'income').length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        Henüz gelir kategorisi yok
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense Categories */}
                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Gider Kategorileri
                  </h3>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === 'expense').map((cat) => (
                      <div key={cat.id} className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#EF4444' }}></div>
                          <div>
                            <div className="font-medium text-white">{cat.name}</div>
                            {cat.description && (
                              <div className="text-sm text-gray-400">{cat.description}</div>
                            )}
                          </div>
                        </div>
                        {canEdit('accounting') && (
                          <div className="flex gap-2">
                            <button className="text-gray-400 hover:text-blue-400 p-2 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDelete('accounting') && (
                              <button className="text-gray-400 hover:text-red-400 p-2 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {categories.filter(c => c.type === 'expense').length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        Henüz gider kategorisi yok
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Tabs - Placeholder */}
          {activeTab !== 'dashboard' && activeTab !== 'categories' && (
            <div className="text-center text-gray-400 py-12">
              <div className="text-lg font-medium mb-2">{tabs.find(t => t.id === activeTab)?.label}</div>
              <div className="text-sm">Bu bölüm henüz tamamlanmadı</div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  )
}

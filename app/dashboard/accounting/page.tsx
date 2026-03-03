'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  BarChart3, TrendingUp, TrendingDown, Wallet, DollarSign,
  Tag, Users, FileText, CreditCard, Calendar, Plus, Edit2,
  Trash2, X, Save, Search, Filter, ArrowUpRight, ArrowDownRight,
  Building2
} from 'lucide-react'

// ── Tab Türleri ───────────────
type Tab = 'overview' | 'transactions' | 'categories' | 'accounts' | 'customers' | 'suppliers' | 'invoices' | 'checks'

// ── Interface Tanımlamaları ───────────────
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

interface Customer {
  id: string
  customer_name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  tax_number?: string
  tax_office?: string
}

interface Supplier {
  id: string
  company_name: string
  contact_person?: string
  phone?: string
  email?: string
  tax_number?: string
  address?: string
  category?: string
  is_active: boolean
}

interface Transaction {
  id: string
  transaction_type: 'income' | 'expense'
  amount: number
  description: string
  transaction_date: string
  category_id: string
  payment_account_id: string
  category?: { name: string }
  payment_account?: { name: string }
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'sales' | 'purchase'
  customer_id?: string
  supplier_id?: string
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
  customer_id?: string
  supplier_id?: string
  amount: number
  due_date: string
  status: 'portfolio' | 'deposited' | 'collected' | 'bounced' | 'cancelled'
  bank_name: string | null
}

interface Stats {
  totalIncome: number
  totalExpense: number
  netProfit: number
  cashBalance: number
  bankBalance: number
  totalBalance: number
  totalCustomers: number
  totalSuppliers: number
  pendingInvoices: number
  portfolioChecks: number
}

export default function AccountingPage() {
  const { canCreate, canEdit, canDelete } = usePermissions()

  // ── State Yönetimi ───────────────
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Data states
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [checks, setChecks] = useState<Check[]>([])
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    cashBalance: 0,
    bankBalance: 0,
    totalBalance: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    pendingInvoices: 0,
    portfolioChecks: 0
  })

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month')
  const [searchQuery, setSearchQuery] = useState('')

  // Form states - Category
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'income' as 'income' | 'expense',
    description: '',
    color: '#3B82F6'
  })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  // Form states - Transaction
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    payment_account_id: ''
  })

  // ── useEffect Hooks ───────────────
  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (companyId) {
      loadDataForTab()
    }
  }, [companyId, activeTab, periodFilter])

  // ── Data Loading Functions ───────────────
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

  const loadDataForTab = async () => {
    if (!companyId) return

    try {
      switch (activeTab) {
        case 'overview':
          await loadOverviewData()
          break
        case 'transactions':
          await loadTransactions()
          await loadCategories()
          await loadAccounts()
          break
        case 'categories':
          await loadCategories()
          break
        case 'accounts':
          await loadAccounts()
          break
        case 'customers':
          await loadCustomers()
          break
        case 'suppliers':
          await loadSuppliers()
          break
        case 'invoices':
          await loadInvoices()
          await loadCustomers()
          await loadSuppliers()
          break
        case 'checks':
          await loadChecks()
          await loadCustomers()
          await loadSuppliers()
          break
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const loadOverviewData = async () => {
    await Promise.all([
      loadTransactions(),
      loadAccounts(),
      loadCustomers(),
      loadSuppliers(),
      loadInvoices(),
      loadChecks()
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

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .order('customer_name')

    setCustomers(data || [])
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('company_name')

    setSuppliers(data || [])
  }

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('accounting_transactions')
      .select(`
        *,
        category:accounting_categories(name),
        payment_account:payment_accounts(name)
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })
      .limit(100)

    setTransactions(data || [])
  }

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false })
      .limit(100)

    setInvoices(data || [])
  }

  const loadChecks = async () => {
    const { data } = await supabase
      .from('checks')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: false })
      .limit(100)

    setChecks(data || [])
  }

  const calculateStats = () => {
    const income = transactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)

    const expense = transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)

    const cash = accounts
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)

    const bank = accounts
      .filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)

    const pending = invoices.filter(inv => inv.status === 'approved').length
    const portfolio = checks.filter(chk => chk.status === 'portfolio').length

    setStats({
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
      cashBalance: cash,
      bankBalance: bank,
      totalBalance: cash + bank,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      pendingInvoices: pending,
      portfolioChecks: portfolio
    })
  }

  // ── CRUD Functions - Category ───────────────
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !companyId) {
      alert('Kategori adı zorunludur!')
      return
    }

    try {
      if (editingCategoryId) {
        await supabase
          .from('accounting_categories')
          .update({
            name: categoryForm.name,
            type: categoryForm.type,
            description: categoryForm.description || null,
            color: categoryForm.color
          })
          .eq('id', editingCategoryId)
      } else {
        await supabase
          .from('accounting_categories')
          .insert({
            company_id: companyId,
            name: categoryForm.name,
            type: categoryForm.type,
            description: categoryForm.description || null,
            color: categoryForm.color,
            is_active: true
          })
      }

      setShowCategoryModal(false)
      setCategoryForm({ name: '', type: 'income', description: '', color: '#3B82F6' })
      setEditingCategoryId(null)
      loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Kategori kaydedilirken hata oluştu!')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      await supabase
        .from('accounting_categories')
        .update({ is_active: false })
        .eq('id', id)

      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Kategori silinirken hata oluştu!')
    }
  }

  // ── CRUD Functions - Transaction ───────────────
  const handleSaveTransaction = async () => {
    if (!transactionForm.amount || !transactionForm.category_id || !transactionForm.payment_account_id || !companyId) {
      alert('Tüm alanları doldurunuz!')
      return
    }

    try {
      await supabase
        .from('accounting_transactions')
        .insert({
          company_id: companyId,
          transaction_type: transactionForm.transaction_type,
          amount: parseFloat(transactionForm.amount),
          description: transactionForm.description,
          transaction_date: transactionForm.transaction_date,
          category_id: transactionForm.category_id,
          payment_account_id: transactionForm.payment_account_id,
          created_by: currentUserId
        })

      // Update payment account balance
      const account = accounts.find(a => a.id === transactionForm.payment_account_id)
      if (account) {
        const amountChange = transactionForm.transaction_type === 'income'
          ? parseFloat(transactionForm.amount)
          : -parseFloat(transactionForm.amount)

        await supabase
          .from('payment_accounts')
          .update({
            current_balance: parseFloat(account.current_balance.toString()) + amountChange
          })
          .eq('id', account.id)
      }

      setShowTransactionModal(false)
      setTransactionForm({
        transaction_type: 'income',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
        category_id: '',
        payment_account_id: ''
      })
      loadOverviewData()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('İşlem kaydedilirken hata oluştu!')
    }
  }

  // ── Helper Functions ───────────────
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  // ── Tab Configuration ───────────────
  const tabs = [
    { id: 'overview' as Tab, label: 'Genel Bakış', icon: BarChart3 },
    { id: 'transactions' as Tab, label: 'İşlemler', icon: DollarSign },
    { id: 'categories' as Tab, label: 'Kategoriler', icon: Tag },
    { id: 'accounts' as Tab, label: 'Kasa & Banka', icon: Wallet },
    { id: 'customers' as Tab, label: 'Müşteriler', icon: Users },
    { id: 'suppliers' as Tab, label: 'Tedarikçiler', icon: Building2 },
    { id: 'invoices' as Tab, label: 'Faturalar', icon: FileText },
    { id: 'checks' as Tab, label: 'Çekler', icon: CreditCard },
  ]

  // ── Render Functions ───────────────
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">💰 Muhasebe</h1>
          <p className="text-gray-600">Finansal yönetim ve raporlama sistemi</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 bg-white rounded-lg p-2 shadow-sm border border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Period Filter */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Genel Bakış</h2>
                <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                  {(['today', 'week', 'month', 'year', 'all'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setPeriodFilter(period)}
                      className={`px-4 py-2 rounded font-medium transition-all ${
                        periodFilter === period
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {period === 'today' && 'Bugün'}
                      {period === 'week' && 'Hafta'}
                      {period === 'month' && 'Ay'}
                      {period === 'year' && 'Yıl'}
                      {period === 'all' && 'Tümü'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-sm text-gray-600 mb-1">Toplam Gelir</div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalIncome)}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-sm text-gray-600 mb-1">Toplam Gider</div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalExpense)}</div>
                </div>

                <div className={`bg-white border ${stats.netProfit >= 0 ? 'border-blue-200' : 'border-orange-200'} rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 ${stats.netProfit >= 0 ? 'bg-blue-100' : 'bg-orange-100'} rounded-lg`}>
                      <DollarSign className={`w-6 h-6 ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                    </div>
                  </div>
                  <div className={`text-sm ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'} mb-1`}>
                    Net {stats.netProfit >= 0 ? 'Kar' : 'Zarar'}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(Math.abs(stats.netProfit))}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Wallet className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-1">Toplam Bakiye</div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalBalance)}</div>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Kasa</div>
                  <div className="text-xl font-semibold text-gray-900">{formatCurrency(stats.cashBalance)}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Banka</div>
                  <div className="text-xl font-semibold text-gray-900">{formatCurrency(stats.bankBalance)}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Müşteriler</div>
                  <div className="text-xl font-semibold text-blue-600">{stats.totalCustomers}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Tedarikçiler</div>
                  <div className="text-xl font-semibold text-blue-600">{stats.totalSuppliers}</div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">Son İşlemler</h3>
                    {canCreate('accounting') && (
                      <button
                        onClick={() => setShowTransactionModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Yeni İşlem
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Açıklama</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kategori</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Hesap</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {transactions.slice(0, 10).map((txn) => (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600">{formatDate(txn.transaction_date)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{txn.description}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{txn.category?.name || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{txn.payment_account?.name || 'N/A'}</td>
                          <td className={`px-6 py-4 text-sm text-right font-semibold ${
                            txn.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {txn.transaction_type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(txn.amount.toString()))}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Kategoriler</h2>
                {canCreate('accounting') && (
                  <button
                    onClick={() => {
                      setEditingCategoryId(null)
                      setCategoryForm({ name: '', type: 'income', description: '', color: '#3B82F6' })
                      setShowCategoryModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Kategori
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Categories */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Gelir Kategorileri ({categories.filter(c => c.type === 'income').length})
                  </h3>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === 'income').map((cat) => (
                      <div key={cat.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cat.color || '#10B981' }}
                          />
                          <div>
                            <div className="font-medium text-gray-900">{cat.name}</div>
                            {cat.description && (
                              <div className="text-sm text-gray-600">{cat.description}</div>
                            )}
                          </div>
                        </div>
                        {canEdit('accounting') && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id)
                                setCategoryForm({
                                  name: cat.name,
                                  type: cat.type,
                                  description: cat.description || '',
                                  color: cat.color || '#3B82F6'
                                })
                                setShowCategoryModal(true)
                              }}
                              className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDelete('accounting') && (
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {categories.filter(c => c.type === 'income').length === 0 && (
                      <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        Henüz gelir kategorisi yok
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense Categories */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Gider Kategorileri ({categories.filter(c => c.type === 'expense').length})
                  </h3>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === 'expense').map((cat) => (
                      <div key={cat.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cat.color || '#EF4444' }}
                          />
                          <div>
                            <div className="font-medium text-gray-900">{cat.name}</div>
                            {cat.description && (
                              <div className="text-sm text-gray-600">{cat.description}</div>
                            )}
                          </div>
                        </div>
                        {canEdit('accounting') && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id)
                                setCategoryForm({
                                  name: cat.name,
                                  type: cat.type,
                                  description: cat.description || '',
                                  color: cat.color || '#3B82F6'
                                })
                                setShowCategoryModal(true)
                              }}
                              className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDelete('accounting') && (
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {categories.filter(c => c.type === 'expense').length === 0 && (
                      <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        Henüz gider kategorisi yok
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === 'customers' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Müşteriler</h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Müşteri Adı</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">İletişim</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefon</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{customer.contact_person || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{customer.email || '-'}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          Henüz müşteri bulunmuyor
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Tedarikçiler</h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Firma Adı</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">İletişim</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefon</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kategori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.company_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.contact_person || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.category || '-'}</td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          Henüz tedarikçi bulunmuyor
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OTHER TABS - Placeholder */}
          {!['overview', 'categories', 'customers', 'suppliers'].includes(activeTab) && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
              <div className="text-xl font-medium text-gray-600 mb-2">
                {tabs.find(t => t.id === activeTab)?.label}
              </div>
              <div className="text-sm text-gray-500">Bu bölüm yakında eklenecek</div>
            </div>
          )}
        </div>

        {/* MODALS */}
        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingCategoryId ? 'Kategori Düzenle' : 'Yeni Kategori'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCategoryModal(false)
                      setEditingCategoryId(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Adı *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Kategori adı girin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tür *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryForm({...categoryForm, type: 'income'})}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors border ${
                        categoryForm.type === 'income'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-600'
                      }`}
                    >
                      Gelir
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryForm({...categoryForm, type: 'expense'})}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors border ${
                        categoryForm.type === 'expense'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-red-600'
                      }`}
                    >
                      Gider
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Açıklama (opsiyonel)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Renk</label>
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({...categoryForm, color: e.target.value})}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategoryId(null)
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingCategoryId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
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
                  <button
                    onClick={() => setShowTransactionModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tür *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'income'})}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors border ${
                        transactionForm.transaction_type === 'income'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-600'
                      }`}
                    >
                      Gelir
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionForm({...transactionForm, transaction_type: 'expense'})}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors border ${
                        transactionForm.transaction_type === 'expense'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-red-600'
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori *</label>
                  <select
                    value={transactionForm.category_id}
                    onChange={(e) => setTransactionForm({...transactionForm, category_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Kategori seçin</option>
                    {categories
                      .filter(c => c.type === transactionForm.transaction_type)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hesap *</label>
                  <select
                    value={transactionForm.payment_account_id}
                    onChange={(e) => setTransactionForm({...transactionForm, payment_account_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Hesap seçin</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({formatCurrency(parseFloat(a.current_balance.toString()))})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Açıklama girin"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTransaction}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
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

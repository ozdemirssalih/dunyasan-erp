'use client'
import PermissionGuard from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Users, Building2, X, Eye, TrendingUp, TrendingDown } from 'lucide-react'

interface CurrentAccount {
  id: string
  type: 'customer' | 'supplier'
  code: string
  name: string
  tax_office: string | null
  tax_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  credit_limit: number
  current_balance: number
  notes: string | null
  is_active: boolean
}

export function CurrentAccountsTab() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CurrentAccount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CurrentAccount | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<CurrentAccount | null>(null)
  const [accountTransactions, setAccountTransactions] = useState<any[]>([])
  const [form, setForm] = useState({
    type: 'customer' as 'customer' | 'supplier',
    code: '',
    name: '',
    tax_office: '',
    tax_number: '',
    email: '',
    phone: '',
    address: '',
    credit_limit: 0,
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)
      await loadAccounts(profile.company_id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (companyId: string) => {
    const { data } = await supabase
      .from('current_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    setAccounts(data || [])
  }

  const loadAccountTransactions = async (accountId: string) => {
    // Fatura ve işlemleri getir
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('current_account_id', accountId)
      .order('invoice_date', { ascending: false })

    const { data: transactions } = await supabase
      .from('accounting_transactions')
      .select('*')
      .eq('current_account_id', accountId)
      .order('transaction_date', { ascending: false })

    setAccountTransactions([
      ...(invoices || []).map(inv => ({ ...inv, source: 'invoice' })),
      ...(transactions || []).map(tr => ({ ...tr, source: 'transaction' }))
    ].sort((a, b) => {
      const dateA = new Date(a.invoice_date || a.transaction_date)
      const dateB = new Date(b.invoice_date || b.transaction_date)
      return dateB.getTime() - dateA.getTime()
    }))
  }

  const handleViewDetail = async (account: CurrentAccount) => {
    setSelectedAccount(account)
    await loadAccountTransactions(account.id)
    setShowDetailModal(true)
  }

  const handleEdit = (account: CurrentAccount) => {
    setEditingAccount(account)
    setForm({
      type: account.type,
      code: account.code,
      name: account.name,
      tax_office: account.tax_office || '',
      tax_number: account.tax_number || '',
      email: account.email || '',
      phone: account.phone || '',
      address: account.address || '',
      credit_limit: parseFloat(account.credit_limit.toString()),
      notes: account.notes || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu cari hesabı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('current_accounts')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadAccounts(companyId!)
      alert('Cari hesap silindi!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingAccount) {
        // Update
        const { error } = await supabase
          .from('current_accounts')
          .update({
            type: form.type,
            code: form.code,
            name: form.name,
            tax_office: form.tax_office || null,
            tax_number: form.tax_number || null,
            email: form.email || null,
            phone: form.phone || null,
            address: form.address || null,
            credit_limit: form.credit_limit,
            notes: form.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('current_accounts')
          .insert({
            company_id: companyId,
            type: form.type,
            code: form.code,
            name: form.name,
            tax_office: form.tax_office || null,
            tax_number: form.tax_number || null,
            email: form.email || null,
            phone: form.phone || null,
            address: form.address || null,
            credit_limit: form.credit_limit,
            current_balance: 0,
            notes: form.notes || null,
            is_active: true,
          })

        if (error) throw error
      }

      setShowModal(false)
      setEditingAccount(null)
      setForm({
        type: 'customer',
        code: '',
        name: '',
        tax_office: '',
        tax_number: '',
        email: '',
        phone: '',
        address: '',
        credit_limit: 0,
        notes: '',
      })
      await loadAccounts(companyId)
      alert(editingAccount ? 'Cari hesap güncellendi!' : 'Cari hesap oluşturuldu!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
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

  const customers = accounts.filter(a => a.type === 'customer' && a.is_active)
  const suppliers = accounts.filter(a => a.type === 'supplier' && a.is_active)

  const totalReceivables = customers.reduce((sum, a) => {
    const balance = parseFloat(a.current_balance.toString())
    return balance > 0 ? sum + balance : sum
  }, 0)

  const totalPayables = suppliers.reduce((sum, a) => {
    const balance = parseFloat(a.current_balance.toString())
    return balance < 0 ? sum + Math.abs(balance) : sum
  }, 0)

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
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cari Hesaplar</h1>
            <p className="text-gray-600 mt-1">Müşteri ve tedarikçi hesaplarını yönetin</p>
          </div>
          <button
            onClick={() => {
              setEditingAccount(null)
              setForm({
                type: 'customer',
                code: '',
                name: '',
                tax_office: '',
                tax_number: '',
                email: '',
                phone: '',
                address: '',
                credit_limit: 0,
                notes: '',
              })
              setShowModal(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-5 h-5" />
            Yeni Cari Hesap
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <Users className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{customers.length}</div>
            <div className="text-blue-100 text-sm font-medium">Müşteri</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingUp className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalReceivables)}</div>
            <div className="text-green-100 text-sm font-medium">Toplam Alacak</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <Building2 className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{suppliers.length}</div>
            <div className="text-purple-100 text-sm font-medium">Tedarikçi</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingDown className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalPayables)}</div>
            <div className="text-red-100 text-sm font-medium">Toplam Borç</div>
          </div>
        </div>

        {/* Customers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Müşteriler
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kod</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Müşteri Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vergi No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Telefon</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Bakiye</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.length > 0 ? (
                  customers.map((account) => {
                    const balance = parseFloat(account.current_balance.toString())
                    return (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{account.code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{account.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{account.tax_number || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{account.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right">
                          <span className={`font-bold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleViewDetail(account)}
                              className="text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-50 rounded transition-colors"
                              title="Detayları Gör"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <PermissionGuard module="accounting" permission="edit">
                              <button
                                onClick={() => handleEdit(account)}
                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <PermissionGuard module="accounting" permission="delete">
                                <button
                                  onClick={() => handleDelete(account.id)}
                                  className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Henüz müşteri kaydı yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suppliers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-purple-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Tedarikçiler
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kod</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tedarikçi Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vergi No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Telefon</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Bakiye</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.length > 0 ? (
                  suppliers.map((account) => {
                    const balance = parseFloat(account.current_balance.toString())
                    return (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{account.code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{account.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{account.tax_number || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{account.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right">
                          <span className={`font-bold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleViewDetail(account)}
                              className="text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-50 rounded transition-colors"
                              title="Detayları Gör"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <PermissionGuard module="accounting" permission="edit">
                              <button
                                onClick={() => handleEdit(account)}
                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <PermissionGuard module="accounting" permission="delete">
                                <button
                                  onClick={() => handleDelete(account.id)}
                                  className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Henüz tedarikçi kaydı yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  {editingAccount ? 'Cari Hesap Düzenle' : 'Yeni Cari Hesap'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tip *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'customer' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'customer'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      👤 Müşteri
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'supplier' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'supplier'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🏢 Tedarikçi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Kodu *</label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      placeholder="C001, T001"
                      required
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ünvan/Adı *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Firma/Kişi adı"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Tax Office */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vergi Dairesi</label>
                    <input
                      type="text"
                      value={form.tax_office}
                      onChange={(e) => setForm({ ...form, tax_office: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Vergi dairesi"
                    />
                  </div>

                  {/* Tax Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vergi/TC No</label>
                    <input
                      type="text"
                      value={form.tax_number}
                      onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Vergi veya TC kimlik no"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">E-posta</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ornek@email.com"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Telefon</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0555 555 55 55"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Tam adres..."
                  />
                </div>

                {/* Credit Limit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kredi Limiti (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.credit_limit}
                    onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Ek notlar..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    {editingAccount ? 'Güncelle' : 'Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedAccount.name}</h3>
                  <p className="text-purple-100 text-sm">Cari Kod: {selectedAccount.code}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Account Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Bakiye</p>
                    <p className={`text-2xl font-bold ${parseFloat(selectedAccount.current_balance.toString()) > 0 ? 'text-green-600' : parseFloat(selectedAccount.current_balance.toString()) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatCurrency(parseFloat(selectedAccount.current_balance.toString()))}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Kredi Limiti</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(parseFloat(selectedAccount.credit_limit.toString()))}
                    </p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">İletişim Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Vergi Dairesi:</span>
                      <span className="ml-2 font-medium">{selectedAccount.tax_office || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Vergi No:</span>
                      <span className="ml-2 font-medium">{selectedAccount.tax_number || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">E-posta:</span>
                      <span className="ml-2 font-medium">{selectedAccount.email || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Telefon:</span>
                      <span className="ml-2 font-medium">{selectedAccount.phone || '-'}</span>
                    </div>
                    {selectedAccount.address && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Adres:</span>
                        <span className="ml-2 font-medium">{selectedAccount.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transactions */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Hesap Hareketleri</h4>
                  {accountTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tarih</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Tip</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Açıklama</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {accountTransactions.slice(0, 10).map((tr, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{formatDate(tr.invoice_date || tr.transaction_date)}</td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  tr.source === 'invoice' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {tr.source === 'invoice' ? 'Fatura' : 'İşlem'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm">{tr.description || tr.invoice_number || '-'}</td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                {formatCurrency(parseFloat(tr.total_amount || tr.amount || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">Henüz hareket yok</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

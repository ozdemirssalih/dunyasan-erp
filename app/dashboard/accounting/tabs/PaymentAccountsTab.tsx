'use client'
import PermissionGuard from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Wallet, CreditCard, X, ArrowRightLeft } from 'lucide-react'

interface PaymentAccount {
  id: string
  name: string
  type: 'cash' | 'bank'
  currency: string
  current_balance: number
  bank_name: string | null
  iban: string | null
  account_number: string | null
  description: string | null
  is_active: boolean
}

export function PaymentAccountsTab() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank',
    currency: 'TRY',
    current_balance: 0,
    bank_name: '',
    iban: '',
    account_number: '',
    description: '',
  })
  const [transferForm, setTransferForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    description: '',
    transfer_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadData()
  }, [])

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
      await loadAccounts(profile.company_id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (companyId: string) => {
    const { data } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    setAccounts(data || [])
  }

  const handleEdit = (account: PaymentAccount) => {
    setEditingAccount(account)
    setForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      current_balance: parseFloat(account.current_balance.toString()),
      bank_name: account.bank_name || '',
      iban: account.iban || '',
      account_number: account.account_number || '',
      description: account.description || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu hesabı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('payment_accounts')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadAccounts(companyId!)
      alert('Hesap silindi!')
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
          .from('payment_accounts')
          .update({
            name: form.name,
            type: form.type,
            currency: form.currency,
            current_balance: form.current_balance,
            bank_name: form.bank_name || null,
            iban: form.iban || null,
            account_number: form.account_number || null,
            description: form.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('payment_accounts')
          .insert({
            company_id: companyId,
            name: form.name,
            type: form.type,
            currency: form.currency,
            current_balance: form.current_balance,
            bank_name: form.bank_name || null,
            iban: form.iban || null,
            account_number: form.account_number || null,
            description: form.description || null,
            is_active: true,
          })

        if (error) throw error
      }

      setShowModal(false)
      setEditingAccount(null)
      setForm({
        name: '',
        type: 'cash',
        currency: 'TRY',
        current_balance: 0,
        bank_name: '',
        iban: '',
        account_number: '',
        description: '',
      })
      await loadAccounts(companyId)
      alert(editingAccount ? 'Hesap güncellendi!' : 'Hesap oluşturuldu!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    if (transferForm.from_account_id === transferForm.to_account_id) {
      alert('Kaynak ve hedef hesap aynı olamaz!')
      return
    }

    try {
      // Transfer kaydı oluştur
      const { error: transferError } = await supabase
        .from('account_transfers')
        .insert({
          company_id: companyId,
          from_account_id: transferForm.from_account_id,
          to_account_id: transferForm.to_account_id,
          amount: transferForm.amount,
          transfer_date: transferForm.transfer_date,
          description: transferForm.description || null,
          created_by: currentUserId,
        })

      if (transferError) throw transferError

      // Kaynak hesaptan düş
      const fromAccount = accounts.find(a => a.id === transferForm.from_account_id)
      if (fromAccount) {
        await supabase
          .from('payment_accounts')
          .update({
            current_balance: parseFloat(fromAccount.current_balance.toString()) - transferForm.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transferForm.from_account_id)
      }

      // Hedef hesaba ekle
      const toAccount = accounts.find(a => a.id === transferForm.to_account_id)
      if (toAccount) {
        await supabase
          .from('payment_accounts')
          .update({
            current_balance: parseFloat(toAccount.current_balance.toString()) + transferForm.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transferForm.to_account_id)
      }

      setShowTransferModal(false)
      setTransferForm({
        from_account_id: '',
        to_account_id: '',
        amount: 0,
        description: '',
        transfer_date: new Date().toISOString().split('T')[0],
      })
      await loadAccounts(companyId)
      alert('Transfer başarılı!')
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

  const cashAccounts = accounts.filter(a => a.type === 'cash' && a.is_active)
  const bankAccounts = accounts.filter(a => a.type === 'bank' && a.is_active)
  const totalCash = cashAccounts.reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)
  const totalBank = bankAccounts.reduce((sum, a) => sum + parseFloat(a.current_balance.toString()), 0)

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
            <h1 className="text-3xl font-bold text-gray-900">Kasa & Banka Hesapları</h1>
            <p className="text-gray-600 mt-1">Nakit ve banka hesaplarınızı yönetin</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTransferModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <ArrowRightLeft className="w-5 h-5" />
              Transfer
            </button>
            <button
              onClick={() => {
                setEditingAccount(null)
                setForm({
                  name: '',
                  type: 'cash',
                  currency: 'TRY',
                  current_balance: 0,
                  bank_name: '',
                  iban: '',
                  account_number: '',
                  description: '',
                })
                setShowModal(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              Yeni Hesap
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <Wallet className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalCash)}</div>
            <div className="text-green-100 text-sm font-medium">Toplam Kasa</div>
            <div className="text-xs text-green-100 mt-2">{cashAccounts.length} hesap</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <CreditCard className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalBank)}</div>
            <div className="text-blue-100 text-sm font-medium">Toplam Banka</div>
            <div className="text-xs text-blue-100 mt-2">{bankAccounts.length} hesap</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <ArrowRightLeft className="w-7 h-7" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalCash + totalBank)}</div>
            <div className="text-purple-100 text-sm font-medium">Toplam Bakiye</div>
            <div className="text-xs text-purple-100 mt-2">{accounts.filter(a => a.is_active).length} aktif hesap</div>
          </div>
        </div>

        {/* Cash Accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-green-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Kasa Hesapları
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hesap Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Bakiye</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cashAccounts.length > 0 ? (
                  cashAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{account.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{account.description || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(parseFloat(account.current_balance.toString()))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGuard module="accounting" permission="edit">
                          <div className="flex justify-end gap-2">
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Henüz kasa hesabı yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Banka Hesapları
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hesap Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Banka</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">IBAN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hesap No</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Bakiye</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bankAccounts.length > 0 ? (
                  bankAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{account.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{account.bank_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{account.iban || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{account.account_number || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(parseFloat(account.current_balance.toString()))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGuard module="accounting" permission="edit">
                          <div className="flex justify-end gap-2">
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Henüz banka hesabı yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Account Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  {editingAccount ? 'Hesap Düzenle' : 'Yeni Hesap'}
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
                      onClick={() => setForm({ ...form, type: 'cash' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'cash'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      💵 Kasa
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'bank' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'bank'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🏦 Banka
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hesap Adı *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Ana Kasa, İş Bankası Vadesiz"
                    required
                  />
                </div>

                {/* Balance */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Başlangıç Bakiyesi (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.current_balance}
                    onChange={(e) => setForm({ ...form, current_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Bank-specific fields */}
                {form.type === 'bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Banka Adı</label>
                      <input
                        type="text"
                        value={form.bank_name}
                        onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Örn: İş Bankası, Garanti BBVA"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">IBAN</label>
                      <input
                        type="text"
                        value={form.iban}
                        onChange={(e) => setForm({ ...form, iban: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Hesap Numarası</label>
                      <input
                        type="text"
                        value={form.account_number}
                        onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Hesap numarası"
                      />
                    </div>
                  </>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Hesap açıklaması..."
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

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Hesaplar Arası Transfer</h3>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransfer} className="p-6 space-y-4">
                {/* From Account */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kaynak Hesap *</label>
                  <select
                    value={transferForm.from_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="">Hesap seçin...</option>
                    {accounts.filter(a => a.is_active).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'cash' ? 'Kasa' : 'Banka'}) - {formatCurrency(parseFloat(acc.current_balance.toString()))}
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Account */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hedef Hesap *</label>
                  <select
                    value={transferForm.to_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="">Hesap seçin...</option>
                    {accounts.filter(a => a.is_active).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type === 'cash' ? 'Kasa' : 'Banka'}) - {formatCurrency(parseFloat(acc.current_balance.toString()))}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tutar (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tarih *</label>
                  <input
                    type="date"
                    value={transferForm.transfer_date}
                    onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={transferForm.description}
                    onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Transfer açıklaması..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Transfer Yap
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  )
}

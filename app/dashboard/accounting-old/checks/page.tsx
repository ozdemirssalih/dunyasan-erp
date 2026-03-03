'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { CreditCard, Plus, X, Save, Building2, TrendingUp, AlertCircle, ArrowRightLeft } from 'lucide-react'

interface Check {
  id: string
  check_type: 'received' | 'issued'
  current_account_id: string
  current_accounts: {
    code: string
    name: string
    type: string
  }
  check_number: string
  bank_name: string
  branch_name: string
  check_date: string
  due_date: string
  amount: number
  status: 'portfolio' | 'deposited' | 'collected' | 'bounced' | 'endorsed' | 'cancelled'
  collection_date: string | null
  description: string
  created_at: string
}

interface CurrentAccount {
  id: string
  code: string
  name: string
  type: 'customer' | 'supplier'
}

interface PaymentAccount {
  id: string
  name: string
  account_type: 'cash' | 'bank'
}

export default function ChecksPage() {
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState<Check[]>([])
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])

  // Tab state
  const [activeTab, setActiveTab] = useState<'received' | 'issued'>('received')

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null)
  const [actionType, setActionType] = useState<'deposit' | 'collect' | 'endorse' | 'bounce'>('collect')

  // Form state
  const [formData, setFormData] = useState({
    current_account_id: '',
    check_number: '',
    bank_name: '',
    branch_name: '',
    branch_code: '',
    account_number: '',
    check_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: 0,
    description: ''
  })

  // Action form state
  const [actionData, setActionData] = useState({
    payment_account_id: '',
    collection_date: new Date().toISOString().split('T')[0],
    endorsed_to: '',
    endorsed_date: new Date().toISOString().split('T')[0],
    description: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load checks
      const { data: checksData } = await supabase
        .from('checks')
        .select(`
          *,
          current_accounts (
            code,
            name,
            type
          )
        `)
        .order('due_date', { ascending: true })

      setChecks(checksData || [])

      // Load current accounts
      const { data: accountsData } = await supabase
        .from('current_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .order('name')

      setCurrentAccounts(accountsData || [])

      // Load payment accounts (banks)
      const { data: paymentsData } = await supabase
        .from('payment_accounts')
        .select('id, name, account_type')
        .eq('is_active', true)
        .order('name')

      setPaymentAccounts(paymentsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCheck = async () => {
    if (!formData.current_account_id || !formData.check_number || !formData.bank_name || !formData.due_date) {
      alert('Lütfen tüm zorunlu alanları doldurun!')
      return
    }

    try {
      await supabase.from('checks').insert({
        check_type: activeTab,
        current_account_id: formData.current_account_id,
        check_number: formData.check_number,
        bank_name: formData.bank_name,
        branch_name: formData.branch_name,
        branch_code: formData.branch_code,
        account_number: formData.account_number,
        check_date: formData.check_date,
        due_date: formData.due_date,
        amount: formData.amount,
        status: 'portfolio',
        description: formData.description
      })

      alert('✅ Çek başarıyla eklendi!')
      setShowAddModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error saving check:', error)
      alert(`❌ Hata: ${error.message}`)
    }
  }

  const handleCheckAction = async () => {
    if (!selectedCheck) return

    try {
      let updateData: any = {}

      switch (actionType) {
        case 'deposit':
          updateData = {
            status: 'deposited',
            payment_account_id: actionData.payment_account_id,
            collection_date: actionData.collection_date
          }
          break

        case 'collect':
          updateData = {
            status: 'collected',
            payment_account_id: actionData.payment_account_id,
            collection_date: actionData.collection_date
          }

          // Update payment account balance
          if (actionData.payment_account_id) {
            const { data: account } = await supabase
              .from('payment_accounts')
              .select('current_balance')
              .eq('id', actionData.payment_account_id)
              .single()

            if (account) {
              await supabase
                .from('payment_accounts')
                .update({
                  current_balance: parseFloat(account.current_balance.toString()) + selectedCheck.amount
                })
                .eq('id', actionData.payment_account_id)
            }
          }
          break

        case 'endorse':
          updateData = {
            status: 'endorsed',
            endorsed_to: actionData.endorsed_to,
            endorsed_date: actionData.endorsed_date
          }
          break

        case 'bounce':
          updateData = {
            status: 'bounced'
          }
          break
      }

      await supabase
        .from('checks')
        .update(updateData)
        .eq('id', selectedCheck.id)

      alert('✅ İşlem başarıyla gerçekleştirildi!')
      setShowActionModal(false)
      setSelectedCheck(null)
      loadData()
    } catch (error: any) {
      console.error('Error processing check action:', error)
      alert(`❌ Hata: ${error.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      current_account_id: '',
      check_number: '',
      bank_name: '',
      branch_name: '',
      branch_code: '',
      account_number: '',
      check_date: new Date().toISOString().split('T')[0],
      due_date: '',
      amount: 0,
      description: ''
    })
  }

  const openActionModal = (check: Check, action: typeof actionType) => {
    setSelectedCheck(check)
    setActionType(action)
    setActionData({
      payment_account_id: '',
      collection_date: new Date().toISOString().split('T')[0],
      endorsed_to: '',
      endorsed_date: new Date().toISOString().split('T')[0],
      description: ''
    })
    setShowActionModal(true)
  }

  const filteredChecks = checks.filter(c => c.check_type === activeTab)

  // Calculate statistics
  const stats = {
    portfolio: filteredChecks.filter(c => c.status === 'portfolio').reduce((sum, c) => sum + c.amount, 0),
    deposited: filteredChecks.filter(c => c.status === 'deposited').reduce((sum, c) => sum + c.amount, 0),
    collected: filteredChecks.filter(c => c.status === 'collected').reduce((sum, c) => sum + c.amount, 0),
    bounced: filteredChecks.filter(c => c.status === 'bounced').reduce((sum, c) => sum + c.amount, 0)
  }

  const statusLabels: Record<Check['status'], string> = {
    portfolio: 'Portföyde',
    deposited: 'Bankaya Verildi',
    collected: 'Tahsil Edildi',
    bounced: 'Karşılıksız',
    endorsed: 'Ciro Edildi',
    cancelled: 'İptal'
  }

  const statusColors: Record<Check['status'], string> = {
    portfolio: 'bg-blue-500/20 text-blue-400',
    deposited: 'bg-yellow-500/20 text-yellow-400',
    collected: 'bg-green-500/20 text-green-400',
    bounced: 'bg-red-500/20 text-red-400',
    endorsed: 'bg-purple-500/20 text-purple-400',
    cancelled: 'bg-gray-500/20 text-gray-400'
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Yükleniyor...</div>
  }

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Çek Yönetimi</h1>
            <p className="text-gray-400">Alınan ve verilen çekleri yönetin</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Çek
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('received')}
            className={`flex-1 py-4 px-6 rounded-lg border-2 transition-colors ${
              activeTab === 'received'
                ? 'border-green-500 bg-green-500/20 text-green-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="font-medium text-lg">Alınan Çekler</div>
            <div className="text-sm mt-1">Müşterilerden</div>
          </button>
          <button
            onClick={() => setActiveTab('issued')}
            className={`flex-1 py-4 px-6 rounded-lg border-2 transition-colors ${
              activeTab === 'issued'
                ? 'border-red-500 bg-red-500/20 text-red-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="font-medium text-lg">Verilen Çekler</div>
            <div className="text-sm mt-1">Tedarikçilere</div>
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 text-sm">Portföyde</span>
              <CreditCard className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.portfolio.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 text-sm">Bankaya Verildi</span>
              <Building2 className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.deposited.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm">Tahsil Edildi</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.collected.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          </div>

          <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 text-sm">Karşılıksız</span>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.bounced.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          </div>
        </div>

        {/* Checks List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Çek No</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cari Hesap</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Banka</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Çek Tarihi</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Vade</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Tutar</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Durum</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredChecks.map(check => {
                const isOverdue = new Date(check.due_date) < new Date() && check.status === 'portfolio'
                return (
                  <tr key={check.id} className={`hover:bg-gray-750 ${isOverdue ? 'bg-red-500/10' : ''}`}>
                    <td className="px-4 py-3 text-sm text-white font-medium">{check.check_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {check.current_accounts?.code} - {check.current_accounts?.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {check.bank_name}
                      {check.branch_name && <div className="text-xs text-gray-500">{check.branch_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(check.check_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className={isOverdue ? 'text-red-400 font-medium' : 'text-gray-400'}>
                        {new Date(check.due_date).toLocaleDateString('tr-TR')}
                      </div>
                      {isOverdue && <div className="text-xs text-red-400">Vadesi geçti!</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white text-right font-medium">
                      {check.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusColors[check.status]}`}>
                        {statusLabels[check.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {check.status === 'portfolio' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openActionModal(check, 'deposit')}
                            className="text-yellow-400 hover:text-yellow-300 text-xs"
                          >
                            Bankaya Ver
                          </button>
                          <button
                            onClick={() => openActionModal(check, 'collect')}
                            className="text-green-400 hover:text-green-300 text-xs"
                          >
                            Tahsil Et
                          </button>
                          <button
                            onClick={() => openActionModal(check, 'endorse')}
                            className="text-purple-400 hover:text-purple-300 text-xs"
                          >
                            Ciro Et
                          </button>
                        </div>
                      )}
                      {check.status === 'deposited' && (
                        <button
                          onClick={() => openActionModal(check, 'collect')}
                          className="text-green-400 hover:text-green-300 text-xs"
                        >
                          Tahsil Et
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredChecks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Henüz çek bulunmuyor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Check Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Yeni Çek - {activeTab === 'received' ? 'Alınan' : 'Verilen'}
                </h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {activeTab === 'received' ? 'Müşteri' : 'Tedarikçi'}
                    </label>
                    <select
                      value={formData.current_account_id}
                      onChange={(e) => setFormData({ ...formData, current_account_id: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Seçiniz...</option>
                      {currentAccounts
                        .filter(acc => activeTab === 'received' ? acc.type === 'customer' : acc.type === 'supplier')
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Çek Numarası *</label>
                    <input
                      type="text"
                      value={formData.check_number}
                      onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      placeholder="Örn: 123456"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Banka Adı *</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      placeholder="Örn: Ziraat Bankası"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Şube Adı</label>
                    <input
                      type="text"
                      value={formData.branch_name}
                      onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      placeholder="Örn: Kadıköy Şubesi"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Şube Kodu</label>
                    <input
                      type="text"
                      value={formData.branch_code}
                      onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      placeholder="Örn: 1234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Çek Tarihi</label>
                    <input
                      type="date"
                      value={formData.check_date}
                      onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vade Tarihi *</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tutar *</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      rows={2}
                      placeholder="Çek hakkında açıklama..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveCheck}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Modal */}
        {showActionModal && selectedCheck && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-md">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {actionType === 'deposit' && 'Çeki Bankaya Ver'}
                  {actionType === 'collect' && 'Çeki Tahsil Et'}
                  {actionType === 'endorse' && 'Çeki Ciro Et'}
                  {actionType === 'bounce' && 'Karşılıksız İşle'}
                </h2>
                <button onClick={() => setShowActionModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-400">Çek No: {selectedCheck.check_number}</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedCheck.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                </div>

                <div className="space-y-4">
                  {(actionType === 'deposit' || actionType === 'collect') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Banka Hesabı *
                        </label>
                        <select
                          value={actionData.payment_account_id}
                          onChange={(e) => setActionData({ ...actionData, payment_account_id: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                        >
                          <option value="">Seçiniz...</option>
                          {paymentAccounts
                            .filter(pa => pa.account_type === 'bank')
                            .map(pa => (
                              <option key={pa.id} value={pa.id}>{pa.name}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {actionType === 'deposit' ? 'Bankaya Verilme Tarihi' : 'Tahsil Tarihi'} *
                        </label>
                        <input
                          type="date"
                          value={actionData.collection_date}
                          onChange={(e) => setActionData({ ...actionData, collection_date: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                    </>
                  )}

                  {actionType === 'endorse' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Ciro Edilecek Cari Hesap *
                        </label>
                        <select
                          value={actionData.endorsed_to}
                          onChange={(e) => setActionData({ ...actionData, endorsed_to: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                        >
                          <option value="">Seçiniz...</option>
                          {currentAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Ciro Tarihi *</label>
                        <input
                          type="date"
                          value={actionData.endorsed_date}
                          onChange={(e) => setActionData({ ...actionData, endorsed_date: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowActionModal(false)}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleCheckAction}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

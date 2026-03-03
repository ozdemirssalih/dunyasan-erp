'use client'
import PermissionGuard from '@/components/PermissionGuard'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { FileText, Plus, Trash2, Save, X, Search, Calendar } from 'lucide-react'

interface WarehouseItem {
  id: string
  code: string
  name: string
  unit: string
  sales_price?: number
  purchase_price?: number
}

interface CurrentAccount {
  id: string
  code: string
  name: string
  type: 'customer' | 'supplier'
}

interface InvoiceItem {
  temp_id: string
  item_id: string
  item_code: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  discount_percent: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  line_total: number
}

interface Invoice {
  id: string
  document_type: string
  transaction_type: 'sales' | 'purchase'
  document_series: string
  document_number: number
  document_date: string
  due_date: string | null
  current_account_id: string
  current_accounts: CurrentAccount
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_status: string
  paid_amount: number
  remaining_amount: number
  description: string
  created_at: string
}

export function InvoicesTab() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  // Form state
  const [showModal, setShowModal] = useState(false)
  const [transactionType, setTransactionType] = useState<'sales' | 'purchase'>('sales')
  const [formData, setFormData] = useState({
    current_account_id: '',
    document_series: 'A',
    document_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_type: 'cash' as 'cash' | 'check' | 'promissory_note' | 'credit_card' | 'bank_transfer' | 'open_account',
    description: ''
  })

  // Items state
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([])

  // Totals
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  })

  // Çek/Senet modal state
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [checkData, setCheckData] = useState({
    check_number: '',
    bank_name: '',
    branch_name: '',
    check_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    calculateTotals()
  }, [items])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load invoices
      const { data: invoicesData } = await supabase
        .from('documents')
        .select(`
          *,
          current_accounts (
            id,
            code,
            name,
            type
          )
        `)
        .eq('document_type', 'invoice')
        .order('created_at', { ascending: false })

      setInvoices(invoicesData || [])

      // Load warehouse items
      const { data: itemsData } = await supabase
        .from('warehouse_items')
        .select('id, code, name, unit, sales_price, purchase_price')
        .eq('is_active', true)
        .order('name')

      setWarehouseItems(itemsData || [])

      // Load current accounts
      const { data: accountsData } = await supabase
        .from('current_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .order('name')

      setCurrentAccounts(accountsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price
      return sum + itemSubtotal
    }, 0)

    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0)
    const grandTotal = items.reduce((sum, item) => sum + item.line_total, 0)

    setTotals({ subtotal, totalDiscount, totalTax, grandTotal })
  }

  const addItem = () => {
    const newItem: InvoiceItem = {
      temp_id: Date.now().toString(),
      item_id: '',
      item_code: '',
      item_name: '',
      quantity: 1,
      unit: 'Adet',
      unit_price: 0,
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: 20,
      tax_amount: 0,
      line_total: 0
    }
    setItems([...items, newItem])
  }

  const removeItem = (tempId: string) => {
    setItems(items.filter(item => item.temp_id !== tempId))
  }

  const updateItem = (tempId: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.temp_id !== tempId) return item

      const updated = { ...item, [field]: value }

      // If item selected, update details
      if (field === 'item_id' && value) {
        const warehouseItem = warehouseItems.find(wi => wi.id === value)
        if (warehouseItem) {
          updated.item_code = warehouseItem.code
          updated.item_name = warehouseItem.name
          updated.unit = warehouseItem.unit || 'Adet'
          updated.unit_price = transactionType === 'sales'
            ? (warehouseItem.sales_price || 0)
            : (warehouseItem.purchase_price || 0)
        }
      }

      // Calculate line total
      const itemSubtotal = updated.quantity * updated.unit_price
      updated.discount_amount = itemSubtotal * (updated.discount_percent / 100)
      const afterDiscount = itemSubtotal - updated.discount_amount
      updated.tax_amount = afterDiscount * (updated.tax_percent / 100)
      updated.line_total = afterDiscount + updated.tax_amount

      return updated
    }))
  }

  const handleSave = async () => {
    if (!formData.current_account_id || items.length === 0) {
      alert('Lütfen cari hesap seçin ve en az bir ürün ekleyin!')
      return
    }

    try {
      // Get next document number
      const { data: lastDoc } = await supabase
        .from('documents')
        .select('document_number')
        .eq('document_type', 'invoice')
        .eq('transaction_type', transactionType)
        .eq('document_series', formData.document_series)
        .order('document_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = (lastDoc?.document_number || 0) + 1

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('documents')
        .insert({
          document_type: 'invoice',
          transaction_type: transactionType,
          current_account_id: formData.current_account_id,
          document_series: formData.document_series,
          document_number: nextNumber,
          document_date: formData.document_date,
          due_date: formData.due_date || null,
          subtotal: totals.subtotal,
          discount_amount: totals.totalDiscount,
          tax_amount: totals.totalTax,
          total_amount: totals.grandTotal,
          payment_status: formData.payment_type === 'cash' ? 'paid' : 'unpaid',
          paid_amount: formData.payment_type === 'cash' ? totals.grandTotal : 0,
          remaining_amount: formData.payment_type === 'cash' ? 0 : totals.grandTotal,
          description: formData.description
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice items
      const invoiceItems = items.map(item => ({
        document_id: invoice.id,
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        line_total: item.line_total
      }))

      await supabase.from('document_items').insert(invoiceItems)

      // Update current account balance
      const { data: currentAccount } = await supabase
        .from('current_accounts')
        .select('current_balance')
        .eq('id', formData.current_account_id)
        .single()

      if (currentAccount) {
        const balanceChange = transactionType === 'sales'
          ? totals.grandTotal  // Satış: Alacak (+)
          : -totals.grandTotal // Alış: Borç (-)

        await supabase
          .from('current_accounts')
          .update({
            current_balance: parseFloat(currentAccount.current_balance.toString()) + balanceChange
          })
          .eq('id', formData.current_account_id)
      }

      // If cash payment, create payment and update payment account
      if (formData.payment_type === 'cash') {
        // TODO: Payment account selection
        // For now, just create payment record
        await supabase.from('payments').insert({
          document_id: invoice.id,
          current_account_id: formData.current_account_id,
          payment_type: 'cash',
          payment_date: formData.document_date,
          amount: totals.grandTotal
        })
      }

      // If check payment, show check modal
      if (formData.payment_type === 'check') {
        setCheckData({ ...checkData, amount: totals.grandTotal })
        setShowCheckModal(true)
        // Will save check after modal
      }

      alert(`✅ Fatura başarıyla oluşturuldu! No: ${formData.document_series}${nextNumber}`)
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error saving invoice:', error)
      alert(`❌ Hata: ${error.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      current_account_id: '',
      document_series: 'A',
      document_date: new Date().toISOString().split('T')[0],
      due_date: '',
      payment_type: 'cash',
      description: ''
    })
    setItems([])
    setTotals({ subtotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0 })
  }

  const filteredAccounts = currentAccounts.filter(acc =>
    transactionType === 'sales' ? acc.type === 'customer' : acc.type === 'supplier'
  )

  if (loading) {
    return <div className="p-8 text-gray-400">Yükleniyor...</div>
  }

  return (
    <div className="p-8">
      {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Faturalar</h1>
            <p className="text-gray-400">Satış ve alış faturalarını yönetin</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Fatura
          </button>
        </div>

        {/* Invoices List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Fatura No</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Tip</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cari Hesap</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Tarih</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Vade</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Tutar</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {invoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-gray-750">
                  <td className="px-4 py-3 text-sm text-white">
                    {invoice.document_series}{invoice.document_number}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      invoice.transaction_type === 'sales'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {invoice.transaction_type === 'sales' ? 'Satış' : 'Alış'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.current_accounts?.code} - {invoice.current_accounts?.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(invoice.document_date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right font-medium">
                    {invoice.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      invoice.payment_status === 'paid'
                        ? 'bg-green-500/20 text-green-400'
                        : invoice.payment_status === 'partial'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {invoice.payment_status === 'paid' ? 'Ödendi' :
                       invoice.payment_status === 'partial' ? 'Kısmi' : 'Ödenmedi'}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Henüz fatura bulunmuyor
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Invoice Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
                <h2 className="text-xl font-bold text-white">Yeni Fatura</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Transaction Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fatura Tipi</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTransactionType('sales')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                        transactionType === 'sales'
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : 'border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium">Satış Faturası</div>
                      <div className="text-xs mt-1">Müşteriye</div>
                    </button>
                    <button
                      onClick={() => setTransactionType('purchase')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                        transactionType === 'purchase'
                          ? 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium">Alış Faturası</div>
                      <div className="text-xs mt-1">Tedarikçiden</div>
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {transactionType === 'sales' ? 'Müşteri' : 'Tedarikçi'}
                    </label>
                    <select
                      value={formData.current_account_id}
                      onChange={(e) => setFormData({ ...formData, current_account_id: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Seçiniz...</option>
                      {filteredAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Seri - No</label>
                    <input
                      type="text"
                      value={formData.document_series}
                      onChange={(e) => setFormData({ ...formData, document_series: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                      placeholder="A"
                      maxLength={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Fatura Tarihi</label>
                    <input
                      type="date"
                      value={formData.document_date}
                      onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vade Tarihi</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ödeme Şekli</label>
                    <select
                      value={formData.payment_type}
                      onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as any })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="cash">Nakit/Peşin</option>
                      <option value="check">Çek</option>
                      <option value="promissory_note">Senet</option>
                      <option value="credit_card">Kredi Kartı</option>
                      <option value="bank_transfer">EFT/Havale</option>
                      <option value="open_account">Açık Hesap (Vadeli)</option>
                    </select>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-300">Ürünler</label>
                    <button
                      onClick={addItem}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Ürün Ekle
                    </button>
                  </div>

                  <div className="bg-gray-900 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-300 w-[200px]">Ürün</th>
                          <th className="px-3 py-2 text-center text-gray-300 w-[80px]">Miktar</th>
                          <th className="px-3 py-2 text-center text-gray-300 w-[80px]">Birim</th>
                          <th className="px-3 py-2 text-right text-gray-300 w-[100px]">Birim Fiyat</th>
                          <th className="px-3 py-2 text-center text-gray-300 w-[80px]">İsk %</th>
                          <th className="px-3 py-2 text-right text-gray-300 w-[100px]">İsk Tutar</th>
                          <th className="px-3 py-2 text-center text-gray-300 w-[80px]">KDV %</th>
                          <th className="px-3 py-2 text-right text-gray-300 w-[100px]">KDV Tutar</th>
                          <th className="px-3 py-2 text-right text-gray-300 w-[120px]">Toplam</th>
                          <th className="px-3 py-2 w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {items.map(item => (
                          <tr key={item.temp_id}>
                            <td className="px-3 py-2">
                              <select
                                value={item.item_id}
                                onChange={(e) => updateItem(item.temp_id, 'item_id', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                              >
                                <option value="">Seçiniz...</option>
                                {warehouseItems.map(wi => (
                                  <option key={wi.id} value={wi.id}>
                                    {wi.code} - {wi.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.temp_id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                step="0.001"
                              />
                            </td>
                            <td className="px-3 py-2 text-center text-gray-400">{item.unit}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateItem(item.temp_id, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm text-right"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.discount_percent}
                                onChange={(e) => updateItem(item.temp_id, 'discount_percent', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                step="0.01"
                                max="100"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400">
                              {item.discount_amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.tax_percent}
                                onChange={(e) => updateItem(item.temp_id, 'tax_percent', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400">
                              {item.tax_amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-white font-medium">
                              {item.line_total.toFixed(2)} ₺
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeItem(item.temp_id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                              Ürün eklemek için yukarıdaki butona tıklayın
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-gray-900 rounded-lg p-4 mb-6">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between text-gray-400">
                        <span>Ara Toplam:</span>
                        <span>{totals.subtotal.toFixed(2)} ₺</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Toplam İskonto:</span>
                        <span className="text-red-400">-{totals.totalDiscount.toFixed(2)} ₺</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Toplam KDV:</span>
                        <span>{totals.totalTax.toFixed(2)} ₺</span>
                      </div>
                      <div className="border-t border-gray-700 pt-2 flex justify-between text-white text-lg font-bold">
                        <span>Genel Toplam:</span>
                        <span>{totals.grandTotal.toFixed(2)} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    rows={3}
                    placeholder="Fatura açıklaması..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSave}
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
    </div>
  )
}

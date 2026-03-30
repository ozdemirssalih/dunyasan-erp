'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { FileText, Package, Plus, Edit2, Trash2, X, Save, Search, Clock, Upload, FileDown, Check } from 'lucide-react'

export default function InvoicesPage() {
  const { canCreate, canEdit, canDelete } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Data states
  const [invoices, setInvoices] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    invoice_type: 'sales',
    customer_id: '',
    supplier_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    tax_amount: '',
    discount_amount: '',
    status: 'draft',
    notes: '',
    category: ''
  })
  const [invoiceCategories, setInvoiceCategories] = useState<any[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [waybillForm, setWaybillForm] = useState({
    waybill_number: '',
    waybill_type: 'outgoing',
    customer_id: '',
    supplier_id: '',
    waybill_date: new Date().toISOString().split('T')[0],
    status: 'draft',
    notes: ''
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [showWaybillModal, setShowWaybillModal] = useState(false)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [selectedWaybill, setSelectedWaybill] = useState<any>(null)

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

      setUserId(user.id)

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

    const [invoicesData, customersData, suppliersData, categoriesData] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, customer:customer_companies(customer_name), supplier:suppliers(company_name)')
        .eq('company_id', companyId)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('customer_companies')
        .select('*')
        .eq('company_id', companyId)
        .order('customer_name'),
      supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('company_name'),
      supabase
        .from('invoice_categories')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
    ])

    setInvoices(invoicesData.data || [])
    setCustomers(customersData.data || [])
    setSuppliers(suppliersData.data || [])
    setInvoiceCategories(categoriesData.data || [])
  }

  // Invoice CRUD
  const handleSaveInvoice = async () => {
    // Temel validasyon
    if (!invoiceForm.invoice_number || !invoiceForm.total_amount || !companyId) {
      return alert('Fatura numarası ve tutar zorunludur!')
    }

    // Müşteri işlemleri için customer_id zorunlu
    const customerTransactions = ['sales', 'outgoing_return', 'sales_fx']
    if (customerTransactions.includes(invoiceForm.invoice_type) && !invoiceForm.customer_id) {
      return alert('Müşteri seçimi zorunludur!')
    }

    // Tedarikçi işlemleri için supplier_id zorunlu
    const supplierTransactions = ['purchase', 'incoming_return', 'withholding', 'exempt', 'purchase_fx']
    if (supplierTransactions.includes(invoiceForm.invoice_type) && !invoiceForm.supplier_id) {
      return alert('Tedarikçi seçimi zorunludur!')
    }

    try {
      const data = {
        invoice_number: invoiceForm.invoice_number,
        invoice_type: invoiceForm.invoice_type,
        customer_id: invoiceForm.customer_id || null,
        supplier_id: invoiceForm.supplier_id || null,
        invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date || null,
        total_amount: parseFloat(invoiceForm.total_amount),
        tax_amount: parseFloat(invoiceForm.tax_amount) || 0,
        discount_amount: parseFloat(invoiceForm.discount_amount) || 0,
        status: invoiceForm.status,
        notes: invoiceForm.notes || null,
        category: invoiceForm.category || null,
        company_id: companyId
      }

      if (editingId) {
        await supabase.from('invoices').update(data).eq('id', editingId)

        // Düzenleme: eski cari kaydı güncelle (invoice_number referansıyla bul)
        const customerTransactionsEdit = ['sales', 'outgoing_return', 'sales_fx']
        const transTypeEdit = customerTransactionsEdit.includes(invoiceForm.invoice_type) ? 'receivable' : 'payable'
        const updateCari: any = {
          amount: parseFloat(invoiceForm.total_amount),
          transaction_type: transTypeEdit,
          transaction_date: invoiceForm.invoice_date,
          due_date: invoiceForm.due_date || null,
          description: `Fatura: ${invoiceForm.invoice_number}`,
        }
        if (transTypeEdit === 'receivable') {
          updateCari.customer_id = invoiceForm.customer_id
          updateCari.supplier_id = null
        } else {
          updateCari.supplier_id = invoiceForm.supplier_id
          updateCari.customer_id = null
        }
        await supabase.from('current_account_transactions')
          .update(updateCari)
          .eq('company_id', companyId)
          .eq('reference_number', invoiceForm.invoice_number)

        alert('Fatura ve cari hesap güncellendi!')
      } else {
        // Faturayı kaydet
        const { data: insertedInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert(data)
          .select()
          .single()

        if (invoiceError) {
          console.error('❌ Invoice insert error:', invoiceError)
          alert('Fatura kaydedilemedi: ' + invoiceError.message)
          return
        }

        // Transaction type'ı doğru belirle
        const customerTransactions = ['sales', 'outgoing_return', 'sales_fx']
        const transactionType = customerTransactions.includes(invoiceForm.invoice_type) ? 'receivable' : 'payable'

        // Cariye otomatik yansıt - constraint'e uygun: receivable ise sadece customer_id, payable ise sadece supplier_id
        const currentAccountData: any = {
          company_id: companyId,
          transaction_type: transactionType,
          amount: parseFloat(invoiceForm.total_amount),
          paid_amount: 0,
          status: 'unpaid',
          currency: 'TRY',
          transaction_date: invoiceForm.invoice_date,
          due_date: invoiceForm.due_date || null,
          description: `Fatura: ${invoiceForm.invoice_number}`,
          reference_number: invoiceForm.invoice_number
        }

        // Constraint: receivable → customer_id NOT NULL, supplier_id NULL
        // Constraint: payable → supplier_id NOT NULL, customer_id NULL
        if (transactionType === 'receivable') {
          currentAccountData.customer_id = invoiceForm.customer_id
          currentAccountData.supplier_id = null
        } else {
          currentAccountData.supplier_id = invoiceForm.supplier_id
          currentAccountData.customer_id = null
        }

        const { error: currentAccountError } = await supabase
          .from('current_account_transactions')
          .insert(currentAccountData)

        if (currentAccountError) {
          console.error('❌ Current account insert error:', currentAccountError)
          alert('Fatura kaydedildi ancak cariye yansıtma başarısız oldu:\n' + currentAccountError.message + '\n\nLütfen SQL scriptlerini çalıştırdığınızdan emin olun!')
          loadData()
          return
        }

        alert('✅ Fatura başarıyla kaydedildi ve cariye yansıtıldı!')
      }

      setShowInvoiceModal(false)
      setInvoiceForm({
        invoice_number: '',
        invoice_type: 'sales',
        customer_id: '',
        supplier_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        total_amount: '',
        tax_amount: '',
        discount_amount: '',
        status: 'draft',
        notes: '',
        category: ''
      })
      setEditingId(null)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const handleEditInvoice = (invoice: any) => {
    setEditingId(invoice.id)
    setInvoiceForm({
      invoice_number: invoice.invoice_number,
      invoice_type: invoice.invoice_type,
      customer_id: invoice.customer_id || '',
      supplier_id: invoice.supplier_id || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      total_amount: invoice.total_amount.toString(),
      tax_amount: invoice.tax_amount?.toString() || '',
      discount_amount: invoice.discount_amount?.toString() || '',
      status: invoice.status,
      notes: invoice.notes || '',
      category: invoice.category || ''
    })
    setShowInvoiceModal(true)
  }

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return

    // Önce faturayı getir
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', id)
      .single()

    // Faturayı sil
    await supabase.from('invoices').delete().eq('id', id)

    // İlgili cari kaydını da sil (reference_number'a göre)
    if (invoice?.invoice_number) {
      await supabase
        .from('current_account_transactions')
        .delete()
        .eq('reference_number', invoice.invoice_number)
        .eq('company_id', companyId)
    }

    loadData()
  }

  // Waybill CRUD
  const handleSaveWaybill = async () => {
    if (!waybillForm.waybill_number || !companyId) {
      return alert('İrsaliye numarası zorunludur!')
    }

    try {
      const data = {
        waybill_number: waybillForm.waybill_number,
        waybill_type: waybillForm.waybill_type,
        customer_id: waybillForm.customer_id || null,
        supplier_id: waybillForm.supplier_id || null,
        waybill_date: waybillForm.waybill_date,
        status: waybillForm.status,
        notes: waybillForm.notes || null,
        company_id: companyId
      }

      if (editingId) {
        await supabase.from('waybills').update(data).eq('id', editingId)
      } else {
        await supabase.from('waybills').insert(data)
      }

      setShowWaybillModal(false)
      setWaybillForm({
        waybill_number: '',
        waybill_type: 'outgoing',
        customer_id: '',
        supplier_id: '',
        waybill_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        notes: ''
      })
      setEditingId(null)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const handleEditWaybill = (waybill: any) => {
    setEditingId(waybill.id)
    setWaybillForm({
      waybill_number: waybill.waybill_number,
      waybill_type: waybill.waybill_type,
      customer_id: waybill.customer_id || '',
      supplier_id: waybill.supplier_id || '',
      waybill_date: waybill.waybill_date,
      status: waybill.status,
      notes: waybill.notes || ''
    })
    setShowWaybillModal(true)
  }

  const handleDeleteWaybill = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return
    await supabase.from('waybills').delete().eq('id', id)
    loadData()
  }

  // PDF Upload
  const handleUploadDocument = async (waybillId: string) => {
    if (!documentFile || !companyId || !userId) return

    try {
      setUploadingId(waybillId)

      // Get waybill data
      const { data: waybill, error: waybillError } = await supabase
        .from('waybills')
        .select('*')
        .eq('id', waybillId)
        .single()

      if (waybillError) throw waybillError
      if (!waybill?.notes) throw new Error('İrsaliye bilgileri bulunamadı')

      // Parse form data from notes
      const formData = JSON.parse(waybill.notes)

      // STOK KONTROLÜ - Çok önemli!
      const { data: item, error: itemError } = await supabase
        .from('warehouse_items')
        .select('current_stock, name, code')
        .eq('id', formData.item_id)
        .single()

      if (itemError) throw new Error('Ürün bilgisi alınamadı')

      const requestedQuantity = parseFloat(formData.quantity)
      const availableStock = parseFloat(item.current_stock || 0)

      if (availableStock < requestedQuantity) {
        throw new Error(
          `❌ YETERSİZ STOK!\n\n` +
          `Ürün: ${item.code} - ${item.name}\n` +
          `Talep: ${requestedQuantity}\n` +
          `Mevcut: ${availableStock}\n` +
          `Eksik: ${requestedQuantity - availableStock}\n\n` +
          `Stok negatif olamaz!`
        )
      }

      // Upload PDF
      const fileName = `${companyId}/waybills/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(fileName, documentFile)

      if (uploadError) throw uploadError

      // Create warehouse transaction (actual stock exit)
      const { data: transaction, error: transactionError } = await supabase
        .from('warehouse_transactions')
        .insert({
          company_id: companyId,
          item_id: formData.item_id,
          type: 'exit',
          quantity: parseFloat(formData.quantity),
          shipment_destination: formData.shipment_destination,
          reference_number: formData.reference_number,
          notes: formData.notes,
          created_by: userId,
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Update waybill with document and transaction link
      const { error: updateError } = await supabase
        .from('waybills')
        .update({
          document_url: fileName,
          status: 'completed',
          inventory_transaction_id: transaction.id
        })
        .eq('id', waybillId)

      if (updateError) throw updateError

      alert('✅ İrsaliye yüklendi ve stok çıkışı gerçekleştirildi!')
      setDocumentFile(null)
      setSelectedWaybill(null)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    } finally {
      setUploadingId(null)
    }
  }

  const handleDownloadDocument = async (documentPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('accounting-documents')
        .createSignedUrl(documentPath, 60)

      if (error) throw error
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (error: any) {
      alert('Belge indirilemedi: ' + error.message)
    }
  }

  // Helper Functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      draft: 'Taslak',
      approved: 'Onaylandı',
      paid: 'Ödendi',
      cancelled: 'İptal'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'bg-gray-100 text-gray-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // Filter by search
  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.supplier?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
    <PermissionGuard module="invoices" permission="view">
      <div className="min-h-screen bg-gray-50 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Faturalar</h1>
          <p className="text-gray-600">Fatura yönetimi</p>
        </div>

        {/* Search and Actions */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {canCreate('invoices') && (
            <button
              onClick={() => {
                setEditingId(null)
                setInvoiceForm({
                  invoice_number: '',
                  invoice_type: 'sales',
                  customer_id: '',
                  supplier_id: '',
                  invoice_date: new Date().toISOString().split('T')[0],
                  due_date: '',
                  total_amount: '',
                  tax_amount: '',
                  discount_amount: '',
                  status: 'draft',
                  notes: '',
                  category: ''
                })
                setShowInvoiceModal(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Fatura
            </button>
          )}
        </div>

        {/* Faturalar Listesi */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fatura No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tür</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Müşteri/Tedarikçi</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Tutar</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Durum</th>
                  {(canEdit('invoices') || canDelete('invoices')) && (
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.invoice_type === 'sales' ? 'bg-green-100 text-green-800' :
                        invoice.invoice_type === 'outgoing_return' ? 'bg-green-100 text-green-700' :
                        invoice.invoice_type === 'sales_fx' ? 'bg-green-100 text-green-700' :
                        invoice.invoice_type === 'purchase' ? 'bg-orange-100 text-orange-800' :
                        invoice.invoice_type === 'incoming_return' ? 'bg-red-100 text-red-700' :
                        invoice.invoice_type === 'withholding' ? 'bg-purple-100 text-purple-700' :
                        invoice.invoice_type === 'exempt' ? 'bg-blue-100 text-blue-700' :
                        invoice.invoice_type === 'purchase_fx' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.invoice_type === 'sales' ? '💰 Satış' :
                         invoice.invoice_type === 'purchase' ? '🛒 Alış' :
                         invoice.invoice_type === 'incoming_return' ? '↪️ Gelen İade' :
                         invoice.invoice_type === 'outgoing_return' ? '↩️ Giden İade' :
                         invoice.invoice_type === 'withholding' ? '📋 Tevkifatlı' :
                         invoice.invoice_type === 'exempt' ? '🆓 İstisna' :
                         invoice.invoice_type === 'purchase_fx' ? '💱 Alış KF' :
                         invoice.invoice_type === 'sales_fx' ? '💱 Satış KF' :
                         invoice.invoice_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {invoice.invoice_type === 'sales'
                        ? invoice.customer?.customer_name || '-'
                        : invoice.supplier?.company_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(parseFloat(invoice.total_amount))}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </td>
                    {(canEdit('invoices') || canDelete('invoices')) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit('invoices') && (
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="text-gray-400 hover:text-blue-600 p-2"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete('invoices') && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="text-gray-400 hover:text-red-600 p-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* OLD CONTENT REMOVED - activeTab === 'requests' && (
          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                Bekleyen talep yok
              </div>
            ) : (
              pendingRequests.map((wb) => {
                const formData = wb.notes ? JSON.parse(wb.notes) : {}
                const item = items.find(i => i.id === formData.item_id)

                return (
                  <div key={wb.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {wb.waybill_number}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded ${
                            wb.waybill_type === 'outbound' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {wb.waybill_type === 'outbound' ? '↑ Çıkış' : '↓ Giriş'}
                          </span>
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 text-xs rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Bekliyor
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Talep Tarihi: {new Date(wb.created_at).toLocaleDateString('tr-TR')} {new Date(wb.created_at).toLocaleTimeString('tr-TR')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Ürün</p>
                        <p className="font-semibold text-gray-900">
                          {item?.code} - {item?.name || 'Ürün bulunamadı'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Miktar</p>
                        <p className="font-semibold text-gray-900">
                          {formData.quantity} {item?.unit || 'adet'}
                        </p>
                      </div>
                      {formData.shipment_destination && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Sevkiyat Hedefi</p>
                          <p className="font-semibold text-blue-600">
                            {formData.shipment_destination}
                          </p>
                        </div>
                      )}
                      {formData.reference_number && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Referans No</p>
                          <p className="font-semibold text-gray-900">
                            {formData.reference_number}
                          </p>
                        </div>
                      )}
                      {formData.notes && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Notlar</p>
                          <p className="text-gray-700">{formData.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-3">İrsaliye PDF Yükle</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setDocumentFile(file)
                              setSelectedWaybill(wb)
                            }
                          }}
                          className="text-sm"
                        />
                        {documentFile && selectedWaybill?.id === wb.id && (
                          <button
                            onClick={() => handleUploadDocument(wb.id)}
                            disabled={uploadingId === wb.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            {uploadingId === wb.id ? 'Yükleniyor...' : 'PDF Yükle ve Çıkış Yap'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        💡 PDF yüklendiğinde stok otomatik olarak çıkış yapacaktır.
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fatura No</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tür</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Müşteri/Tedarikçi</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Tutar</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Durum</th>
                    {(canEdit('invoices') || canDelete('invoices')) && (
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.invoice_type === 'sales' ? 'bg-green-100 text-green-800' :
                          invoice.invoice_type === 'outgoing_return' ? 'bg-green-100 text-green-700' :
                          invoice.invoice_type === 'sales_fx' ? 'bg-green-100 text-green-700' :
                          invoice.invoice_type === 'purchase' ? 'bg-orange-100 text-orange-800' :
                          invoice.invoice_type === 'incoming_return' ? 'bg-red-100 text-red-700' :
                          invoice.invoice_type === 'withholding' ? 'bg-purple-100 text-purple-700' :
                          invoice.invoice_type === 'exempt' ? 'bg-blue-100 text-blue-700' :
                          invoice.invoice_type === 'purchase_fx' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.invoice_type === 'sales' ? '💰 Satış' :
                           invoice.invoice_type === 'purchase' ? '🛒 Alış' :
                           invoice.invoice_type === 'incoming_return' ? '↪️ Gelen İade' :
                           invoice.invoice_type === 'outgoing_return' ? '↩️ Giden İade' :
                           invoice.invoice_type === 'withholding' ? '📋 Tevkifatlı' :
                           invoice.invoice_type === 'exempt' ? '🆓 İstisna' :
                           invoice.invoice_type === 'purchase_fx' ? '💱 Alış KF' :
                           invoice.invoice_type === 'sales_fx' ? '💱 Satış KF' :
                           invoice.invoice_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {invoice.invoice_type === 'sales'
                          ? invoice.customer?.customer_name || '-'
                          : invoice.supplier?.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(invoice.invoice_date)}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(parseFloat(invoice.total_amount))}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      {(canEdit('invoices') || canDelete('invoices')) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit('invoices') && (
                              <button
                                onClick={() => handleEditInvoice(invoice)}
                                className="text-gray-400 hover:text-blue-600 p-2"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete('invoices') && (
                              <button
                                onClick={() => handleDeleteInvoice(invoice.id)}
                                className="text-gray-400 hover:text-red-600 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'waybills' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">İrsaliye No</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tür</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Durum</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Belge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {completedWaybills.map((waybill) => (
                    <tr key={waybill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{waybill.waybill_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(waybill.waybill_date)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          waybill.waybill_type === 'outbound' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {waybill.waybill_type === 'outbound' ? '↑ Çıkış' : '↓ Giriş'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit bg-green-100 text-green-800">
                          <Check className="w-3 h-3" />
                          Tamamlandı
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {waybill.document_url ? (
                          <button
                            onClick={() => handleDownloadDocument(waybill.document_url!)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                          >
                            <FileDown className="w-4 h-4" />
                            PDF İndir
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">Yok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {completedWaybills.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Henüz tamamlanmış irsaliye yok
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice Modal */}
        {showInvoiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingId ? 'Fatura Düzenle' : 'Yeni Fatura'}
                  </h3>
                  <button onClick={() => setShowInvoiceModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fatura No *</label>
                    <input
                      type="text"
                      value={invoiceForm.invoice_number}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoice_number: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Türü *</label>
                    <select
                      value={invoiceForm.invoice_type}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoice_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <optgroup label="📈 Alacak (Gelir - Müşteri İşlemleri)">
                        <option value="sales">💰 Satış Faturası (+)</option>
                        <option value="outgoing_return">↩️ Giden İade Faturası (+)</option>
                        <option value="sales_fx">💱 Satış Kur Farkı Faturası (+)</option>
                      </optgroup>
                      <optgroup label="📉 Borç (Gider - Tedarikçi İşlemleri)">
                        <option value="purchase">🛒 Alış Faturası (-)</option>
                        <option value="incoming_return">↪️ Gelen İade Faturası (-)</option>
                        <option value="withholding">📋 Tevkifatlı Fatura (-)</option>
                        <option value="exempt">🆓 İstisna Fatura (-)</option>
                        <option value="purchase_fx">💱 Alış Kur Farkı Faturası (-)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      (+) = Alacak artırır | (-) = Borç artırır
                    </p>
                  </div>
                </div>

                {/* Müşteri İşlemleri: Satış, Giden İade, Satış Kur Farkı */}
                {['sales', 'outgoing_return', 'sales_fx'].includes(invoiceForm.invoice_type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Müşteri *
                      <span className="text-xs text-gray-500 ml-2">(Alacak artırır)</span>
                    </label>
                    <select
                      value={invoiceForm.customer_id}
                      onChange={(e) => setInvoiceForm({...invoiceForm, customer_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      required
                    >
                      <option value="">Müşteri seçin</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.customer_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tedarikçi İşlemleri: Alış, Gelen İade, Tevkifatlı, İstisna, Alış Kur Farkı */}
                {['purchase', 'incoming_return', 'withholding', 'exempt', 'purchase_fx'].includes(invoiceForm.invoice_type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tedarikçi *
                      <span className="text-xs text-gray-500 ml-2">(Borç artırır)</span>
                    </label>
                    <select
                      value={invoiceForm.supplier_id}
                      onChange={(e) => setInvoiceForm({...invoiceForm, supplier_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      required
                    >
                      <option value="">Tedarikçi seçin</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.company_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Tarihi *</label>
                    <input
                      type="date"
                      value={invoiceForm.invoice_date}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoice_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vade Tarihi</label>
                    <input
                      type="date"
                      value={invoiceForm.due_date}
                      onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Toplam Tutar *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.total_amount}
                      onChange={(e) => setInvoiceForm({...invoiceForm, total_amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">KDV Tutarı</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.tax_amount}
                      onChange={(e) => setInvoiceForm({...invoiceForm, tax_amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">İndirim</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.discount_amount}
                      onChange={(e) => setInvoiceForm({...invoiceForm, discount_amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durum *</label>
                  <select
                    value={invoiceForm.status}
                    onChange={(e) => setInvoiceForm({...invoiceForm, status: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="draft">Taslak</option>
                    <option value="approved">Onaylandı</option>
                    <option value="paid">Ödendi</option>
                    <option value="cancelled">İptal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Kategorisi</label>
                  <div className="flex gap-2">
                    <select
                      value={invoiceForm.category}
                      onChange={(e) => setInvoiceForm({...invoiceForm, category: e.target.value})}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Kategori Seçin (Opsiyonel)</option>
                      {invoiceCategories.map((cat: any) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveInvoice}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waybill Modal */}
        {showWaybillModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingId ? 'İrsaliye Düzenle' : 'Yeni İrsaliye'}
                  </h3>
                  <button onClick={() => setShowWaybillModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">İrsaliye No *</label>
                    <input
                      type="text"
                      value={waybillForm.waybill_number}
                      onChange={(e) => setWaybillForm({...waybillForm, waybill_number: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tür *</label>
                    <select
                      value={waybillForm.waybill_type}
                      onChange={(e) => setWaybillForm({...waybillForm, waybill_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="outgoing">Çıkış İrsaliyesi</option>
                      <option value="incoming">Giriş İrsaliyesi</option>
                    </select>
                  </div>
                </div>

                {waybillForm.waybill_type === 'outgoing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri</label>
                    <select
                      value={waybillForm.customer_id}
                      onChange={(e) => setWaybillForm({...waybillForm, customer_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Müşteri seçin</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.customer_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {waybillForm.waybill_type === 'incoming' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi</label>
                    <select
                      value={waybillForm.supplier_id}
                      onChange={(e) => setWaybillForm({...waybillForm, supplier_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Tedarikçi seçin</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.company_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                  <input
                    type="date"
                    value={waybillForm.waybill_date}
                    onChange={(e) => setWaybillForm({...waybillForm, waybill_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durum *</label>
                  <select
                    value={waybillForm.status}
                    onChange={(e) => setWaybillForm({...waybillForm, status: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="draft">Taslak</option>
                    <option value="approved">Onaylandı</option>
                    <option value="cancelled">İptal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={waybillForm.notes}
                    onChange={(e) => setWaybillForm({...waybillForm, notes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowWaybillModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveWaybill}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Kategori Ekleme Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Yeni Fatura Kategorisi</h3>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Kategori adı girin"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!newCategoryName.trim() || !companyId) return
                    const { error } = await supabase.from('invoice_categories').insert({
                      company_id: companyId,
                      name: newCategoryName.trim()
                    })
                    if (error) { alert('Hata: ' + error.message); return }
                    setNewCategoryName('')
                    setShowCategoryModal(false)
                    loadData()
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
                >
                  Ekle
                </button>
                <button
                  onClick={() => { setShowCategoryModal(false); setNewCategoryName('') }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold"
                >
                  İptal
                </button>
              </div>

              {invoiceCategories.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Mevcut Kategoriler:</p>
                  <div className="flex flex-wrap gap-2">
                    {invoiceCategories.map((cat: any) => (
                      <span key={cat.id} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">{cat.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { FileText, Package, Plus, Edit2, Trash2, X, Save, Search } from 'lucide-react'

type Tab = 'invoices' | 'waybills'

export default function InvoicesPage() {
  const { canCreate, canEdit, canDelete } = usePermissions()
  const [activeTab, setActiveTab] = useState<Tab>('invoices')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Data states
  const [invoices, setInvoices] = useState<any[]>([])
  const [waybills, setWaybills] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showWaybillModal, setShowWaybillModal] = useState(false)

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
    notes: ''
  })

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

    const [invoicesData, waybillsData, customersData, suppliersData] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, customer:customers(customer_name), supplier:suppliers(company_name)')
        .eq('company_id', companyId)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('waybills')
        .select('*, customer:customers(customer_name), supplier:suppliers(company_name)')
        .eq('company_id', companyId)
        .order('waybill_date', { ascending: false }),
      supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('customer_name'),
      supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('company_name')
    ])

    setInvoices(invoicesData.data || [])
    setWaybills(waybillsData.data || [])
    setCustomers(customersData.data || [])
    setSuppliers(suppliersData.data || [])
  }

  // Invoice CRUD
  const handleSaveInvoice = async () => {
    if (!invoiceForm.invoice_number || !invoiceForm.total_amount || !companyId) {
      return alert('Fatura numarası ve tutar zorunludur!')
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
        company_id: companyId
      }

      if (editingId) {
        await supabase.from('invoices').update(data).eq('id', editingId)
      } else {
        await supabase.from('invoices').insert(data)
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
        notes: ''
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
      notes: invoice.notes || ''
    })
    setShowInvoiceModal(true)
  }

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return
    await supabase.from('invoices').delete().eq('id', id)
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

  const filteredWaybills = waybills.filter(wb =>
    wb.waybill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wb.customer?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wb.supplier?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tabs = [
    { id: 'invoices', label: 'Faturalar', icon: FileText },
    { id: 'waybills', label: 'İrsaliyeler', icon: Package }
  ]

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📄 Faturalar & İrsaliyeler</h1>
          <p className="text-gray-600">Fatura ve irsaliye yönetimi</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex gap-2 bg-white rounded-lg p-2 shadow-sm border border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
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
                if (activeTab === 'invoices') {
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
                    notes: ''
                  })
                  setShowInvoiceModal(true)
                } else {
                  setWaybillForm({
                    waybill_number: '',
                    waybill_type: 'outgoing',
                    customer_id: '',
                    supplier_id: '',
                    waybill_date: new Date().toISOString().split('T')[0],
                    status: 'draft',
                    notes: ''
                  })
                  setShowWaybillModal(true)
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni {activeTab === 'invoices' ? 'Fatura' : 'İrsaliye'}
            </button>
          )}
        </div>

        {/* Tab Content */}
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
                          invoice.invoice_type === 'sales' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {invoice.invoice_type === 'sales' ? 'Satış' : 'Alış'}
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tür</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Müşteri/Tedarikçi</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Durum</th>
                    {(canEdit('invoices') || canDelete('invoices')) && (
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWaybills.map((waybill) => (
                    <tr key={waybill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{waybill.waybill_number}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          waybill.waybill_type === 'outgoing' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {waybill.waybill_type === 'outgoing' ? 'Çıkış' : 'Giriş'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {waybill.waybill_type === 'outgoing'
                          ? waybill.customer?.customer_name || '-'
                          : waybill.supplier?.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(waybill.waybill_date)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(waybill.status)}`}>
                          {getStatusLabel(waybill.status)}
                        </span>
                      </td>
                      {(canEdit('invoices') || canDelete('invoices')) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit('invoices') && (
                              <button
                                onClick={() => handleEditWaybill(waybill)}
                                className="text-gray-400 hover:text-blue-600 p-2"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete('invoices') && (
                              <button
                                onClick={() => handleDeleteWaybill(waybill.id)}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tür *</label>
                    <select
                      value={invoiceForm.invoice_type}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoice_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="sales">Satış Faturası</option>
                      <option value="purchase">Alış Faturası</option>
                    </select>
                  </div>
                </div>

                {invoiceForm.invoice_type === 'sales' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri</label>
                    <select
                      value={invoiceForm.customer_id}
                      onChange={(e) => setInvoiceForm({...invoiceForm, customer_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Müşteri seçin</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.customer_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {invoiceForm.invoice_type === 'purchase' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi</label>
                    <select
                      value={invoiceForm.supplier_id}
                      onChange={(e) => setInvoiceForm({...invoiceForm, supplier_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
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
      </div>
    </PermissionGuard>
  )
}

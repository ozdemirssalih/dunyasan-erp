'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'

type Tab = 'items' | 'entry' | 'exit' | 'history' | 'requests' | 'production-requests' | 'production-transfers'

interface Category {
  id: string
  name: string
  description: string
}

interface WarehouseItem {
  id: string
  code: string
  name: string
  description: string
  category_id: string
  category_name: string
  unit: string
  current_stock: number
  min_stock: number
  max_stock: number
  unit_price: number
  location: string
  is_active: boolean
}

interface Department {
  id: string
  name: string
  description: string
}

interface Transaction {
  id: string
  item_name: string
  item_code: string
  type: 'entry' | 'exit'
  quantity: number
  unit: string
  supplier: string
  destination_type: string
  department_name: string
  shipment_destination: string
  reference_number: string
  notes: string
  transaction_date: string
  created_by_name: string
}

interface PurchaseRequest {
  id: string
  item_name: string
  category_name: string
  quantity: number
  unit: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  reason: string
  status: string
  requested_by_name: string
  requested_at: string
}

interface ProductionRequest {
  id: string
  item_id: string
  item_name: string
  item_code: string
  category_name: string
  quantity: number
  unit: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  reason: string
  status: string
  requested_by_name: string
  requested_at: string
}

export default function WarehousePage() {
  const { canCreate, canEdit, canDelete } = usePermissions()

  const [activeTab, setActiveTab] = useState<Tab>('items')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Data states
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([])
  const [productionTransfers, setProductionTransfers] = useState<any[]>([])

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null)

  // Form states
  const [itemForm, setItemForm] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    unit: 'adet',
    min_stock: 0,
    max_stock: 0,
    unit_price: 0,
    location: '',
  })

  const [entryForm, setEntryForm] = useState({
    item_id: '',
    quantity: 0,
    unit_price: 0,
    supplier: '',
    invoice_number: '',
    reference_number: '',
    notes: '',
  })

  const [exitForm, setExitForm] = useState({
    item_id: '',
    quantity: 0,
    destination_type: 'department',
    department_id: '',
    shipment_destination: '',
    reference_number: '',
    notes: '',
  })

  const [requestForm, setRequestForm] = useState({
    item_id: '',
    item_name: '',
    category_id: '',
    quantity: 0,
    unit: 'adet',
    urgency: 'medium',
    reason: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      // Eğer profilde company_id yoksa, Dünyasan şirketini kullan
      if (!finalCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          await supabase
            .from('profiles')
            .update({ company_id: finalCompanyId })
            .eq('id', user.id)
        } else {
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            await supabase
              .from('profiles')
              .update({ company_id: finalCompanyId })
              .eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) {
        console.error('No company found')
        setLoading(false)
        return
      }

      setCompanyId(finalCompanyId)

      // Load categories
      const { data: categoriesData } = await supabase
        .from('warehouse_categories')
        .select('*')
        .order('name')

      setCategories(categoriesData || [])

      // Load departments
      const { data: departmentsData } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('name')

      setDepartments(departmentsData || [])

      // Load warehouse items
      await loadItems(finalCompanyId)

      // Load transactions
      await loadTransactions(finalCompanyId)

      // Load purchase requests
      await loadRequests(finalCompanyId)

      // Load production requests
      await loadProductionRequests(finalCompanyId)
      await loadProductionTransfers(finalCompanyId)

    } catch (error) {
      console.error('Error loading data:', error)
      alert('Veri yüklenirken hata oluştu!')
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async (companyId: string) => {
    console.log('🔍 [WAREHOUSE] loadItems çağrıldı, companyId:', companyId)

    const { data, error } = await supabase
      .from('warehouse_items')
      .select(`
        *,
        category:warehouse_categories(name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code')

    console.log('📦 [WAREHOUSE] warehouse_items sorgu sonucu:', { data, error, count: data?.length })

    const itemsData = data?.map((item: any) => ({
      ...item,
      category_name: item.category?.name || 'Bilinmiyor'
    })) || []

    console.log('✅ [WAREHOUSE] Items state güncelleniyor:', itemsData.length, 'kayıt')
    setItems(itemsData)
  }

  const loadTransactions = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_transactions')
      .select(`
        *,
        item:warehouse_items(name, code, unit),
        department:departments(name),
        creator:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })
      .limit(100)

    const transactionsData = data?.map((t: any) => ({
      id: t.id,
      item_name: t.item?.name || 'Bilinmiyor',
      item_code: t.item?.code || '',
      type: t.type,
      quantity: t.quantity,
      unit: t.item?.unit || '',
      supplier: t.supplier || '',
      destination_type: t.destination_type || '',
      department_name: t.department?.name || '',
      shipment_destination: t.shipment_destination || '',
      reference_number: t.reference_number || '',
      notes: t.notes || '',
      transaction_date: t.transaction_date,
      created_by_name: t.creator?.full_name || 'Bilinmiyor'
    })) || []

    setTransactions(transactionsData)
  }

  const loadRequests = async (companyId: string) => {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        category:warehouse_categories(name),
        requested_by:profiles!purchase_requests_requested_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading purchase requests:', error)
    }

    const requestsData = data?.map((r: any) => ({
      id: r.id,
      item_name: r.item_name,
      category_name: r.category?.name || 'Diğer',
      quantity: r.quantity,
      unit: r.unit,
      urgency: r.urgency,
      reason: r.reason || '',
      status: r.status,
      requested_by_name: r.requested_by?.full_name || 'Bilinmiyor',
      requested_at: r.requested_at
    })) || []

    setRequests(requestsData)
  }

  const loadProductionRequests = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_material_requests')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name)),
        requested_by:profiles!production_material_requests_requested_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading production requests:', error)
    }

    const productionRequestsData = data?.map((r: any) => ({
      id: r.id,
      item_id: r.item_id,
      item_name: r.item?.name || '',
      item_code: r.item?.code || '',
      category_name: r.item?.category?.name || 'Diğer',
      quantity: r.quantity,
      unit: r.item?.unit || '',
      urgency: r.urgency,
      reason: r.reason || '',
      status: r.status,
      requested_by_name: r.requested_by?.full_name || 'Bilinmiyor',
      requested_at: r.requested_at
    })) || []

    setProductionRequests(productionRequestsData)
  }

  const loadProductionTransfers = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_to_warehouse_transfers')
      .select(`
        *,
        item:warehouse_items(code, name, unit),
        requested_by:profiles!production_to_warehouse_transfers_requested_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading production transfers:', error)
    }

    setProductionTransfers(data || [])
  }

  const handleApproveProductionTransfer = async (transferId: string) => {
    if (!confirm('Bu transferi onaylamak istediğinizden emin misiniz? Üretim deposu azalacak, ana depo stoğu artacak.')) return

    try {
      const { error } = await supabase
        .from('production_to_warehouse_transfers')
        .update({
          status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', transferId)

      if (error) throw error

      alert('✅ Transfer onaylandı! Stok hareketleri otomatik yapıldı.')
      loadData()
    } catch (error: any) {
      console.error('Error approving transfer:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleRejectProductionTransfer = async (transferId: string) => {
    if (!confirm('Bu transferi reddetmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('production_to_warehouse_transfers')
        .update({
          status: 'rejected',
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', transferId)

      if (error) throw error

      alert('Transfer reddedildi.')
      loadData()
    } catch (error: any) {
      console.error('Error rejecting transfer:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleApproveProductionRequest = async (requestId: string) => {
    if (!confirm('Bu talebi onaylamak istediğinizden emin misiniz? Depo stoğu azalacak, üretim stoğu artacak.')) return

    try {
      const { error } = await supabase
        .from('production_material_requests')
        .update({
          status: 'approved',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (error) throw error

      alert('✅ Talep onaylandı! Stoklar otomatik güncellendi.')
      loadData()
    } catch (error: any) {
      console.error('Error approving request:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleRejectProductionRequest = async (requestId: string) => {
    const notes = prompt('Ret sebebini yazın:')
    if (notes === null) return

    try {
      const { error } = await supabase
        .from('production_material_requests')
        .update({
          status: 'rejected',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', requestId)

      if (error) throw error

      alert('✅ Talep reddedildi.')
      loadData()
    } catch (error: any) {
      console.error('Error rejecting request:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const itemData = {
        ...itemForm,
        company_id: companyId,
        created_by: currentUserId,
      }

      if (editingItem) {
        const { error } = await supabase
          .from('warehouse_items')
          .update(itemData)
          .eq('id', editingItem.id)

        if (error) throw error
        alert('✅ Stok kalemi güncellendi!')
      } else {
        const { error } = await supabase
          .from('warehouse_items')
          .insert(itemData)

        if (error) throw error
        alert('✅ Yeni stok kalemi eklendi!')
      }

      setShowItemModal(false)
      setEditingItem(null)
      resetItemForm()
      loadData()
    } catch (error: any) {
      console.error('Error saving item:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleStockEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('warehouse_transactions')
        .insert({
          company_id: companyId,
          item_id: entryForm.item_id,
          type: 'entry',
          quantity: entryForm.quantity,
          unit_price: entryForm.unit_price,
          total_price: entryForm.quantity * entryForm.unit_price,
          supplier: entryForm.supplier,
          invoice_number: entryForm.invoice_number,
          reference_number: entryForm.reference_number,
          notes: entryForm.notes,
          created_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Stok girişi başarılı!')
      setShowEntryModal(false)
      resetEntryForm()
      loadData()
    } catch (error: any) {
      console.error('Error entry:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleStockExit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('warehouse_transactions')
        .insert({
          company_id: companyId,
          item_id: exitForm.item_id,
          type: 'exit',
          quantity: exitForm.quantity,
          destination_type: exitForm.destination_type,
          department_id: exitForm.destination_type === 'department' ? exitForm.department_id : null,
          shipment_destination: exitForm.destination_type === 'shipment' ? exitForm.shipment_destination : null,
          reference_number: exitForm.reference_number,
          notes: exitForm.notes,
          created_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Stok çıkışı başarılı!')
      setShowExitModal(false)
      resetExitForm()
      loadData()
    } catch (error: any) {
      console.error('Error exit:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('purchase_requests')
        .insert({
          company_id: companyId,
          item_id: requestForm.item_id || null,
          item_name: requestForm.item_name,
          category_id: requestForm.category_id || null,
          quantity: requestForm.quantity,
          unit: requestForm.unit,
          urgency: requestForm.urgency,
          reason: requestForm.reason,
          requested_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Satın alma talebi gönderildi!')
      setShowRequestModal(false)
      resetRequestForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const resetItemForm = () => {
    setItemForm({
      code: '',
      name: '',
      description: '',
      category_id: '',
      unit: 'adet',
      min_stock: 0,
      max_stock: 0,
      unit_price: 0,
      location: '',
    })
  }

  const resetEntryForm = () => {
    setEntryForm({
      item_id: '',
      quantity: 0,
      unit_price: 0,
      supplier: '',
      invoice_number: '',
      reference_number: '',
      notes: '',
    })
  }

  const resetExitForm = () => {
    setExitForm({
      item_id: '',
      quantity: 0,
      destination_type: 'department',
      department_id: '',
      shipment_destination: '',
      reference_number: '',
      notes: '',
    })
  }

  const resetRequestForm = () => {
    setRequestForm({
      item_id: '',
      item_name: '',
      category_id: '',
      quantity: 0,
      unit: 'adet',
      urgency: 'medium',
      reason: '',
    })
  }

  const filteredItems = items.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLowStock = !showLowStock || item.current_stock <= item.min_stock

    return matchesCategory && matchesSearch && matchesLowStock
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="warehouse" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Depo Yönetimi</h2>
            <p className="text-gray-600">Stok takibi ve depo işlemleri</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'items', label: 'Stok Kalemleri', count: items.length },
              { id: 'entry', label: 'Giriş İşlemleri', icon: '↓' },
              { id: 'exit', label: 'Çıkış İşlemleri', icon: '↑' },
              { id: 'history', label: 'Geçmiş', count: transactions.length },
              { id: 'requests', label: 'Satın Alma Talepleri', count: requests.filter(r => r.status === 'pending').length },
              { id: 'production-requests', label: 'Üretim Talepleri', count: productionRequests.filter(r => r.status === 'pending').length },
              { id: 'production-transfers', label: 'Üretimden Transferler', count: productionTransfers.filter((t: any) => t.status === 'pending').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
                {tab.icon && <span>{tab.icon}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {/* ITEMS TAB */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Stok kodu veya adı ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg"
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Tüm Kategoriler</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={showLowStock}
                  onChange={(e) => setShowLowStock(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Sadece Düşük Stok</span>
              </label>

              {canCreate('warehouse') && (
                <button
                  onClick={() => {
                    setEditingItem(null)
                    resetItemForm()
                    setShowItemModal(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  + Yeni Stok Kalemi
                </button>
              )}
            </div>

            {/* Mevcut Stoklar Tablosu */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">📦 Mevcut Stoklar</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kod</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ürün Adı</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mevcut Stok</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Konum</th>
                      {canEdit('warehouse') && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlem</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {item.category_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-bold text-gray-900">
                            {item.current_stock} <span className="text-sm text-gray-600">{item.unit}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.location || '-'}</td>
                        {canEdit('warehouse') && (
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setEditingItem(item)
                                setItemForm({
                                  code: item.code,
                                  name: item.name,
                                  description: item.description,
                                  category_id: item.category_id,
                                  unit: item.unit,
                                  min_stock: item.min_stock,
                                  max_stock: item.max_stock,
                                  unit_price: item.unit_price,
                                  location: item.location,
                                })
                                setShowItemModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Düzenle
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredItems.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Stok kalemi bulunamadı</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => {
                const isLowStock = item.current_stock <= item.min_stock && item.min_stock > 0
                const stockPercentage = item.max_stock > 0
                  ? Math.min((item.current_stock / item.max_stock) * 100, 100)
                  : 0

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                      isLowStock ? 'border-red-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-500">{item.code}</p>
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {item.category_name}
                        </span>
                      </div>
                      {isLowStock && (
                        <span className="text-red-500 text-sm font-semibold">Düşük!</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Mevcut Stok:</span>
                        <span className="font-semibold">{item.current_stock} {item.unit}</span>
                      </div>

                      {item.max_stock > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isLowStock ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${stockPercentage}%` }}
                          ></div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Min: {item.min_stock}</span>
                        <span>Max: {item.max_stock || '-'}</span>
                      </div>

                      {item.location && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Konum:</span> {item.location}
                        </div>
                      )}
                    </div>

                    {canEdit('warehouse') && (
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setItemForm({
                            code: item.code,
                            name: item.name,
                            description: item.description,
                            category_id: item.category_id,
                            unit: item.unit,
                            min_stock: item.min_stock,
                            max_stock: item.max_stock,
                            unit_price: item.unit_price,
                            location: item.location,
                          })
                          setShowItemModal(true)
                        }}
                        className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Stok kalemi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* ENTRY TAB */}
        {activeTab === 'entry' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Stok Girişi</h3>
            <p className="text-gray-600 mb-6">Depoya gelen malzemeleri kaydedin</p>

            <form onSubmit={handleStockEntry} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stok Kalemi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={entryForm.item_id}
                    onChange={(e) => setEntryForm({ ...entryForm, item_id: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seçin...</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Miktar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={entryForm.quantity}
                    onChange={(e) => setEntryForm({ ...entryForm, quantity: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Birim Fiyat</label>
                  <input
                    type="number"
                    step="0.01"
                    value={entryForm.unit_price}
                    onChange={(e) => setEntryForm({ ...entryForm, unit_price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tedarikçi</label>
                  <input
                    type="text"
                    value={entryForm.supplier}
                    onChange={(e) => setEntryForm({ ...entryForm, supplier: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fatura No</label>
                  <input
                    type="text"
                    value={entryForm.invoice_number}
                    onChange={(e) => setEntryForm({ ...entryForm, invoice_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">İrsaliye No</label>
                  <input
                    type="text"
                    value={entryForm.reference_number}
                    onChange={(e) => setEntryForm({ ...entryForm, reference_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold"
                >
                  ↓ Giriş Yap
                </button>
                <button
                  type="button"
                  onClick={resetEntryForm}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                >
                  Temizle
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EXIT TAB */}
        {activeTab === 'exit' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Stok Çıkışı</h3>
            <p className="text-gray-600 mb-6">Depodan çıkan malzemeleri kaydedin</p>

            <form onSubmit={handleStockExit} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stok Kalemi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={exitForm.item_id}
                    onChange={(e) => setExitForm({ ...exitForm, item_id: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seçin...</option>
                    {items.filter(i => i.current_stock > 0).map(item => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name} (Mevcut: {item.current_stock} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Miktar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={exitForm.quantity}
                    onChange={(e) => setExitForm({ ...exitForm, quantity: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Çıkış Tipi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={exitForm.destination_type}
                    onChange={(e) => setExitForm({ ...exitForm, destination_type: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  >
                    <option value="department">Dahili Birim</option>
                    <option value="shipment">Sevkiyat</option>
                    <option value="waste">Fire/Hurda</option>
                    <option value="return">İade</option>
                  </select>
                </div>

                {exitForm.destination_type === 'department' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={exitForm.department_id}
                      onChange={(e) => setExitForm({ ...exitForm, department_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {exitForm.destination_type === 'shipment' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sevkiyat Adresi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={exitForm.shipment_destination}
                      onChange={(e) => setExitForm({ ...exitForm, shipment_destination: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">İrsaliye No</label>
                  <input
                    type="text"
                    value={exitForm.reference_number}
                    onChange={(e) => setExitForm({ ...exitForm, reference_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={exitForm.notes}
                  onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold"
                >
                  ↑ Çıkış Yap
                </button>
                <button
                  type="button"
                  onClick={resetExitForm}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                >
                  Temizle
                </button>
              </div>
            </form>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tip</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Miktar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kaynak/Hedef</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Referans</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemi Yapan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(tx.transaction_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          tx.type === 'entry'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type === 'entry' ? '↓ Giriş' : '↑ Çıkış'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{tx.item_name}</div>
                        <div className="text-xs text-gray-500">{tx.item_code}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {tx.quantity} {tx.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {tx.type === 'entry'
                          ? tx.supplier || '-'
                          : tx.department_name || tx.shipment_destination || tx.destination_type || '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {tx.reference_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {tx.created_by_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Henüz hareket kaydı yok</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canCreate('warehouse') && (
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Yeni Talep
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {requests.map(req => {
                const urgencyColors: Record<string, string> = {
                  low: 'bg-gray-100 text-gray-700',
                  medium: 'bg-blue-100 text-blue-700',
                  high: 'bg-orange-100 text-orange-700',
                  urgent: 'bg-red-100 text-red-700'
                }

                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700',
                  ordered: 'bg-blue-100 text-blue-700',
                  completed: 'bg-gray-100 text-gray-700',
                  cancelled: 'bg-gray-100 text-gray-700'
                }

                return (
                  <div key={req.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{req.item_name}</h4>
                        <p className="text-sm text-gray-500">{req.category_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${urgencyColors[req.urgency] || 'bg-gray-100 text-gray-700'}`}>
                          {req.urgency.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[req.status] || 'bg-gray-100 text-gray-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{req.quantity} {req.unit}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{req.requested_by_name}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(req.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {req.reason && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Sebep</span>
                          <p className="text-gray-900">{req.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {requests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz satın alma talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTION REQUESTS TAB */}
        {activeTab === 'production-requests' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-blue-900 mb-2">🏭 Üretimden Gelen Talepler</h3>
              <p className="text-sm text-blue-700">
                Üretim bölümünden gelen hammadde taleplerini onaylayın. Onayladığınızda depo stoğu otomatik azalacak, üretim stoğu artacak.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {productionRequests.map(req => {
                const urgencyColors: Record<string, string> = {
                  low: 'bg-gray-100 text-gray-700',
                  medium: 'bg-blue-100 text-blue-700',
                  high: 'bg-orange-100 text-orange-700',
                  urgent: 'bg-red-100 text-red-700'
                }

                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700',
                  cancelled: 'bg-gray-100 text-gray-700'
                }

                return (
                  <div key={req.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{req.item_name}</h4>
                        <p className="text-sm text-gray-500">{req.item_code} - {req.category_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${urgencyColors[req.urgency] || 'bg-gray-100 text-gray-700'}`}>
                          {req.urgency.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[req.status] || 'bg-gray-100 text-gray-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{req.quantity} {req.unit}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{req.requested_by_name}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(req.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {req.reason && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Sebep</span>
                          <p className="text-gray-900">{req.reason}</p>
                        </div>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleApproveProductionRequest(req.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
                        >
                          ✅ Onayla
                        </button>
                        <button
                          onClick={() => handleRejectProductionRequest(req.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
                        >
                          ❌ Reddet
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {productionRequests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz üretim talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTION TRANSFERS TAB */}
        {activeTab === 'production-transfers' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-purple-900 mb-2">📦 Üretimden Ana Depoya Transfer</h3>
              <p className="text-sm text-purple-700">
                Üretim bölümünden ana depoya bitmiş ürün transfer taleplerini onaylayın. Onayladığınızda üretim deposu azalacak, ana depo stoğu artacak.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {productionTransfers.map((transfer: any) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                return (
                  <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{transfer.item?.name || 'Bilinmiyor'}</h4>
                        <p className="text-sm text-gray-500">{transfer.item?.code || '-'}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                        {transfer.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{transfer.quantity} {transfer.item?.unit || ''}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{transfer.requested_by?.full_name || 'Bilinmiyor'}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(transfer.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {transfer.status === 'approved' && transfer.approved_by && (
                        <>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Onaylayan</span>
                            <span className="text-gray-900">{transfer.approved_by.full_name || 'Bilinmiyor'}</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Onay Tarihi</span>
                            <span className="text-gray-900">{transfer.approved_at ? new Date(transfer.approved_at).toLocaleString('tr-TR') : '-'}</span>
                          </div>
                        </>
                      )}
                      {transfer.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{transfer.notes}</p>
                        </div>
                      )}
                    </div>

                    {transfer.status === 'pending' && (
                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleApproveProductionTransfer(transfer.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
                        >
                          ✅ Onayla & Depoya Ekle
                        </button>
                        <button
                          onClick={() => handleRejectProductionTransfer(transfer.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
                        >
                          ❌ Reddet
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {productionTransfers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz transfer talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* MODALS */}
        {/* Item Modal */}
        {showItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                {editingItem ? 'Stok Kalemi Düzenle' : 'Yeni Stok Kalemi'}
              </h3>

              <form onSubmit={handleSaveItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Stok Kodu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={itemForm.code}
                      onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      placeholder="Örn: HMD-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Stok Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      placeholder="Ürün adı"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      placeholder="Ürün açıklaması..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={itemForm.category_id}
                      onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={itemForm.unit}
                      onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="adet">Adet</option>
                      <option value="kg">Kg</option>
                      <option value="lt">Lt</option>
                      <option value="m">Metre</option>
                      <option value="m2">m²</option>
                      <option value="m3">m³</option>
                      <option value="paket">Paket</option>
                      <option value="kutu">Kutu</option>
                      <option value="koli">Koli</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Konum / Raf</label>
                    <input
                      type="text"
                      value={itemForm.location}
                      onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      placeholder="Örn: A-12-3"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                  >
                    {editingItem ? 'Güncelle' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowItemModal(false)
                      setEditingItem(null)
                      resetItemForm()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Satın Alma Talebi</h3>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ürün Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={requestForm.item_name}
                      onChange={(e) => setRequestForm({ ...requestForm, item_name: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori</label>
                    <select
                      value={requestForm.category_id}
                      onChange={(e) => setRequestForm({ ...requestForm, category_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Aciliyet <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={requestForm.urgency}
                      onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                      <option value="urgent">Acil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={requestForm.quantity}
                      onChange={(e) => setRequestForm({ ...requestForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={requestForm.unit}
                      onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sebep / Açıklama</label>
                    <textarea
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Talep Gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false)
                      resetRequestForm()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'

type Tab = 'items' | 'entry' | 'exit' | 'history' | 'requests'

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
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)

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
        .eq('company_id', profile.company_id)
        .order('name')

      setDepartments(departmentsData || [])

      // Load warehouse items
      await loadItems(profile.company_id)

      // Load transactions
      await loadTransactions(profile.company_id)

      // Load purchase requests
      await loadRequests(profile.company_id)

    } catch (error) {
      console.error('Error loading data:', error)
      alert('Veri yüklenirken hata oluştu!')
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_items')
      .select(`
        *,
        category:warehouse_categories(name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code')

    const itemsData = data?.map((item: any) => ({
      ...item,
      category_name: item.category?.name || 'Bilinmiyor'
    })) || []

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
    const { data } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        category:warehouse_categories(name),
        requester:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    const requestsData = data?.map((r: any) => ({
      id: r.id,
      item_name: r.item_name,
      category_name: r.category?.name || 'Diğer',
      quantity: r.quantity,
      unit: r.unit,
      urgency: r.urgency,
      reason: r.reason || '',
      status: r.status,
      requested_by_name: r.requester?.full_name || 'Bilinmiyor',
      requested_at: r.requested_at
    })) || []

    setRequests(requestsData)
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

        {/* Continue in next message due to length... */}
      </div>
    </PermissionGuard>
  )
}

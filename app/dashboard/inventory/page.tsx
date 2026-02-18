'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

type Tab = 'stok' | 'giris' | 'cikis'

interface InventoryItem {
  id: string
  product_code: string
  product_name: string
  category: 'hammadde' | 'yarimamul' | 'mamul' | 'takim' | 'sarf'
  quantity: number
  unit: string
  min_stock_level: number
  unit_cost: number | null
  location: string | null
  created_at: string
}

interface Supplier {
  id: string
  company_name: string
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stok')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState<{
    product_code: string
    product_name: string
    category: 'hammadde' | 'yarimamul' | 'mamul' | 'takim' | 'sarf'
    quantity: number
    unit: string
    min_stock_level: number
    unit_cost: number
    location: string
  }>({
    product_code: '',
    product_name: '',
    category: 'hammadde',
    quantity: 0,
    unit: 'adet',
    min_stock_level: 0,
    unit_cost: 0,
    location: '',
  })

  const [girisForm, setGirisForm] = useState({
    item_id: '',
    quantity: 0,
    supplier: '',
    reference_number: '',
    notes: '',
  })

  const [cikisForm, setCikisForm] = useState({
    item_id: '',
    quantity: 0,
    destination: 'uretim',
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    let filtered = items
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.category === filterCategory)
    }
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    setFilteredItems(filtered)
  }, [items, filterCategory, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      if (!finalCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          await supabase.from('profiles').update({ company_id: finalCompanyId }).eq('id', user.id)
        } else {
          const { data: firstCompany } = await supabase
            .from('companies').select('id').limit(1).single()
          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            await supabase.from('profiles').update({ company_id: finalCompanyId }).eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) { setLoading(false); return }
      setCompanyId(finalCompanyId)

      // Load inventory items
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('product_code', { ascending: true })

      setItems(inventoryData || [])
      setFilteredItems(inventoryData || [])

      // Load suppliers
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', finalCompanyId)
        .eq('is_active', true)
        .order('company_name')

      setSuppliers(suppliersData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('inventory')
          .update({ ...formData })
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert({ company_id: companyId, ...formData })
        if (error) throw error
      }
      resetForm()
      setShowModal(false)
      loadData()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleStokGiris = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !girisForm.item_id) return

    try {
      const item = items.find(i => i.id === girisForm.item_id)
      if (!item) return

      const newQty = item.quantity + girisForm.quantity

      const { error } = await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', girisForm.item_id)

      if (error) throw error

      alert(`✅ Stok girişi yapıldı!\n${item.product_name}: ${item.quantity} → ${newQty} ${item.unit}`)
      setGirisForm({ item_id: '', quantity: 0, supplier: '', reference_number: '', notes: '' })
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleStokCikis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !cikisForm.item_id) return

    try {
      const item = items.find(i => i.id === cikisForm.item_id)
      if (!item) return

      if (cikisForm.quantity > item.quantity) {
        alert(`❌ Yetersiz stok!\nMevcut: ${item.quantity} ${item.unit}\nTalep: ${cikisForm.quantity} ${item.unit}`)
        return
      }

      const newQty = item.quantity - cikisForm.quantity

      const { error } = await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', cikisForm.item_id)

      if (error) throw error

      // Eğer üretime gönderildiyse, production_inventory'yi güncelle
      if (cikisForm.destination === 'uretim') {
        const { data: existingProdStock } = await supabase
          .from('production_inventory')
          .select('id, current_stock')
          .eq('company_id', companyId)
          .eq('item_id', cikisForm.item_id)
          .eq('item_type', 'raw_material')
          .maybeSingle()

        if (existingProdStock) {
          await supabase
            .from('production_inventory')
            .update({ current_stock: existingProdStock.current_stock + cikisForm.quantity })
            .eq('id', existingProdStock.id)
        } else {
          await supabase
            .from('production_inventory')
            .insert({
              company_id: companyId,
              item_id: cikisForm.item_id,
              item_code: item.product_code,
              item_name: item.product_name,
              item_type: 'raw_material',
              current_stock: cikisForm.quantity,
              unit: item.unit,
            })
        }
      }

      const destinationLabel = cikisForm.destination === 'uretim' ? 'Üretime' : 'Sevkiyat'
      alert(`✅ Stok çıkışı yapıldı!\n${item.product_name}: ${item.quantity} → ${newQty} ${item.unit}\nHedef: ${destinationLabel}`)
      setCikisForm({ item_id: '', quantity: 0, destination: 'uretim', notes: '' })
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleQuickGiris = (item: InventoryItem) => {
    setGirisForm({ ...girisForm, item_id: item.id })
    setActiveTab('giris')
  }

  const handleQuickCikis = (item: InventoryItem) => {
    setCikisForm({ ...cikisForm, item_id: item.id })
    setActiveTab('cikis')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      product_code: '',
      product_name: '',
      category: 'hammadde',
      quantity: 0,
      unit: 'adet',
      min_stock_level: 0,
      unit_cost: 0,
      location: '',
    })
    setEditingItem(null)
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      hammadde: 'Hammadde',
      yarimamul: 'Yarı Mamul',
      mamul: 'Mamul',
      takim: 'Takım',
      sarf: 'Sarf',
    }
    return labels[category] || category
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      hammadde: 'bg-blue-100 text-blue-700',
      yarimamul: 'bg-purple-100 text-purple-700',
      mamul: 'bg-green-100 text-green-700',
      takim: 'bg-orange-100 text-orange-700',
      sarf: 'bg-gray-100 text-gray-700',
    }
    return colors[category] || 'bg-gray-100 text-gray-700'
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Stokta Yok', color: 'text-red-600', bg: 'bg-red-100', bar: 0 }
    if (item.quantity < item.min_stock_level) return { label: 'Düşük Stok', color: 'text-orange-600', bg: 'bg-orange-100', bar: Math.round((item.quantity / item.min_stock_level) * 50) }
    return { label: 'Normal', color: 'text-green-600', bg: 'bg-green-100', bar: 100 }
  }

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

  const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity < item.min_stock_level)
  const outOfStockItems = items.filter(item => item.quantity === 0)
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0)
  const hammaddeCount = items.filter(i => i.category === 'hammadde').length

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Stok & Hammadde</h2>
            <p className="text-gray-600">Envanter yönetimi, stok giriş/çıkış ve üretim entegrasyonu</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Yeni Ürün Ekle
          </button>
        </div>

        {/* Düşük Stok Uyarısı */}
        {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-orange-800">Stok Uyarısı</p>
                <p className="text-sm text-orange-700">
                  {outOfStockItems.length > 0 && <span>{outOfStockItems.length} ürün stokta yok. </span>}
                  {lowStockItems.length > 0 && <span>{lowStockItems.length} ürün minimum stok altında.</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-sm font-medium">Toplam Kalem</p>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{items.length}</p>
            <p className="text-xs text-gray-500 mt-1">{hammaddeCount} hammadde</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-sm font-medium">Düşük Stok</p>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-orange-600">{lowStockItems.length}</p>
            <p className="text-xs text-gray-500 mt-1">minimum altında</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-sm font-medium">Stokta Yok</p>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600">{outOfStockItems.length}</p>
            <p className="text-xs text-gray-500 mt-1">acil temin gerekiyor</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-sm font-medium">Toplam Değer</p>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{totalValue.toLocaleString('tr-TR')} ₺</p>
            <p className="text-xs text-gray-500 mt-1">envanter değeri</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'stok', label: 'Stok Listesi', count: items.length },
              { id: 'giris', label: 'Stok Girişi', icon: '↓' },
              { id: 'cikis', label: 'Stok Çıkışı', icon: '↑' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>
                )}
                {tab.icon && <span>{tab.icon}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB: STOK LİSTESİ */}
        {activeTab === 'stok' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ürün kodu veya adı ara..."
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Tüm Kategoriler</option>
                <option value="hammadde">Hammadde</option>
                <option value="yarimamul">Yarı Mamul</option>
                <option value="mamul">Mamul</option>
                <option value="takim">Takım</option>
                <option value="sarf">Sarf Malzeme</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ürün</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stok</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stok Seviyesi</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Birim Fiyat</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lokasyon</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.length > 0 ? filteredItems.map((item) => {
                      const status = getStockStatus(item)
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{item.product_code}</p>
                              <p className="text-gray-500 text-xs mt-0.5">{item.product_name}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getCategoryColor(item.category)}`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800">{item.quantity}</span>
                              <span className="text-gray-500 text-sm">{item.unit}</span>
                            </div>
                            <p className="text-xs text-gray-400">Min: {item.min_stock_level}</p>
                          </td>
                          <td className="px-6 py-4 min-w-[140px]">
                            <span className={`text-xs font-semibold ${status.color} ${status.bg} px-2 py-1 rounded-full`}>
                              {status.label}
                            </span>
                            {item.min_stock_level > 0 && (
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    item.quantity === 0 ? 'bg-red-500' :
                                    item.quantity < item.min_stock_level ? 'bg-orange-400' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min((item.quantity / (item.min_stock_level * 2)) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {item.unit_cost ? `${item.unit_cost.toLocaleString('tr-TR')} ₺` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.location || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleQuickGiris(item)}
                                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-semibold transition-colors"
                                title="Stok Girişi"
                              >
                                ↓ Giriş
                              </button>
                              <button
                                onClick={() => handleQuickCikis(item)}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-semibold transition-colors"
                                title="Stok Çıkışı"
                              >
                                ↑ Çıkış
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(item)
                                  setFormData({
                                    product_code: item.product_code,
                                    product_name: item.product_name,
                                    category: item.category,
                                    quantity: item.quantity,
                                    unit: item.unit,
                                    min_stock_level: item.min_stock_level,
                                    unit_cost: item.unit_cost || 0,
                                    location: item.location || '',
                                  })
                                  setShowModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1.5"
                                title="Düzenle"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-red-500 hover:text-red-700 p-1.5"
                                title="Sil"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                          {searchTerm || filterCategory !== 'all'
                            ? 'Arama kriterlerine uygun ürün bulunamadı.'
                            : 'Henüz ürün bulunmuyor. Yeni ürün ekleyin.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STOK GİRİŞİ */}
        {activeTab === 'giris' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-700 font-bold text-lg">↓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Stok Girişi</h3>
                <p className="text-gray-500 text-sm">Depoya gelen malzemeleri kaydedin</p>
              </div>
            </div>

            <form onSubmit={handleStokGiris} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Stok Kalemi <span className="text-red-500">*</span>
                </label>
                <select
                  value={girisForm.item_id}
                  onChange={(e) => setGirisForm({ ...girisForm, item_id: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Ürün seçin...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.product_code} - {item.product_name} (Mevcut: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Giriş Miktarı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={girisForm.quantity || ''}
                    onChange={(e) => setGirisForm({ ...girisForm, quantity: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tedarikçi</label>
                  <select
                    value={girisForm.supplier}
                    onChange={(e) => setGirisForm({ ...girisForm, supplier: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seçin...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.company_name}>{s.company_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">İrsaliye / Referans No</label>
                <input
                  type="text"
                  value={girisForm.reference_number}
                  onChange={(e) => setGirisForm({ ...girisForm, reference_number: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="İRS-2025-001"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={girisForm.notes}
                  onChange={(e) => setGirisForm({ ...girisForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Opsiyonel not..."
                />
              </div>

              {/* Seçilen ürün bilgisi */}
              {girisForm.item_id && (() => {
                const selectedItem = items.find(i => i.id === girisForm.item_id)
                if (!selectedItem) return null
                const newQty = selectedItem.quantity + (girisForm.quantity || 0)
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-800 mb-1">Giriş Özeti</p>
                    <p className="text-sm text-green-700">
                      {selectedItem.product_name}: <span className="font-bold">{selectedItem.quantity}</span>
                      {' → '}
                      <span className="font-bold text-green-900">{newQty}</span>
                      {' '}{selectedItem.unit}
                    </p>
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  ↓ Stok Girişi Yap
                </button>
                <button
                  type="button"
                  onClick={() => setGirisForm({ item_id: '', quantity: 0, supplier: '', reference_number: '', notes: '' })}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Temizle
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: STOK ÇIKIŞI */}
        {activeTab === 'cikis' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-700 font-bold text-lg">↑</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Stok Çıkışı</h3>
                <p className="text-gray-500 text-sm">Depodan çıkan malzemeleri kaydedin</p>
              </div>
            </div>

            <form onSubmit={handleStokCikis} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Stok Kalemi <span className="text-red-500">*</span>
                </label>
                <select
                  value={cikisForm.item_id}
                  onChange={(e) => setCikisForm({ ...cikisForm, item_id: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Ürün seçin...</option>
                  {items.filter(i => i.quantity > 0).map(item => (
                    <option key={item.id} value={item.id}>
                      {item.product_code} - {item.product_name} (Mevcut: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Çıkış Miktarı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={cikisForm.quantity || ''}
                    onChange={(e) => setCikisForm({ ...cikisForm, quantity: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hedef <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cikisForm.destination}
                    onChange={(e) => setCikisForm({ ...cikisForm, destination: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="uretim">Üretime Gönder</option>
                    <option value="sevkiyat">Sevkiyat</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={cikisForm.notes}
                  onChange={(e) => setCikisForm({ ...cikisForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Opsiyonel not..."
                />
              </div>

              {/* Üretime gönder info banner */}
              {cikisForm.destination === 'uretim' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Üretim Entegrasyonu:</span> Bu hammadde üretim deposuna otomatik eklenecek. Üretim sayfasından üretim kaydı oluştururken kullanabilirsiniz.
                  </p>
                </div>
              )}

              {/* Seçilen ürün bilgisi */}
              {cikisForm.item_id && (() => {
                const selectedItem = items.find(i => i.id === cikisForm.item_id)
                if (!selectedItem) return null
                const newQty = selectedItem.quantity - (cikisForm.quantity || 0)
                const isInsufficient = newQty < 0
                return (
                  <div className={`border rounded-lg p-4 ${isInsufficient ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-sm font-semibold mb-1 ${isInsufficient ? 'text-red-800' : 'text-orange-800'}`}>Çıkış Özeti</p>
                    <p className={`text-sm ${isInsufficient ? 'text-red-700' : 'text-orange-700'}`}>
                      {selectedItem.product_name}: <span className="font-bold">{selectedItem.quantity}</span>
                      {' → '}
                      <span className={`font-bold ${isInsufficient ? 'text-red-900' : 'text-orange-900'}`}>{newQty}</span>
                      {' '}{selectedItem.unit}
                      {isInsufficient && <span className="ml-2 text-red-600 font-semibold">❌ Yetersiz stok!</span>}
                    </p>
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  ↑ Stok Çıkışı Yap
                </button>
                <button
                  type="button"
                  onClick={() => setCikisForm({ item_id: '', quantity: 0, destination: 'uretim', notes: '' })}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Temizle
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: Ürün Ekle/Düzenle */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                {editingItem ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Kodu <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.product_code}
                      onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="HMD-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori <span className="text-red-500">*</span></label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="hammadde">Hammadde</option>
                      <option value="yarimamul">Yarı Mamul</option>
                      <option value="mamul">Mamul</option>
                      <option value="takim">Takım</option>
                      <option value="sarf">Sarf Malzeme</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Adı <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ürün adı"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Miktar</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Birim</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="adet">Adet</option>
                      <option value="kg">Kg</option>
                      <option value="lt">Lt</option>
                      <option value="m">Metre</option>
                      <option value="m2">m²</option>
                      <option value="paket">Paket</option>
                      <option value="kutu">Kutu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min. Stok</label>
                    <input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Birim Fiyat (₺)</label>
                    <input
                      type="number"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lokasyon</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Raf A1"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    {editingItem ? 'Güncelle' : 'Ekle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm() }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
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

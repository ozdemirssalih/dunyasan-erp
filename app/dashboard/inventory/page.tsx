'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
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

  useEffect(() => {
    loadInventory()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        loadInventory()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Filter items based on category and search term
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

  const loadInventory = async () => {
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

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('product_code', { ascending: true })

      if (error) throw error
      setItems(data || [])
      setFilteredItems(data || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('inventory')
          .update({
            product_code: formData.product_code,
            product_name: formData.product_name,
            category: formData.category,
            quantity: formData.quantity,
            unit: formData.unit,
            min_stock_level: formData.min_stock_level,
            unit_cost: formData.unit_cost,
            location: formData.location,
          })
          .eq('id', editingItem.id)

        if (error) throw error
      } else {
        // Create new item
        const { error } = await supabase
          .from('inventory')
          .insert({
            company_id: companyId,
            product_code: formData.product_code,
            product_name: formData.product_name,
            category: formData.category,
            quantity: formData.quantity,
            unit: formData.unit,
            min_stock_level: formData.min_stock_level,
            unit_cost: formData.unit_cost,
            location: formData.location,
          })

        if (error) throw error
      }

      // Reset form and close modal
      resetForm()
      setShowModal(false)
      loadInventory()
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

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      product_code: item.product_code,
      product_name: item.product_name,
      category: item.category as 'hammadde' | 'yarimamul' | 'mamul' | 'takim' | 'sarf',
      quantity: item.quantity,
      unit: item.unit,
      min_stock_level: item.min_stock_level,
      unit_cost: item.unit_cost || 0,
      location: item.location || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadInventory()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels = {
      hammadde: 'Hammadde',
      yarimamul: 'Yarı Mamul',
      mamul: 'Mamul',
      takim: 'Takım',
      sarf: 'Sarf Malzeme',
    }
    return labels[category as keyof typeof labels]
  }

  const getCategoryBadge = (category: string) => {
    const styles = {
      hammadde: 'bg-blue-100 text-blue-700',
      yarimamul: 'bg-purple-100 text-purple-700',
      mamul: 'bg-green-100 text-green-700',
      takim: 'bg-orange-100 text-orange-700',
      sarf: 'bg-gray-100 text-gray-700',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[category as keyof typeof styles]}`}>
        {getCategoryLabel(category)}
      </span>
    )
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) {
      return <span className="text-red-600 font-semibold text-sm">Stokta Yok</span>
    }
    if (item.quantity < item.min_stock_level) {
      return <span className="text-orange-600 font-semibold text-sm">Düşük Stok</span>
    }
    return <span className="text-green-600 font-semibold text-sm">Normal</span>
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  const lowStockCount = items.filter(item => item.quantity < item.min_stock_level).length
  const outOfStockCount = items.filter(item => item.quantity === 0).length
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0)

  return (
    <PermissionGuard module="inventory" permission="view">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Stok & Hammadde</h2>
          <p className="text-gray-600">Envanter yönetimi ve stok takibi</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Yeni Ürün
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Toplam Ürün</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm font-medium">Düşük Stok</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Stokta Yok</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{outOfStockCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Toplam Değer</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{totalValue.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tümü</option>
              <option value="hammadde">Hammadde</option>
              <option value="yarimamul">Yarı Mamul</option>
              <option value="mamul">Mamul</option>
              <option value="takim">Takım</option>
              <option value="sarf">Sarf Malzeme</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün kodu veya adı..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ürün Kodu</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ürün Adı</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kategori</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Miktar</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Min. Stok</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Birim Fiyat</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Lokasyon</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Durum</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{item.product_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.product_name}</td>
                    <td className="px-6 py-4">{getCategoryBadge(item.category)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {item.min_stock_level} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {item.unit_cost ? `${item.unit_cost.toLocaleString('tr-TR')} ₺` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.location || '-'}</td>
                    <td className="px-6 py-4">{getStockStatus(item)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                          title="Düzenle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Sil"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingItem ? 'Ürünü Düzenle' : 'Yeni Ürün'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Kodu</label>
                <input
                  type="text"
                  value={formData.product_code}
                  onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="DCMT11T34"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Adı</label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Elmas Uç"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miktar</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="adet"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stok Seviyesi</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Birim Fiyat (₺)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Lokasyon</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Raf A1"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  {editingItem ? 'Güncelle' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
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

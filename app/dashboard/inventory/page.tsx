'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

type SourceFilter = 'all' | 'inventory' | 'warehouse' | 'production'

interface UnifiedItem {
  id: string
  rawId: string // gerçek veritabanı id'si
  code: string
  name: string
  category: string
  categoryId?: string
  quantity: number
  unit: string
  min_stock: number
  unit_price: number | null
  location: string | null
  source: 'inventory' | 'warehouse' | 'production'
}


export default function InventoryPage() {
  const [allItems, setAllItems] = useState<UnifiedItem[]>([])
  const [filteredItems, setFilteredItems] = useState<UnifiedItem[]>([])

  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Form: sadece min stok ve birim fiyat düzenlenebilir
  const [form, setForm] = useState({
    min_stock: 0,
    unit_price: 0,
  })

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let filtered = allItems
    if (sourceFilter !== 'all') filtered = filtered.filter(i => i.source === sourceFilter)
    if (categoryFilter !== 'all') filtered = filtered.filter(i => i.category === categoryFilter)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(i =>
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      )
    }
    setFilteredItems(filtered)
  }, [allItems, sourceFilter, searchTerm, categoryFilter])

  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    let cid = profile?.company_id

    if (!cid) {
      const { data: company } = await supabase
        .from('companies').select('id').ilike('name', '%dünyasan%').limit(1).single()
      if (company?.id) {
        cid = company.id
        await supabase.from('profiles').update({ company_id: cid }).eq('id', user.id)
      } else {
        const { data: first } = await supabase.from('companies').select('id').limit(1).single()
        if (first?.id) {
          cid = first.id
          await supabase.from('profiles').update({ company_id: cid }).eq('id', user.id)
        }
      }
    }
    return cid
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const cid = await getCompanyId()
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)

      // 1. warehouse_items
      const { data: whData } = await supabase
        .from('warehouse_items')
        .select('*, category:warehouse_categories(id, name)')
        .eq('company_id', cid)
        .eq('is_active', true)
        .order('code')

      const whItems: UnifiedItem[] = (whData || []).map((item: any) => ({
        id: `wh-${item.id}`,
        rawId: item.id,
        code: item.code,
        name: item.name,
        category: item.category?.name || 'Depo',
        categoryId: item.category?.id,
        quantity: item.current_stock,
        unit: item.unit,
        min_stock: item.min_stock || 0,
        unit_price: item.unit_price,
        location: item.location,
        source: 'warehouse',
      }))

      // 2. inventory tablosu
      const { data: invData } = await supabase
        .from('inventory').select('*').eq('company_id', cid).order('product_code')

      const invItems: UnifiedItem[] = (invData || []).map((item: any) => ({
        id: `inv-${item.id}`,
        rawId: item.id,
        code: item.product_code,
        name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        min_stock: item.min_stock_level || 0,
        unit_price: item.unit_cost,
        location: item.location,
        source: 'inventory',
      }))

      // 3. production_inventory
      const { data: prodData } = await supabase
        .from('production_inventory').select('*').eq('company_id', cid).order('item_code')

      const prodItems: UnifiedItem[] = (prodData || []).map((item: any) => ({
        id: `prod-${item.id}`,
        rawId: item.id,
        code: item.item_code,
        name: item.item_name,
        category: item.item_type === 'raw_material' ? 'Hammadde' :
                  item.item_type === 'finished_product' ? 'Bitmiş Ürün' : 'Yarı Mamul',
        quantity: item.current_stock,
        unit: item.unit,
        min_stock: 0,
        unit_price: null,
        location: null,
        source: 'production',
      }))

      setAllItems([...whItems, ...invItems, ...prodItems])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sadece inventory kalemleri düzenlenebilir, sadece min_stock ve unit_price
  const openEditModal = (item: UnifiedItem) => {
    if (item.source !== 'inventory') return
    setEditingItem(item)
    setForm({
      min_stock: item.min_stock,
      unit_price: item.unit_price || 0,
    })
    setShowModal(true)
  }

  // Sadece inventory tablosunda min_stock ve unit_price güncellenir
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || editingItem.source !== 'inventory') return
    setModalLoading(true)

    try {
      const { error } = await supabase.from('inventory').update({
        unit_cost: form.unit_price,
        min_stock_level: form.min_stock,
      }).eq('id', editingItem.rawId)
      if (error) throw error

      setShowModal(false)
      setEditingItem(null)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    } finally {
      setModalLoading(false)
    }
  }

  const getStockStatus = (item: UnifiedItem) => {
    if (item.quantity === 0) return { label: 'Stokta Yok', color: 'text-red-600', bg: 'bg-red-50' }
    if (item.min_stock > 0 && item.quantity < item.min_stock) return { label: 'Düşük Stok', color: 'text-orange-600', bg: 'bg-orange-50' }
    return { label: 'Normal', color: 'text-green-600', bg: 'bg-green-50' }
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'warehouse': return { label: 'Depo', bg: 'bg-purple-100 text-purple-700' }
      case 'inventory': return { label: 'Stok', bg: 'bg-blue-100 text-blue-700' }
      case 'production': return { label: 'Üretim', bg: 'bg-green-100 text-green-700' }
      default: return { label: source, bg: 'bg-gray-100 text-gray-700' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Stoklar yükleniyor...</p>
        </div>
      </div>
    )
  }

  const whCount = allItems.filter(i => i.source === 'warehouse').length
  const invCount = allItems.filter(i => i.source === 'inventory').length
  const prodCount = allItems.filter(i => i.source === 'production').length
  const lowStockCount = allItems.filter(i => i.quantity > 0 && i.min_stock > 0 && i.quantity < i.min_stock).length
  const outOfStockCount = allItems.filter(i => i.quantity === 0).length
  const totalValue = allItems.reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0)), 0)
  const uniqueCategories = Array.from(new Set(allItems.map(i => i.category))).sort()

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Stok & Hammadde</h2>
            <p className="text-gray-500 text-sm mt-1">Tüm stoklar: Depo · Envanter · Üretim</p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-semibold">{whCount} Depo</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{invCount} Stok</span>
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">{prodCount} Üretim</span>
          </div>
        </div>

        {/* Uyarı */}
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-orange-800">
              {outOfStockCount > 0 && <span className="font-semibold">{outOfStockCount} ürün stokta yok. </span>}
              {lowStockCount > 0 && <span>{lowStockCount} ürün minimum stok altında.</span>}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-gray-500 text-sm font-medium mb-1">Toplam Kalem</p>
            <p className="text-3xl font-bold text-gray-800">{allItems.length}</p>
            <p className="text-xs text-gray-400 mt-1">tüm kaynaklardan</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-gray-500 text-sm font-medium mb-1">Düşük Stok</p>
            <p className="text-3xl font-bold text-orange-500">{lowStockCount}</p>
            <p className="text-xs text-gray-400 mt-1">minimum altında</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-gray-500 text-sm font-medium mb-1">Stokta Yok</p>
            <p className="text-3xl font-bold text-red-500">{outOfStockCount}</p>
            <p className="text-xs text-gray-400 mt-1">acil temin</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-gray-500 text-sm font-medium mb-1">Envanter Değeri</p>
            <p className="text-2xl font-bold text-gray-800">{totalValue.toLocaleString('tr-TR')} ₺</p>
            <p className="text-xs text-gray-400 mt-1">fiyatlı kalemler</p>
          </div>
        </div>

        {/* Filtreler */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center shadow-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Kod, isim veya kategori ara..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'warehouse', label: 'Depo' },
              { key: 'inventory', label: 'Stok' },
              { key: 'production', label: 'Üretim' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setSourceFilter(f.key as SourceFilter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Tüm Kategoriler</option>
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={loadData} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">
            ↻ Yenile
          </button>
        </div>

        {/* Tablo */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm text-gray-500">{filteredItems.length} kalem gösteriliyor</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kaynak</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kod / Ad</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Miktar</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Durum</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Birim Fiyat</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lokasyon</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.length > 0 ? filteredItems.map((item) => {
                  const status = getStockStatus(item)
                  const badge = getSourceBadge(item.source)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg}`}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-800 text-sm">{item.code}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{item.name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{item.category}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-lg font-bold ${item.quantity === 0 ? 'text-red-500' : 'text-gray-800'}`}>{item.quantity}</span>
                        <span className="text-gray-400 text-sm ml-1">{item.unit}</span>
                        {item.min_stock > 0 && <p className="text-xs text-gray-400">Min: {item.min_stock}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.color} ${status.bg}`}>
                          {status.label}
                        </span>
                        {item.min_stock > 0 && (
                          <div className="mt-1.5 w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${item.quantity === 0 ? 'bg-red-500' : item.quantity < item.min_stock ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min((item.quantity / (item.min_stock * 2)) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {item.unit_price != null ? `${item.unit_price.toLocaleString('tr-TR')} ₺` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{item.location || '—'}</td>
                      <td className="px-5 py-3.5">
                        {item.source === 'inventory' ? (
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                            title="Min stok / Fiyat düzenle"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 px-1.5">—</span>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                      {searchTerm || sourceFilter !== 'all' || categoryFilter !== 'all'
                        ? 'Filtreye uygun kayıt bulunamadı.'
                        : 'Henüz stok kaydı bulunmuyor.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Sadece Min Stok & Birim Fiyat (inventory kalemleri) */}
        {showModal && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-7 max-w-sm w-full shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Min Stok & Fiyat Güncelle</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{editingItem.code} — {editingItem.name}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mevcut stok - salt okunur bilgi */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">Mevcut Stok</span>
                <span className="font-bold text-gray-800">{editingItem.quantity} {editingItem.unit}</span>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min. Stok Seviyesi</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Bu seviyenin altına düşünce uyarı verilir</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Birim Fiyat (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    {modalLoading ? 'Kaydediliyor...' : 'Güncelle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors"
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

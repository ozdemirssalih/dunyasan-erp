'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

type SourceFilter = 'all' | 'inventory' | 'warehouse' | 'production' | 'toolroom'

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
  supplier: string | null
  source: 'inventory' | 'warehouse' | 'production' | 'toolroom'
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

  // Kategoriler ve tedarikçiler (dropdown için)
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([])
  const [suppliers, setSuppliers] = useState<Array<{id: string, company_name: string}>>([])

  // Form: TAM DÜZENLEME - tüm alanlar
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: '',
    categoryId: '',
    quantity: 0,
    unit: '',
    min_stock: 0,
    unit_price: 0,
    location: '',
    supplier: '',
    supplierId: '',
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

      // Önce kategorileri çek (warehouse_categories)
      const { data: categoriesData } = await supabase
        .from('warehouse_categories')
        .select('id, name')
        .eq('company_id', cid)

      console.log('📁 Depo kategorileri:', categoriesData?.length || 0, 'adet')
      const categoryMap = new Map(categoriesData?.map(c => [c.id, c.name]) || [])
      // State'e kaydet (dropdown için)
      setCategories(categoriesData || [])

      // Suppliers (tedarikçiler) - ayrı çek
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', cid)

      console.log('🏢 Tedarikçiler:', suppliersData?.length || 0, 'adet')
      const supplierMap = new Map(suppliersData?.map(s => [s.id, s.company_name]) || [])
      // State'e kaydet (dropdown için)
      setSuppliers(suppliersData || [])

      // 1. warehouse_items (join'ler olmadan - sonra map ile eşleştir)
      const { data: whData, error: whError } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', cid)
        .eq('is_active', true)

      if (whError) {
        console.error('❌ Depo verileri hatası:', {
          message: whError.message,
          details: whError.details,
          hint: whError.hint,
          code: whError.code
        })
      }

      console.log('✅ Depo verileri:', whData?.length || 0, 'kayıt')
      if (whData && whData.length > 0) {
        console.log('📋 İlk depo kaydı:', whData[0])
        console.log('📋 Depo kolonları:', Object.keys(whData[0]))
      }

      const whItems: UnifiedItem[] = (whData || []).map((item: any) => {
        // Kod alanı: farklı kolon isimleri dene
        const code = item.code || item.item_code || item.product_code || item.id || 'KOD-YOK'
        // İsim alanı: farklı kolon isimleri dene
        const name = item.name || item.item_name || item.product_name || 'İsimsiz'

        // Kategori ve tedarikçi bilgisini map'lerden al
        const categoryId = item.category_id || item.warehouse_category_id
        const supplierId = item.supplier_id
        const categoryName = categoryId ? categoryMap.get(categoryId) : null
        const supplierName = supplierId ? supplierMap.get(supplierId) : null

        return {
          id: `wh-${item.id}`,
          rawId: item.id,
          code,
          name,
          category: categoryName || item.category_name || item.category || 'Kategorisiz',
          categoryId: categoryId,
          quantity: item.current_stock || item.quantity || 0,
          unit: item.unit || item.measurement_unit || 'adet',
          min_stock: item.min_stock || item.min_quantity || 0,
          unit_price: item.unit_price || item.price || null,
          location: item.location || item.shelf_location || null,
          supplier: supplierName || item.supplier_name || item.supplier || null,
          source: 'warehouse',
        }
      })

      console.log('📦 Depo kalemlerine dönüştürüldü:', whItems.length)

      // 2. inventory tablosu (supplier join'siz - hata veriyorsa)
      const { data: invData, error: invError } = await supabase
        .from('inventory').select('*').eq('company_id', cid)

      if (invError) console.error('❌ Stok verileri hatası:', invError)
      console.log('✅ Stok (inventory) verileri:', invData?.length || 0, 'kayıt')
      if (invData && invData.length > 0) {
        console.log('📋 İlk stok kaydı:', invData[0])
        console.log('📋 Stok kolonları:', Object.keys(invData[0]))
      }

      const invItems: UnifiedItem[] = (invData || []).map((item: any) => ({
        id: `inv-${item.id}`,
        rawId: item.id,
        code: item.product_code || item.code || item.item_code || 'KOD-YOK',
        name: item.product_name || item.name || item.item_name || 'İsimsiz',
        category: item.category || 'Stok',
        quantity: item.quantity || item.current_stock || 0,
        unit: item.unit || item.measurement_unit || 'adet',
        min_stock: item.min_stock_level || item.min_stock || 0,
        unit_price: item.unit_cost || item.unit_price || null,
        location: item.location || null,
        supplier: item.supplier_name || item.supplier || null,
        source: 'inventory',
      }))

      // 3. production_inventory
      const { data: prodData, error: prodError } = await supabase
        .from('production_inventory').select('*').eq('company_id', cid)

      if (prodError) console.error('❌ Üretim verileri hatası:', prodError)
      console.log('✅ Üretim (production_inventory) verileri:', prodData?.length || 0, 'kayıt')
      if (prodData && prodData.length > 0) {
        console.log('📋 İlk üretim kaydı:', prodData[0])
        console.log('📋 Üretim kolonları:', Object.keys(prodData[0]))
      }

      const prodItems: UnifiedItem[] = (prodData || []).map((item: any) => ({
        id: `prod-${item.id}`,
        rawId: item.id,
        code: item.item_code || item.code || item.product_code || 'KOD-YOK',
        name: item.item_name || item.name || item.product_name || 'İsimsiz',
        category: item.item_type === 'raw_material' ? 'Hammadde' :
                  item.item_type === 'finished_product' ? 'Bitmiş Ürün' :
                  item.item_type ? 'Yarı Mamul' : 'Üretim',
        quantity: item.current_stock || item.quantity || 0,
        unit: item.unit || item.measurement_unit || 'adet',
        min_stock: item.min_stock || 0,
        unit_price: item.unit_price || null,
        location: null,
        supplier: null,
        source: 'production',
      }))

      // 4. tools (takımhane) (supplier join'siz - hata veriyorsa)
      const { data: toolsData, error: toolError } = await supabase
        .from('tools').select('*').eq('company_id', cid).eq('is_active', true)

      if (toolError) console.error('❌ Takımhane verileri hatası:', toolError)
      console.log('✅ Takımhane (tools) verileri:', toolsData?.length || 0, 'kayıt')
      if (toolsData && toolsData.length > 0) {
        console.log('📋 İlk takımhane kaydı:', toolsData[0])
        console.log('📋 Takımhane kolonları:', Object.keys(toolsData[0]))
      }

      const toolItems: UnifiedItem[] = (toolsData || []).map((item: any) => ({
        id: `tool-${item.id}`,
        rawId: item.id,
        code: item.tool_code || item.code || item.item_code || 'KOD-YOK',
        name: item.tool_name || item.name || item.item_name || 'İsimsiz',
        category: item.tool_type || item.category || 'Takım',
        quantity: item.quantity || item.current_stock || 0,
        unit: item.unit || 'Adet',
        min_stock: item.min_quantity || item.min_stock || 0,
        unit_price: item.unit_price || item.price || 0,
        location: item.location || null,
        supplier: item.supplier_name || item.supplier || null,
        source: 'toolroom',
      }))

      const combinedItems = [...whItems, ...invItems, ...prodItems, ...toolItems]
      console.log('📊 TOPLAM KAYIT:', combinedItems.length, {
        depo: whItems.length,
        stok: invItems.length,
        üretim: prodItems.length,
        takımhane: toolItems.length
      })

      setAllItems(combinedItems)
    } catch (error) {
      console.error('❌ Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Inventory, toolroom VE WAREHOUSE kalemleri düzenlenebilir
  const openEditModal = (item: UnifiedItem) => {
    if (item.source !== 'inventory' && item.source !== 'toolroom' && item.source !== 'warehouse') return
    setEditingItem(item)
    // TAM DÜZENLEME - tüm alanları doldur
    setForm({
      code: item.code || '',
      name: item.name || '',
      category: item.category || '',
      categoryId: item.categoryId || '',
      quantity: item.quantity || 0,
      unit: item.unit || 'adet',
      min_stock: item.min_stock || 0,
      unit_price: item.unit_price || 0,
      location: item.location || '',
      supplier: item.supplier || '',
      supplierId: '', // Not stored in UnifiedItem, will be looked up if needed
    })
    setShowModal(true)
  }

  // TAM DÜZENLEME - Tüm alanları güncelle
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || (editingItem.source !== 'inventory' && editingItem.source !== 'toolroom' && editingItem.source !== 'warehouse')) return
    setModalLoading(true)

    try {
      if (editingItem.source === 'inventory') {
        const { error } = await supabase.from('inventory').update({
          product_code: form.code,
          product_name: form.name,
          category: form.category,
          quantity: form.quantity,
          unit: form.unit,
          min_stock_level: form.min_stock,
          unit_cost: form.unit_price,
          location: form.location || null,
          supplier: form.supplier || null,
        }).eq('id', editingItem.rawId)
        if (error) throw error
      } else if (editingItem.source === 'toolroom') {
        const { error } = await supabase.from('tools').update({
          tool_code: form.code,
          tool_name: form.name,
          tool_type: form.category,
          quantity: form.quantity,
          unit: form.unit,
          min_quantity: form.min_stock,
          unit_price: form.unit_price,
          location: form.location || null,
          supplier: form.supplier || null,
        }).eq('id', editingItem.rawId)
        if (error) throw error
      } else if (editingItem.source === 'warehouse') {
        // DEPO KALEMLERİ İÇİN TAM GÜNCELLEME
        const { error } = await supabase.from('warehouse_items').update({
          code: form.code,
          name: form.name,
          category_id: form.categoryId || null,
          current_stock: form.quantity,
          unit: form.unit,
          min_stock: form.min_stock,
          unit_price: form.unit_price,
          location: form.location || null,
          supplier_id: form.supplierId || null,
        }).eq('id', editingItem.rawId)
        if (error) throw error
      }

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
      case 'toolroom': return { label: 'Takımhane', bg: 'bg-orange-100 text-orange-700' }
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
  const toolCount = allItems.filter(i => i.source === 'toolroom').length
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
            <p className="text-gray-500 text-sm mt-1">Tüm stoklar: Depo · Envanter · Üretim · Takımhane</p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-semibold">{whCount} Depo</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{invCount} Stok</span>
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">{prodCount} Üretim</span>
            <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold">{toolCount} Takımhane</span>
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

        {/* Sekmeler (Tabs) - DAHA BELIRGIN */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-6 pt-4">
            <div className="flex gap-2 -mb-px overflow-x-auto">
              {[
                { key: 'all', label: 'Tümü', icon: '📊', count: allItems.length, color: 'border-gray-500 text-gray-700' },
                { key: 'warehouse', label: 'Depo', icon: '🏭', count: whCount, color: 'border-purple-500 text-purple-700' },
                { key: 'toolroom', label: 'Takımhane', icon: '🔧', count: toolCount, color: 'border-orange-500 text-orange-700' },
                { key: 'inventory', label: 'Stok', icon: '📦', count: invCount, color: 'border-blue-500 text-blue-700' },
                { key: 'production', label: 'Üretim', icon: '⚙️', count: prodCount, color: 'border-green-500 text-green-700' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setSourceFilter(f.key as SourceFilter)}
                  className={`px-5 py-3 border-b-4 font-semibold transition-all whitespace-nowrap ${
                    sourceFilter === f.key
                      ? `${f.color} border-b-4`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{f.icon}</span>
                  {f.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    sourceFilter === f.key ? 'bg-white bg-opacity-30' : 'bg-gray-100'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Filtre Alanları */}
          <div className="p-4 flex flex-wrap gap-3 items-center bg-gray-50">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Kod, isim veya kategori ara..."
              className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
            >
              <option value="all">📂 Tüm Kategoriler</option>
              {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
          </div>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tedarikçi</th>
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
                      <td className="px-5 py-3.5 text-sm text-gray-600">{item.supplier || '—'}</td>
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
                        {(item.source === 'inventory' || item.source === 'toolroom' || item.source === 'warehouse') ? (
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                            title="Tüm alanları düzenle"
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

        {/* Modal: TAM DÜZENLEME - Tüm Alanlar */}
        {showModal && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-7 max-w-2xl w-full shadow-2xl my-8">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Stok Kalemini Düzenle
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {editingItem.source === 'warehouse' && '🏭 Depo'}
                    {editingItem.source === 'inventory' && '📦 Stok'}
                    {editingItem.source === 'toolroom' && '🔧 Takımhane'}
                    {' • '}ID: {editingItem.rawId}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* İki Kolon Layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Sol Kolon */}
                  <div className="space-y-4">
                    {/* Kod */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Kod <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ürün/malzeme kodu"
                      />
                    </div>

                    {/* İsim */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        İsim <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ürün/malzeme adı"
                      />
                    </div>

                    {/* Kategori */}
                    {editingItem.source === 'warehouse' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori</label>
                        <select
                          value={form.categoryId}
                          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Kategori Seçin</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori</label>
                        <input
                          type="text"
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Kategori"
                        />
                      </div>
                    )}

                    {/* Lokasyon */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lokasyon</label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Raf/konum"
                      />
                    </div>
                  </div>

                  {/* Sağ Kolon */}
                  <div className="space-y-4">
                    {/* Miktar */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Miktar <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Birim */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Birim</label>
                      <input
                        type="text"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="adet, kg, m, vb."
                      />
                    </div>

                    {/* Min Stok */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min. Stok Seviyesi</label>
                      <input
                        type="number"
                        min="0"
                        value={form.min_stock}
                        onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Altına düşünce uyarı</p>
                    </div>

                    {/* Birim Fiyat */}
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
                  </div>
                </div>

                {/* Tedarikçi (Tam Genişlik) */}
                {editingItem.source === 'warehouse' ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tedarikçi</label>
                    <select
                      value={form.supplierId}
                      onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Tedarikçi Seçin</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.company_name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tedarikçi</label>
                    <input
                      type="text"
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Tedarikçi firma"
                    />
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    {modalLoading ? 'Kaydediliyor...' : '💾 Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
                  >
                    ❌ İptal
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

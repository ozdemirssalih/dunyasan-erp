'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

type SourceFilter = 'all' | 'inventory' | 'warehouse' | 'production' | 'toolroom'

// ── Sabit Konfigürasyonlar ───────────────
const WAREHOUSE_CATEGORIES = ['Aparat', 'Boryağ', 'Fire/Hurda', 'Hammadde', 'Hırdavat', 'Mamül', 'Sarf Malzemeleri', 'Temizlik Malzemeleri', 'Yarı Mamül', 'Kızak Yağı', 'Şartlandırıcı Yağ', 'Hidrolik Yağı']
const TOOL_TYPES = ['Kesici Takım', 'Ölçüm Aleti', 'Kumpas', 'Mikrometre', 'Matkap', 'Freze', 'Parmak Freze', 'Pafta', 'Diğer']
const LOCATION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const LOCATION_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1))

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
  currency: string | null // Para birimi (TL, USD, EUR)
  location: string | null
  supplier: string | null
  supplierId?: string | null
  model?: string | null  // Takımhane için
  notes?: string | null  // Takımhane için
  status?: string | null // Takımhane için (available, maintenance, broken, lost)
  description?: string | null // Depo için
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
  const [isAddMode, setIsAddMode] = useState(false) // Yeni ekleme modu
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tedarikçiler (dropdown için)
  const [suppliers, setSuppliers] = useState<Array<{id: string, company_name: string}>>([])
  // Depo kategorileri WAREHOUSE_CATEGORIES sabit listesinden gelecek
  // Takımhane kategorileri TOOL_TYPES sabit listesinden gelecek

  // Form: TAM DÜZENLEME - tüm alanlar + source (DEPO VE TAKİMHANEDEKİ GİBİ)
  const [form, setForm] = useState({
    source: 'warehouse' as 'warehouse' | 'inventory' | 'toolroom', // Kaynak seçimi
    code: '',
    name: '',
    description: '', // Açıklama (textarea)
    category: '', // Kategori (artık string - sabit listeden)
    quantity: 0,
    unit: 'adet',
    min_stock: 0,
    max_stock: 0, // Max stok (depo için)
    unit_price: 0,
    currency: 'TL', // Para birimi (TL, USD, EUR)
    location: '',
    location_letter: '', // Takımhane için
    location_number: '', // Takımhane için
    supplier: '',
    supplierId: '',
    model: '', // Model/Seri (takımhane için)
    notes: '', // Notlar (textarea - takımhane için)
    transaction_date: new Date().toISOString().split('T')[0], // İşlem tarihi
    delivery_document: null as File | null, // Teslim tutanağı dosyası
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

      // Suppliers (tedarikçiler) çek
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

        // Tedarikçi bilgisini map'ten al
        const supplierId = item.supplier_id
        const supplierName = supplierId ? supplierMap.get(supplierId) : null

        return {
          id: `wh-${item.id}`,
          rawId: item.id,
          code,
          name,
          category: item.category_name || item.category || 'Kategorisiz',
          categoryId: item.category_id || item.warehouse_category_id,
          quantity: item.current_stock || item.quantity || 0,
          unit: item.unit || item.measurement_unit || 'adet',
          min_stock: item.min_stock || item.min_quantity || 0,
          unit_price: item.unit_price || item.price || null,
          currency: item.currency || 'TL',
          location: item.location || item.shelf_location || null,
          supplier: supplierName || item.supplier_name || item.supplier || null,
          supplierId: item.supplier_id || null,
          description: item.description || null,
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
        currency: item.currency || 'TL',
        location: item.location || null,
        supplier: item.supplier_name || item.supplier || null,
        source: 'inventory',
      }))

      // 3. production_inventory (warehouse_items ile JOIN - kod/isim için)
      const { data: prodData, error: prodError } = await supabase
        .from('production_inventory')
        .select(`
          *,
          warehouse_items!item_id (
            id,
            code,
            name,
            category,
            unit,
            description
          )
        `)
        .eq('company_id', cid)

      if (prodError) console.error('❌ Üretim verileri hatası:', prodError)
      console.log('✅ Üretim (production_inventory) verileri:', prodData?.length || 0, 'kayıt')
      if (prodData && prodData.length > 0) {
        console.log('📋 İlk üretim kaydı:', prodData[0])
        console.log('📋 Üretim kolonları:', Object.keys(prodData[0]))
      }

      const prodItems: UnifiedItem[] = (prodData || []).map((item: any) => ({
        id: `prod-${item.id}`,
        rawId: item.id,
        code: item.warehouse_items?.code || 'KOD-YOK',
        name: item.warehouse_items?.name || 'İsimsiz',
        category: item.category || item.warehouse_items?.category || 'Hammadde',
        quantity: item.current_stock || 0,
        unit: item.warehouse_items?.unit || 'adet',
        min_stock: 0,
        unit_price: null,
        currency: null,
        location: null,
        supplier: null,
        description: item.warehouse_items?.description || null,
        source: 'production',
      }))

      // 4. tools (takımhane) - supplier join ile (takımhane sayfasındaki gibi)
      const { data: toolsData, error: toolError } = await supabase
        .from('tools')
        .select('*, supplier:suppliers(id, company_name)')
        .eq('company_id', cid)
        .eq('is_active', true)
        .order('tool_code')

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
        unit: 'Adet', // Takımhane'de her zaman Adet
        min_stock: item.min_quantity || item.min_stock || 0,
        unit_price: item.unit_price || item.price || 0,
        currency: item.currency || 'TL',
        location: item.location || null,
        supplier: item.supplier?.company_name || item.supplier_name || item.supplier || null,
        supplierId: item.supplier_id || null,
        model: item.model || null,
        notes: item.notes || null,
        status: item.status || null,
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

  // YENİ STOK KALEMİ EKLE
  const openAddModal = () => {
    setIsAddMode(true)
    setEditingItem(null)
    setForm({
      source: 'warehouse', // Varsayılan kaynak
      code: '',
      name: '',
      description: '',
      category: '',
      quantity: 0,
      unit: 'adet',
      min_stock: 0,
      max_stock: 0,
      unit_price: 0,
      currency: 'TL',
      location: '',
      location_letter: '',
      location_number: '',
      supplier: '',
      supplierId: '',
      model: '',
      notes: '',
      transaction_date: new Date().toISOString().split('T')[0],
      delivery_document: null,
    })
    setShowModal(true)
  }

  // MEVCUT STOK KALEMİNİ DÜZENLE
  const openEditModal = (item: UnifiedItem) => {
    if (item.source !== 'inventory' && item.source !== 'toolroom' && item.source !== 'warehouse') return
    setIsAddMode(false)
    setEditingItem(item)

    // Takımhane için lokasyon parsing (A-1 formatından letter ve number çıkar)
    const locParts = (item.location || '').split('-')
    const location_letter = item.source === 'toolroom' && locParts.length === 2 ? locParts[0] : ''
    const location_number = item.source === 'toolroom' && locParts.length === 2 ? locParts[1] : ''

    // TAM DÜZENLEME - tüm alanları doldur
    setForm({
      source: item.source,
      code: item.code || '',
      name: item.name || '',
      description: item.description || '', // Depo için
      category: item.category || '',
      quantity: item.quantity || 0,
      unit: item.unit || 'adet',
      min_stock: item.min_stock || 0,
      max_stock: 0, // Düzenleme modunda veritabanından çekilecek (depo için)
      unit_price: item.unit_price || 0,
      currency: item.currency || 'TL',
      location: item.location || '',
      location_letter,
      location_number,
      supplier: item.supplier || '',
      supplierId: item.supplierId || '',
      model: item.model || '', // Takımhane için
      notes: item.notes || '', // Takımhane için
      transaction_date: new Date().toISOString().split('T')[0],
      delivery_document: null,
    })
    setShowModal(true)
  }

  // KAYDET - Yeni Ekleme veya Güncelleme
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!companyId) return

    setIsSubmitting(true)
    setModalLoading(true)

    try {
      // Dosya boyut kontrolü (10 MB = 10 * 1024 * 1024 bytes)
      if (form.delivery_document && form.delivery_document.size > 10 * 1024 * 1024) {
        alert('❌ Dosya boyutu 10 MB\'dan büyük olamaz!')
        setModalLoading(false)
        return
      }

      // Teslim tutanağı dosyasını yükle (varsa ve sadece yeni ekleme ise)
      let deliveryDocumentUrl = null
      if (isAddMode && form.delivery_document) {
        const fileExt = form.delivery_document.name.split('.').pop()
        const fileName = `${companyId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('delivery-documents')
          .upload(fileName, form.delivery_document)

        if (uploadError) {
          console.error('Dosya yükleme hatası:', uploadError)
          alert('⚠️ Dosya yüklenemedi, ancak işlem devam ediyor...')
        } else {
          // Public URL al
          const { data: urlData } = supabase.storage
            .from('delivery-documents')
            .getPublicUrl(fileName)
          deliveryDocumentUrl = urlData.publicUrl
        }
      }

      const targetSource = isAddMode ? form.source : editingItem?.source

      if (targetSource === 'inventory') {
        const data: any = {
          company_id: companyId,
          product_code: form.code,
          product_name: form.name,
          category: form.category,
          quantity: form.quantity,
          unit: form.unit,
          min_stock_level: form.min_stock,
          unit_cost: form.unit_price,
          currency: form.currency,
          location: form.location || null,
          supplier: form.supplier || null,
        }

        if (isAddMode) {
          if (deliveryDocumentUrl) data.delivery_document_url = deliveryDocumentUrl
          if (form.transaction_date) data.transaction_date = form.transaction_date
          const { error } = await supabase.from('inventory').insert(data)
          if (error) throw error
        } else if (editingItem) {
          const { error } = await supabase.from('inventory').update(data).eq('id', editingItem.rawId)
          if (error) throw error
        }
      } else if (targetSource === 'toolroom') {
        // TAKIMHANE - Takımhane sayfasındaki gibi TAM uyumlu
        const location = form.location_letter && form.location_number
          ? `${form.location_letter}-${form.location_number}`
          : null

        const data: any = {
          company_id: companyId,
          tool_code: form.code.trim(),
          tool_name: form.name.trim(),
          tool_type: form.category || null,
          quantity: form.quantity,
          min_quantity: form.min_stock,
          unit_price: form.unit_price,
          currency: form.currency,
          location,
          status: editingItem?.status || 'available', // Yeni ekleme: available, düzenleme: mevcut status
          is_active: true,
        }

        // Optional alanlar
        if (form.supplierId && form.supplierId.trim() !== '') {
          data.supplier_id = form.supplierId
        }
        if (form.model && form.model.trim() !== '') {
          data.model = form.model.trim()
        }
        if (form.notes && form.notes.trim() !== '') {
          data.notes = form.notes.trim()
        }

        if (isAddMode) {
          if (deliveryDocumentUrl) data.delivery_document_url = deliveryDocumentUrl
          if (form.transaction_date) data.transaction_date = form.transaction_date
          const { error } = await supabase.from('tools').insert(data)
          if (error) throw error
        } else if (editingItem) {
          const { error } = await supabase.from('tools').update(data).eq('id', editingItem.rawId)
          if (error) throw error
        }
      } else if (targetSource === 'warehouse') {
        // DEPO - Depodaki gibi detaylı
        const data: any = {
          company_id: companyId,
          code: form.code,
          name: form.name,
          current_stock: form.quantity,
          unit: form.unit,
          min_stock: form.min_stock,
          unit_price: form.unit_price,
          currency: form.currency,
          is_active: true,
        }

        // Optional alanlar - sadece değer varsa ekle
        if (form.description && form.description.trim() !== '') {
          data.description = form.description
        }
        if (form.category && form.category.trim() !== '') {
          data.category = form.category
        }
        if (form.location && form.location.trim() !== '') {
          data.location = form.location
        }
        if (form.supplierId && form.supplierId.trim() !== '') {
          data.supplier_id = form.supplierId
        }
        if (form.max_stock && form.max_stock > 0) {
          data.max_stock = form.max_stock
        }

        if (isAddMode) {
          if (deliveryDocumentUrl) data.delivery_document_url = deliveryDocumentUrl
          if (form.transaction_date) data.transaction_date = form.transaction_date
          const { error } = await supabase.from('warehouse_items').insert(data)
          if (error) throw error
        } else if (editingItem) {
          const { error } = await supabase.from('warehouse_items').update(data).eq('id', editingItem.rawId)
          if (error) throw error
        }
      }

      setShowModal(false)
      setEditingItem(null)
      setIsAddMode(false)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    } finally {
      setIsSubmitting(false)
      setModalLoading(false)
    }
  }

  const deleteItem = async (item: UnifiedItem) => {
    if (!confirm(`"${item.code} - ${item.name}" kaydını silmek istediğinize emin misiniz?`)) return

    try {
      let error
      if (item.source === 'warehouse') {
        const result = await supabase.from('warehouse_items').delete().eq('id', item.rawId)
        error = result.error
      } else if (item.source === 'inventory') {
        const result = await supabase.from('inventory').delete().eq('id', item.rawId)
        error = result.error
      } else if (item.source === 'toolroom') {
        // Takımhane için soft delete (is_active = false)
        const result = await supabase.from('tools').update({ is_active: false }).eq('id', item.rawId)
        error = result.error
      } else {
        alert('Bu kaynaktan silme işlemi desteklenmiyor.')
        return
      }

      if (error) throw error
      await loadData()
    } catch (error: any) {
      alert('❌ Silme hatası: ' + error.message)
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

  // Para birimlerine göre ayrı envanter değerleri
  const totalValueTL = allItems.filter(i => i.currency === 'TL').reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0)), 0)
  const totalValueUSD = allItems.filter(i => i.currency === 'USD').reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0)), 0)
  const totalValueEUR = allItems.filter(i => i.currency === 'EUR').reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0)), 0)
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
          <div className="flex items-center gap-3">
            {/* Yeni Ekle Butonu */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Stok Kalemi
            </button>
            {/* Stats */}
            <div className="flex gap-2 text-sm">
              <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-semibold">{whCount} Depo</span>
              <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">{invCount} Stok</span>
              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">{prodCount} Üretim</span>
              <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold">{toolCount} Takımhane</span>
            </div>
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
            <p className="text-gray-500 text-sm font-medium mb-2">Envanter Değeri</p>
            <div className="space-y-1.5">
              {totalValueTL > 0 && (
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-800">{totalValueTL.toLocaleString('tr-TR')}</p>
                  <p className="text-sm text-gray-500">₺</p>
                </div>
              )}
              {totalValueUSD > 0 && (
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-800">{totalValueUSD.toLocaleString('tr-TR')}</p>
                  <p className="text-sm text-gray-500">$</p>
                </div>
              )}
              {totalValueEUR > 0 && (
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-800">{totalValueEUR.toLocaleString('tr-TR')}</p>
                  <p className="text-sm text-gray-500">€</p>
                </div>
              )}
              {totalValueTL === 0 && totalValueUSD === 0 && totalValueEUR === 0 && (
                <p className="text-2xl font-bold text-gray-300">0 ₺</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">fiyatlı kalemler</p>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marka / Model</th>
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
                      <td className="px-5 py-3.5">
                        {item.model ? (
                          <span className="text-sm font-semibold text-gray-900">{item.model}</span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.supplier ? (
                          <span className="text-sm text-gray-700">{item.supplier}</span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
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
                        {item.unit_price != null ? (
                          <>
                            {item.unit_price.toLocaleString('tr-TR')}{' '}
                            {item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₺'}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{item.location || '—'}</td>
                      <td className="px-5 py-3.5">
                        {(item.source === 'inventory' || item.source === 'toolroom' || item.source === 'warehouse') ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                              title="Düzenle"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                              title="Sil"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
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
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-7 max-w-2xl w-full shadow-2xl my-8">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {isAddMode ? '➕ Yeni Stok Kalemi Ekle' : '✏️ Stok Kalemini Düzenle'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {!isAddMode && editingItem && (
                      <>
                        {editingItem.source === 'warehouse' && '🏭 Depo'}
                        {editingItem.source === 'inventory' && '📦 Stok'}
                        {editingItem.source === 'toolroom' && '🔧 Takımhane'}
                        {' • '}ID: {editingItem.rawId}
                      </>
                    )}
                    {isAddMode && 'Tüm bölümlerin stokları merkezi olarak yönetiliyor'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* KAYNAK SEÇİMİ (Sadece yeni ekleme modunda) */}
                {isAddMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      Kaynak Seç <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, source: 'warehouse' })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          form.source === 'warehouse'
                            ? 'border-purple-500 bg-purple-100 text-purple-700 font-bold'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">🏭</div>
                        <div className="text-sm">Depo</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, source: 'inventory' })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          form.source === 'inventory'
                            ? 'border-blue-500 bg-blue-100 text-blue-700 font-bold'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">📦</div>
                        <div className="text-sm">Stok</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, source: 'toolroom' })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          form.source === 'toolroom'
                            ? 'border-orange-500 bg-orange-100 text-orange-700 font-bold'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-orange-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">🔧</div>
                        <div className="text-sm">Takımhane</div>
                      </button>
                    </div>
                  </div>
                )}

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

                    {/* Açıklama (DEPO için - col-span-2) */}
                    {form.source === 'warehouse' && (
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Açıklama</label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                          placeholder="Ürün açıklaması..."
                        />
                      </div>
                    )}

                    {/* Kategori - Kaynağa göre dinamik */}
                    {form.source === 'warehouse' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori</label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Seçin...</option>
                          {WAREHOUSE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    ) : form.source === 'toolroom' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Türü</label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Seçiniz (Opsiyonel)</option>
                          {TOOL_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
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
                          placeholder="Kategori girin"
                        />
                      </div>
                    )}

                    {/* Tedarikçi - Sol Kolon (warehouse/toolroom için dropdown) */}
                    {form.source === 'warehouse' || form.source === 'toolroom' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tedarikçi</label>
                        <select
                          value={form.supplierId}
                          onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Seçiniz (Opsiyonel)</option>
                          {suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.company_name}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {/* Model/Seri (TAKIMHANE için) */}
                    {form.source === 'toolroom' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Model / Seri</label>
                        <input
                          type="text"
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="CoroMill 390..."
                        />
                      </div>
                    )}

                    {/* Lokasyon (TAKIMHANE için 2 dropdown / Diğerleri için input) */}
                    {form.source === 'toolroom' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lokasyon</label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={form.location_letter}
                            onChange={(e) => setForm({ ...form, location_letter: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Harf</option>
                            {LOCATION_LETTERS.map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                          <select
                            value={form.location_number}
                            onChange={(e) => setForm({ ...form, location_number: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Sayı</option>
                            {LOCATION_NUMBERS.map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Konum / Raf</label>
                        <input
                          type="text"
                          value={form.location}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Örn: A-12-3"
                        />
                      </div>
                    )}
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

                    {/* Birim (DROPDOWN - Depodaki gibi / Takımhane sabit Adet) */}
                    {form.source === 'toolroom' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Birim</label>
                        <input
                          type="text"
                          value="Adet"
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600"
                        />
                      </div>
                    ) : form.source === 'warehouse' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Birim <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                    ) : (
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
                    )}

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

                    {/* Max Stok (SADECE DEPO için) */}
                    {form.source === 'warehouse' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max. Stok Seviyesi</label>
                        <input
                          type="number"
                          min="0"
                          value={form.max_stock}
                          onChange={(e) => setForm({ ...form, max_stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Maksimum stok limiti</p>
                      </div>
                    )}

                    {/* Birim Fiyat ve Para Birimi */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Birim Fiyat</label>
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
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Para Birimi</label>
                        <select
                          value={form.currency}
                          onChange={(e) => setForm({ ...form, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                          <option value="TL">₺ TL</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notlar (TAKIMHANE için - Tam Genişlik) */}
                {form.source === 'toolroom' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Ek bilgiler..."
                    />
                  </div>
                )}

                {/* İşlem Tarihi ve Teslim Tutanağı (Sadece YENİ EKLEME için) */}
                {isAddMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">İşlem Tarihi</label>
                      <input
                        type="date"
                        value={form.transaction_date}
                        onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">📎 Teslim Tutanağı</label>
                      <input
                        type="file"
                        accept="*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              alert('❌ Dosya boyutu 10 MB\'dan büyük olamaz!')
                              e.target.value = ''
                              return
                            }
                            setForm({ ...form, delivery_document: file })
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {form.delivery_document && (
                        <p className="text-xs text-green-600 font-semibold mt-1">
                          ✓ {form.delivery_document.name} ({(form.delivery_document.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tedarikçi (Sadece STOK/INVENTORY için - Tam Genişlik) */}
                {form.source === 'inventory' && (
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
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    {isSubmitting ? 'Kaydediliyor...' : '💾 Kaydet'}
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

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Package, Search, X, Eye } from 'lucide-react'

// ── Tipler ───────────────────────────────────────────────────
type ToolStatus = 'available' | 'maintenance' | 'broken' | 'lost'
type StatusFilter = 'all' | ToolStatus

interface Tool {
  id: string
  tool_code: string
  tool_name: string
  tool_type: string | null
  supplier_id: string | null
  model: string | null
  location: string | null
  quantity: number
  min_quantity: number
  status: ToolStatus
  notes: string | null
  supplier?: {
    id: string
    company_name: string
  } | null
}

// ── Sabit Konfigürasyonlar ───────────────────────────────────
const STATUS: Record<ToolStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available:   { label: 'Müsait',   bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-200' },
  maintenance: { label: 'Bakımda',  bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  broken:      { label: 'Arızalı',  bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200' },
  lost:        { label: 'Kayıp',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   border: 'border-gray-300' },
}

// ── Ana Bileşen ──────────────────────────────────────────────
export default function ToolroomViewPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filtreler
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredTools, setFilteredTools] = useState<Tool[]>([])

  // Dinamik filtre listeleri
  const [uniqueTypes, setUniqueTypes] = useState<string[]>([])
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([])

  // Detay modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)

  // ── Lifecycle ────────────────────────────────────────────
  useEffect(() => { loadTools() }, [])

  // Unique listeleri güncelle
  useEffect(() => {
    const types = Array.from(new Set(tools.map(t => t.tool_type).filter(Boolean))).sort() as string[]
    const locations = Array.from(new Set(tools.map(t => t.location).filter(Boolean))).sort() as string[]
    setUniqueTypes(types)
    setUniqueLocations(locations)
  }, [tools])

  // Filtreleme
  useEffect(() => {
    let f = tools
    if (statusFilter !== 'all') f = f.filter(t => t.status === statusFilter)
    if (typeFilter !== 'all') f = f.filter(t => (t.tool_type || '') === typeFilter)
    if (locationFilter !== 'all') f = f.filter(t => (t.location || '') === locationFilter)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      f = f.filter(t =>
        t.tool_code.toLowerCase().includes(q) ||
        t.tool_name.toLowerCase().includes(q) ||
        (t.tool_type || '').toLowerCase().includes(q) ||
        (t.supplier?.company_name || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      )
    }
    setFilteredTools(f)
  }, [tools, statusFilter, typeFilter, locationFilter, searchTerm])

  // ── Veri Yükleme ─────────────────────────────────────────
  const loadTools = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const cid = profile?.company_id
      if (!cid) return
      setCompanyId(cid)

      const { data, error } = await supabase
        .from('tools')
        .select('*, supplier:suppliers(id, company_name)')
        .eq('company_id', cid)
        .eq('is_active', true)
        .order('tool_code')

      if (error) throw error
      setTools(data || [])
    } catch (error) {
      console.error('Takımlar yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDetailModal = (tool: Tool) => {
    setSelectedTool(tool)
    setShowDetailModal(true)
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedTool(null)
  }

  // ── İstatistikler ────────────────────────────────────────
  const lowStockCount = tools.filter(t => t.quantity < t.min_quantity).length
  const maintenanceCount = tools.filter(t => t.status === 'maintenance' || t.status === 'broken').length
  const totalToolsCount = tools.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Takımlar yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Eye className="w-8 h-8" />
              Takımhane Görüntüleme
            </h1>
            <p className="text-blue-100 mt-2">Sadece görüntüleme ve arama • Düzenleme yetkisi yok</p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalToolsCount}</div>
              <div className="text-sm text-blue-200">Toplam Takım</div>
            </div>
            <div className="w-px h-12 bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-300">{lowStockCount}</div>
              <div className="text-sm text-blue-200">Düşük Stok</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Arama */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ara... (kod, isim, tip, tedarikçi)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Durum */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
          >
            <option value="all">Tüm Durumlar ({tools.length})</option>
            <option value="available">Müsait ({tools.filter(t => t.status === 'available').length})</option>
            <option value="maintenance">Bakımda ({tools.filter(t => t.status === 'maintenance').length})</option>
            <option value="broken">Arızalı ({tools.filter(t => t.status === 'broken').length})</option>
            <option value="lost">Kayıp ({tools.filter(t => t.status === 'lost').length})</option>
          </select>

          {/* Kategori */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
          >
            <option value="all">Tüm Kategoriler ({tools.length})</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type} ({tools.filter(t => t.tool_type === type).length})</option>
            ))}
          </select>

          {/* Lokasyon */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
          >
            <option value="all">Tüm Lokasyonlar ({tools.length})</option>
            {uniqueLocations.map(loc => (
              <option key={loc} value={loc}>{loc} ({tools.filter(t => t.location === loc).length})</option>
            ))}
          </select>
        </div>

        {/* Temizle Butonu */}
        {(statusFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all' || searchTerm) && (
          <button
            onClick={() => {
              setStatusFilter('all')
              setTypeFilter('all')
              setLocationFilter('all')
              setSearchTerm('')
            }}
            className="mt-4 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 font-semibold"
            title="Tüm filtreleri temizle"
          >
            <X className="w-4 h-4" /> Temizle
          </button>
        )}

        {/* Sonuçlar */}
        {(statusFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all' || searchTerm) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">
              {filteredTools.length} / {tools.length} takım gösteriliyor
            </span>
            {statusFilter !== 'all' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                Durum: {STATUS[statusFilter].label}
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                Kategori: {typeFilter}
              </span>
            )}
            {locationFilter !== 'all' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                Lokasyon: {locationFilter}
              </span>
            )}
            {searchTerm && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-semibold">
                Arama: "{searchTerm}"
              </span>
            )}
          </div>
        )}
      </div>

      {/* Takım Listesi - Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTools.map(tool => {
          const st = STATUS[tool.status]
          const isLowStock = tool.quantity < tool.min_quantity
          return (
            <div
              key={tool.id}
              className={`bg-white rounded-xl border-2 ${st.border} shadow-md hover:shadow-xl transition-all p-5 cursor-pointer`}
              onClick={() => openDetailModal(tool)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className="font-bold text-gray-800 text-sm">{tool.tool_code}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{tool.tool_name}</h3>
                </div>
                <Package className="w-5 h-5 text-gray-400" />
              </div>

              {/* Detaylar */}
              <div className="space-y-2 text-sm">
                {tool.tool_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">Tip:</span>
                    <span className="font-semibold text-gray-700">{tool.tool_type}</span>
                  </div>
                )}
                {tool.location && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">Lokasyon:</span>
                    <span className="font-semibold text-gray-700">{tool.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Stok:</span>
                  <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {tool.quantity} / {tool.min_quantity} min
                  </span>
                </div>
              </div>

              {/* Durum */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${st.bg} ${st.text}`}>
                  {st.label}
                </span>
              </div>

              {/* Düşük Stok Uyarısı */}
              {isLowStock && (
                <div className="mt-2 text-xs text-red-600 font-semibold">
                  ⚠️ Stok yetersiz
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Boş Durum */}
      {filteredTools.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">Takım Bulunamadı</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all'
              ? 'Filtreleri değiştirerek tekrar deneyin'
              : 'Henüz takım kaydı bulunmuyor'}
          </p>
        </div>
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className={`${STATUS[selectedTool.status].bg} ${STATUS[selectedTool.status].text} p-6 rounded-t-2xl`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Package className="w-7 h-7" />
                    {selectedTool.tool_code}
                  </h2>
                  <p className="mt-1 text-lg opacity-90">{selectedTool.tool_name}</p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="p-2 hover:bg-black hover:bg-opacity-10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Durum */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Durum</h3>
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${STATUS[selectedTool.status].bg} ${STATUS[selectedTool.status].text}`}>
                  {STATUS[selectedTool.status].label}
                </span>
              </div>

              {/* Stok Bilgisi */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Stok Durumu</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Mevcut Miktar</div>
                    <div className={`text-2xl font-bold ${selectedTool.quantity < selectedTool.min_quantity ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedTool.quantity}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Minimum Miktar</div>
                    <div className="text-2xl font-bold text-gray-700">{selectedTool.min_quantity}</div>
                  </div>
                </div>
              </div>

              {/* Detaylar */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Detaylar</h3>
                <div className="space-y-3">
                  {selectedTool.tool_type && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Tip:</span>
                      <span className="font-semibold text-gray-900">{selectedTool.tool_type}</span>
                    </div>
                  )}
                  {selectedTool.location && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Lokasyon:</span>
                      <span className="font-semibold text-gray-900">{selectedTool.location}</span>
                    </div>
                  )}
                  {selectedTool.model && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Model:</span>
                      <span className="font-semibold text-gray-900">{selectedTool.model}</span>
                    </div>
                  )}
                  {selectedTool.supplier && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Tedarikçi:</span>
                      <span className="font-semibold text-gray-900">{selectedTool.supplier.company_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notlar */}
              {selectedTool.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Notlar</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTool.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 rounded-b-2xl">
              <button
                onClick={closeDetailModal}
                className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

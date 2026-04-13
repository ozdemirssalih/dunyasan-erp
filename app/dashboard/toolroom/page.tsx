'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { Package, Wrench, Truck, Plus, Edit, Trash2, Search, X, ShoppingCart } from 'lucide-react'

// ── Tipler ───────────────────────────────────────────────────
type Tab = 'inventory' | 'maintenance'
type ToolStatus = 'available' | 'maintenance' | 'broken' | 'lost'
type StatusFilter = 'all' | ToolStatus

interface Tool {
  id: string
  tool_code: string
  tool_name: string
  tool_type: string | null
  supplier_id: string | null
  model: string | null
  supplier_brand: string | null
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

interface Supplier {
  id: string
  company_name: string
}

interface Machine {
  id: string
  machine_name: string
  machine_code: string
}

interface MaintenanceRecord {
  id: string
  tool_id: string
  maintenance_type: string
  performed_at: string
  performed_by: string | null
  cost: number | null
  notes: string | null
  status_after: string | null
  tool: { tool_code: string; tool_name: string } | null
}

// ── Sabit Konfigürasyonlar ───────────────────────────────────
const TOOL_TYPES = ['Kesici Takım', 'Ölçüm Aleti', 'Kumpas', 'Mikrometre', 'Matkap', 'Freze', 'Parmak Freze', 'Pafta', 'Diğer']
const LOCATION_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const LOCATION_NUMBERS = Array.from({ length: 30 }, (_, i) => String(i + 1))

const STATUS: Record<ToolStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available:   { label: 'Müsait',   bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-200' },
  maintenance: { label: 'Bakımda',  bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  broken:      { label: 'Arızalı',  bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200' },
  lost:        { label: 'Kayıp',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   border: 'border-gray-300' },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ── Ana Bileşen ──────────────────────────────────────────────
export default function ToolroomPage() {
  const { canCreate, canEdit, canDelete } = usePermissions()

  const [tab, setTab] = useState<Tab>('inventory')
  const [tools, setTools] = useState<Tool[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filtreler (Envanter tab)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredTools, setFilteredTools] = useState<Tool[]>([])

  // Dinamik filtre listeleri
  const [uniqueTypes, setUniqueTypes] = useState<string[]>([])
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([])

  // ── Modaller ─────────────────────────────────────────────
  // 1. Ekle / Düzenle
  const [showToolModal, setShowToolModal] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [toolModalLoading, setToolModalLoading] = useState(false)
  const [toolForm, setToolForm] = useState({
    tool_code: '', tool_name: '', tool_type: '', supplier_id: '', model: '',
    location_letter: '', location_number: '', quantity: 1, min_quantity: 1, notes: '',
  })

  // 2. Tezgaha Ver
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [deliveryTarget, setDeliveryTarget] = useState<Tool | null>(null)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState({
    machine_id: '', quantity: 1, delivered_by: '', notes: '',
  })

  // 3. Durum Değiştir
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Tool | null>(null)

  // 4. Bakım Ekle
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceTool, setMaintenanceTool] = useState<Tool | null>(null)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: '', performed_by: '', cost: '', notes: '', status_after: 'available' as ToolStatus,
  })

  // 5. Satın Alma Talebi
  const [showPurchaseRequestModal, setShowPurchaseRequestModal] = useState(false)
  const [purchaseRequestTool, setPurchaseRequestTool] = useState<Tool | null>(null)
  const [purchaseRequestForm, setPurchaseRequestForm] = useState({
    firma_adi: '',
    miktar: '',
    fiyat: '',
    po_numarasi: '',
    malzeme_talep_no: '',
    satinalma_teklif_no: '',
    siparis_detayi: '',
    aciklama: '',
    aciliyet: 'normal' as 'dusuk' | 'normal' | 'yuksek' | 'acil',
  })

  // Submitting states
  const [isSubmittingTool, setIsSubmittingTool] = useState(false)
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false)
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false)
  const [isSubmittingPurchaseRequest, setIsSubmittingPurchaseRequest] = useState(false)

  // ── Lifecycle ────────────────────────────────────────────
  useEffect(() => { loadAll() }, [])

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

  // ── Data Loading ─────────────────────────────────────────
  async function loadAll() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      const cid = profile.company_id
      setCompanyId(cid)

      const [toolsRes, maintenanceRes, suppliersRes, machinesRes] = await Promise.all([
        supabase.from('tools').select('*, supplier:suppliers(id, company_name)').eq('company_id', cid).eq('is_active', true).order('tool_code'),
        supabase.from('tool_maintenance')
          .select('*, tool:tools(tool_code, tool_name)')
          .eq('company_id', cid)
          .order('performed_at', { ascending: false })
          .limit(100),
        supabase.from('suppliers').select('id, company_name').eq('company_id', cid).order('company_name'),
        supabase.from('machines').select('id, machine_name, machine_code').eq('company_id', cid).order('machine_name'),
      ])

      setTools(toolsRes.data || [])
      setMaintenance(maintenanceRes.data || [])
      setSuppliers(suppliersRes.data || [])
      setMachines(machinesRes.data || [])
    } catch (err) {
      console.error('Takımhane yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Tool CRUD ────────────────────────────────────────────
  const openAddToolModal = () => {
    setEditingTool(null)
    setToolForm({
      tool_code: '', tool_name: '', tool_type: '', supplier_id: '', model: '',
      location_letter: '', location_number: '', quantity: 1, min_quantity: 1, notes: '',
    })
    setShowToolModal(true)
  }

  const openEditToolModal = (tool: Tool) => {
    setEditingTool(tool)
    const locParts = (tool.location || '').split('-')
    setToolForm({
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      tool_type: tool.tool_type || '',
      supplier_id: tool.supplier_id || '',
      model: tool.model || '',
      location_letter: locParts[0] || '',
      location_number: locParts[1] || '',
      quantity: tool.quantity,
      min_quantity: tool.min_quantity,
      notes: tool.notes || '',
    })
    setShowToolModal(true)
  }

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingTool) return
    if (!companyId) return

    setIsSubmittingTool(true)
    setToolModalLoading(true)

    const location = toolForm.location_letter && toolForm.location_number
      ? `${toolForm.location_letter}-${toolForm.location_number}`
      : null

    const payload = {
      company_id: companyId,
      tool_code: toolForm.tool_code.trim(),
      tool_name: toolForm.tool_name.trim(),
      tool_type: toolForm.tool_type || null,
      supplier_id: toolForm.supplier_id || null,
      model: toolForm.model.trim() || null,
      location,
      quantity: toolForm.quantity,
      min_quantity: toolForm.min_quantity,
      notes: toolForm.notes.trim() || null,
      status: editingTool?.status || 'available',
    }

    try {
      if (editingTool) {
        await supabase.from('tools').update(payload).eq('id', editingTool.id)
      } else {
        await supabase.from('tools').insert([payload])
      }
      await loadAll()
      setShowToolModal(false)
    } catch (err) {
      console.error('Takım kaydetme hatası:', err)
    } finally {
      setIsSubmittingTool(false)
      setToolModalLoading(false)
    }
  }

  const deleteTool = async (tool: Tool) => {
    if (!confirm(`"${tool.tool_code} - ${tool.tool_name}" takımını silmek istediğinize emin misiniz?`)) return
    await supabase.from('tools').update({ is_active: false }).eq('id', tool.id)
    await loadAll()
  }

  // ── Tezgaha Ver ──────────────────────────────────────────
  const openDeliveryModal = (tool: Tool) => {
    if (tool.quantity <= 0) {
      alert('Stokta yeterli adet yok!')
      return
    }
    setDeliveryTarget(tool)
    setDeliveryForm({ machine_id: '', quantity: 1, delivered_by: '', notes: '' })
    setShowDeliveryModal(true)
  }

  const handleDeliverToMachine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingDelivery) return
    if (!companyId || !deliveryTarget) return
    if (!deliveryForm.machine_id) {
      alert('Tezgah seçiniz')
      return
    }
    if (deliveryForm.quantity <= 0 || deliveryForm.quantity > deliveryTarget.quantity) {
      alert(`Geçersiz adet! (Stokta: ${deliveryTarget.quantity})`)
      return
    }

    setIsSubmittingDelivery(true)
    setDeliveryLoading(true)
    try {
      // 1. Stoktan düş
      const newQty = deliveryTarget.quantity - deliveryForm.quantity
      await supabase.from('tools').update({ quantity: newQty }).eq('id', deliveryTarget.id)

      // 2. Teslim kaydı oluştur
      await supabase.from('tool_machine_deliveries').insert([{
        company_id: companyId,
        tool_id: deliveryTarget.id,
        machine_id: deliveryForm.machine_id,
        quantity: deliveryForm.quantity,
        delivered_by: deliveryForm.delivered_by.trim() || null,
        notes: deliveryForm.notes.trim() || null,
      }])

      await loadAll()
      setShowDeliveryModal(false)
    } catch (err) {
      console.error('Tezgaha teslim hatası:', err)
      alert('Teslim işlemi başarısız!')
    } finally {
      setIsSubmittingDelivery(false)
      setDeliveryLoading(false)
    }
  }

  // ── Durum Değiştir ───────────────────────────────────────
  const openStatusModal = (tool: Tool) => {
    setStatusTarget(tool)
    setShowStatusModal(true)
  }

  const changeStatus = async (newStatus: ToolStatus) => {
    if (!statusTarget) return
    await supabase.from('tools').update({ status: newStatus }).eq('id', statusTarget.id)
    await loadAll()
    setShowStatusModal(false)
  }

  // ── Bakım Ekle ───────────────────────────────────────────
  const openMaintenanceModal = (tool: Tool) => {
    setMaintenanceTool(tool)
    setMaintenanceForm({ maintenance_type: '', performed_by: '', cost: '', notes: '', status_after: 'available' })
    setShowMaintenanceModal(true)
  }

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingMaintenance) return
    if (!companyId || !maintenanceTool) return

    setIsSubmittingMaintenance(true)
    setMaintenanceLoading(true)

    try {
      await supabase.from('tool_maintenance').insert([{
        company_id: companyId,
        tool_id: maintenanceTool.id,
        maintenance_type: maintenanceForm.maintenance_type.trim(),
        performed_by: maintenanceForm.performed_by.trim() || null,
        cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        notes: maintenanceForm.notes.trim() || null,
        status_after: maintenanceForm.status_after,
      }])

      await supabase.from('tools').update({ status: maintenanceForm.status_after }).eq('id', maintenanceTool.id)
      await loadAll()
      setShowMaintenanceModal(false)
    } catch (err) {
      console.error('Bakım kaydetme hatası:', err)
    } finally {
      setIsSubmittingMaintenance(false)
      setMaintenanceLoading(false)
    }
  }

  // ── Satın Alma Talebi ────────────────────────────────────
  const openPurchaseRequestModal = async (tool: Tool) => {
    setPurchaseRequestTool(tool)

    // Son PO numarasını bul ve sıradakini oluştur
    let nextNumber = 1
    try {
      if (companyId) {
        const { data } = await supabase
          .from('purchasing_tracking')
          .select('po_numarasi')
          .eq('company_id', companyId)
          .like('po_numarasi', 'DNYS-%')
          .order('created_at', { ascending: false })
          .limit(1)

        if (data && data.length > 0 && data[0].po_numarasi) {
          const match = data[0].po_numarasi.match(/DNYS-(\d+)/)
          if (match) {
            nextNumber = parseInt(match[1]) + 1
          }
        }
      }
    } catch (err) {
      console.error('PO numarası alınamadı:', err)
    }

    const poNo = `DNYS-${nextNumber}`
    const talepNo = `${poNo}-TLP`
    const teklifNo = `${poNo}-TLF`

    setPurchaseRequestForm({
      firma_adi: tool.supplier?.company_name || '',
      miktar: '',
      fiyat: '',
      po_numarasi: poNo,
      malzeme_talep_no: talepNo,
      satinalma_teklif_no: teklifNo,
      siparis_detayi: `${tool.tool_name}${tool.tool_type ? ' (' + tool.tool_type + ')' : ''}${tool.model ? ' - Model: ' + tool.model : ''}`,
      aciklama: '',
      aciliyet: tool.quantity < tool.min_quantity ? 'yuksek' : 'normal',
    })
    setShowPurchaseRequestModal(true)
  }

  const handleSubmitPurchaseRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingPurchaseRequest) return
    if (!companyId || !purchaseRequestTool) return

    if (!purchaseRequestForm.firma_adi.trim()) {
      alert('Lütfen firma adını girin!')
      return
    }
    if (!purchaseRequestForm.miktar || parseFloat(purchaseRequestForm.miktar) <= 0) {
      alert('Lütfen geçerli bir miktar girin!')
      return
    }

    setIsSubmittingPurchaseRequest(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

      const aciliyetLabels: Record<string, string> = {
        dusuk: 'Düşük Öncelik',
        normal: 'Normal',
        yuksek: 'Yüksek Öncelik',
        acil: 'ACİL',
      }
      const aciliyetText = aciliyetLabels[purchaseRequestForm.aciliyet] || 'Normal'

      const aciklamaFull = [
        `[Takımhane Talebi - ${aciliyetText}]`,
        purchaseRequestForm.aciklama,
        `Mevcut Stok: ${purchaseRequestTool.quantity} / Min: ${purchaseRequestTool.min_quantity}`,
        purchaseRequestTool.location ? `Lokasyon: ${purchaseRequestTool.location}` : null,
      ].filter(Boolean).join(' | ')

      const { error } = await supabase.from('purchasing_tracking').insert({
        company_id: companyId,
        siparis_tarihi: new Date().toISOString().split('T')[0],
        firma_adi: purchaseRequestForm.firma_adi.trim(),
        satinalma_sorumlusu: profile?.full_name || null,
        parca_kodu: purchaseRequestTool.tool_code,
        po_numarasi: purchaseRequestForm.po_numarasi.trim() || null,
        malzeme_talep_no: purchaseRequestForm.malzeme_talep_no.trim() || null,
        satinalma_teklif_no: purchaseRequestForm.satinalma_teklif_no.trim() || null,
        fiyat: purchaseRequestForm.fiyat ? parseFloat(purchaseRequestForm.fiyat) : null,
        siparis_detayi: purchaseRequestForm.siparis_detayi.trim() || null,
        miktar: parseFloat(purchaseRequestForm.miktar),
        aciklama: aciklamaFull,
        satinalma_onay: false,
        satinalma_red: false,
        created_by: user.id,
      })

      if (error) throw error

      alert('Satın alma talebi başarıyla gönderildi! Satınalma Takip sayfasından takip edebilirsiniz.')
      setShowPurchaseRequestModal(false)
    } catch (err: any) {
      console.error('Satın alma talebi hatası:', err)
      alert('Talep gönderilirken hata oluştu: ' + (err.message || ''))
    } finally {
      setIsSubmittingPurchaseRequest(false)
    }
  }

  // ── Tab Badge Hesaplamaları ──────────────────────────────
  const lowStockCount = tools.filter(t => t.quantity < t.min_quantity).length
  const maintenanceCount = tools.filter(t => t.status === 'maintenance' || t.status === 'broken').length
  const totalToolsCount = tools.length

  const tabs = [
    { key: 'inventory' as Tab, label: 'Envanter', badge: `${totalToolsCount} Takım`, alert: false },
    { key: 'maintenance' as Tab, label: 'Bakım Geçmişi', badge: maintenanceCount > 0 ? maintenanceCount.toString() : null, alert: maintenanceCount > 0 },
  ] as { key: Tab; label: string; badge: string | null; alert?: boolean }[]

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <PermissionGuard module="toolroom" permission="view">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard module="toolroom" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Takımhane</h2>
            <p className="text-gray-600">Kesici takım ve ölçüm aleti yönetimi</p>
          </div>
          <Package className="w-12 h-12 text-blue-600" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-6 py-4 font-semibold text-sm relative transition-colors ${
                    tab === t.key
                      ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                  {t.badge !== null && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${
                        t.alert ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* ──────── ENVANTER TAB ──────── */}
            {tab === 'inventory' && (
              <div className="space-y-4">
                {/* Üst Kontroller */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Arama */}
                  <div className="flex-1 min-w-[300px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Takım kodu, isim, tedarikçi, lokasyon ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Durum Filtresi */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">Tüm Durumlar</option>
                    {(Object.keys(STATUS) as ToolStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS[s].label}</option>
                    ))}
                  </select>

                  {/* Kategori/Tür Filtresi */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">Tüm Kategoriler ({uniqueTypes.length})</option>
                    {uniqueTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  {/* Lokasyon Filtresi */}
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">Tüm Lokasyonlar ({uniqueLocations.length})</option>
                    {uniqueLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>

                  {/* Filtreleri Temizle */}
                  {(statusFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all' || searchTerm) && (
                    <button
                      onClick={() => {
                        setStatusFilter('all')
                        setTypeFilter('all')
                        setLocationFilter('all')
                        setSearchTerm('')
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 font-semibold"
                      title="Tüm filtreleri temizle"
                    >
                      <X className="w-4 h-4" /> Temizle
                    </button>
                  )}

                  {/* Ekle Butonu */}
                  {canCreate('toolroom') && (
                    <button
                      onClick={openAddToolModal}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold"
                    >
                      <Plus className="w-5 h-5" /> Yeni Takım
                    </button>
                  )}
                </div>

                {/* Filtre Sonuç Bilgisi */}
                {(statusFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all' || searchTerm) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-blue-900">
                        {filteredTools.length} / {tools.length} takım gösteriliyor
                      </span>
                      <span className="text-blue-600">•</span>
                      <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            Arama: "{searchTerm}"
                          </span>
                        )}
                        {statusFilter !== 'all' && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            Durum: {STATUS[statusFilter as ToolStatus].label}
                          </span>
                        )}
                        {typeFilter !== 'all' && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            Kategori: {typeFilter}
                          </span>
                        )}
                        {locationFilter !== 'all' && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            Lokasyon: {locationFilter}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Takım Listesi */}
                {filteredTools.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <Package className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Takım Bulunamadı</h3>
                    <p className="text-gray-500">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'Filtrelere uygun takım bulunamadı.'
                        : 'Henüz takım eklenmemiş. Yukarıdaki "Yeni Takım" butonunu kullanarak ekleyebilirsiniz.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Kod / Takım</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Tür</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Marka / Model</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Tedarikçi</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Lokasyon</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Adet</th>
                          <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">Durum</th>
                          <th className="px-4 py-3.5 text-right text-sm font-semibold text-gray-700">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTools.map((tool) => {
                          const isLowStock = tool.quantity < tool.min_quantity
                          return (
                            <tr key={tool.id} className="border-b border-gray-100 hover:bg-gray-50">
                              {/* Kod / Takım */}
                              <td className="px-4 py-3.5">
                                <div>
                                  <span className="font-mono text-sm font-semibold text-gray-900 block">{tool.tool_code}</span>
                                  <span className="text-sm text-gray-600">{tool.tool_name}</span>
                                </div>
                              </td>
                              {/* Tür */}
                              <td className="px-4 py-3.5">
                                {tool.tool_type ? (
                                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">{tool.tool_type}</span>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                              {/* Marka / Model */}
                              <td className="px-4 py-3.5">
                                {(tool.model || tool.supplier_brand) ? (
                                  <div className="text-sm font-semibold text-gray-900">{tool.model || tool.supplier_brand}</div>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                              {/* Tedarikçi */}
                              <td className="px-4 py-3.5">
                                {tool.supplier ? (
                                  <span className="text-sm text-gray-700">{tool.supplier.company_name}</span>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                              {/* Lokasyon */}
                              <td className="px-4 py-3.5">
                                {tool.location ? (
                                  <button onClick={() => setSearchTerm(searchTerm === tool.location ? '' : tool.location!)}
                                    className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded text-sm font-semibold hover:bg-purple-200 transition-colors">
                                    {tool.location}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                              {/* Adet */}
                              <td className="px-4 py-3.5">
                                <div>
                                  <span className={`font-bold text-lg ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>{tool.quantity}</span>
                                  <span className="text-xs text-gray-400 ml-1">/ min: {tool.min_quantity}</span>
                                  {isLowStock && <span className="block text-xs text-red-600 font-semibold mt-0.5">⚠ Düşük Stok</span>}
                                </div>
                              </td>
                              {/* Durum */}
                              <td className="px-4 py-3.5">
                                <button
                                  onClick={() => openStatusModal(tool)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${STATUS[tool.status].bg} ${STATUS[tool.status].text} ${STATUS[tool.status].border} hover:opacity-80 transition-opacity flex items-center gap-1.5`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${STATUS[tool.status].dot}`}></span>
                                  {STATUS[tool.status].label}
                                </button>
                              </td>
                              {/* İşlemler */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Tezgaha Ver */}
                                  {canEdit('toolroom') && (
                                    <button
                                      onClick={() => openDeliveryModal(tool)}
                                      disabled={tool.quantity <= 0}
                                      title="Tezgaha Ver"
                                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Truck className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* Satın Alma Talebi */}
                                  {canEdit('toolroom') && (
                                    <button
                                      onClick={() => openPurchaseRequestModal(tool)}
                                      title="Satın Alma Talebi"
                                      className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* Bakım Ekle */}
                                  {canEdit('toolroom') && (
                                    <button
                                      onClick={() => openMaintenanceModal(tool)}
                                      title="Bakım Ekle"
                                      className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                      <Wrench className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* Düzenle */}
                                  {canEdit('toolroom') && (
                                    <button
                                      onClick={() => openEditToolModal(tool)}
                                      title="Düzenle"
                                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* Sil */}
                                  {canDelete('toolroom') && (
                                    <button
                                      onClick={() => deleteTool(tool)}
                                      title="Sil"
                                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ──────── BAKIM GEÇMİŞİ TAB ──────── */}
            {tab === 'maintenance' && (
              <div className="space-y-4">
                {maintenance.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <Wrench className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Bakım Kaydı Yok</h3>
                    <p className="text-gray-500">Henüz bakım kaydı eklenmemiş.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Takım</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bakım Türü</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Yapan</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Maliyet</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notlar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenance.map((m) => (
                          <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(m.performed_at)}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                <span className="font-mono font-semibold text-gray-900 block">{m.tool?.tool_code}</span>
                                <span className="text-gray-600">{m.tool?.tool_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-700">{m.maintenance_type}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{m.performed_by || '—'}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {m.cost ? `${m.cost.toFixed(2)} ₺` : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{m.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALLER                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* ─────── TAKIM EKLE / DÜZENLE MODAL ─────── */}
      {showToolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingTool ? 'Takım Düzenle' : 'Yeni Takım Ekle'}
              </h3>
              <button onClick={() => setShowToolModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={handleSaveTool} className="p-6 space-y-4">
              {/* Satır 1: Takım Kodu + Takım Adı */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Kodu <span className="text-red-500">*</span></label>
                  <input type="text" required value={toolForm.tool_code} onChange={e => setToolForm({ ...toolForm, tool_code: e.target.value })}
                    placeholder="DCMT11T308LF" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Adı <span className="text-red-500">*</span></label>
                  <input type="text" required value={toolForm.tool_name} onChange={e => setToolForm({ ...toolForm, tool_name: e.target.value })}
                    placeholder="Tornalama Kalemi" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Satır 2: Tür + Tedarikçi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Türü</label>
                  <select value={toolForm.tool_type} onChange={e => setToolForm({ ...toolForm, tool_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seçiniz (Opsiyonel)</option>
                    {TOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tedarikçi</label>
                  <select value={toolForm.supplier_id} onChange={e => setToolForm({ ...toolForm, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seçiniz (Opsiyonel)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Satır 3: Model + Lokasyon */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Model / Seri</label>
                  <input type="text" value={toolForm.model} onChange={e => setToolForm({ ...toolForm, model: e.target.value })}
                    placeholder="CoroMill 390..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lokasyon</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={toolForm.location_letter} onChange={e => setToolForm({ ...toolForm, location_letter: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Harf</option>
                      {LOCATION_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <select value={toolForm.location_number} onChange={e => setToolForm({ ...toolForm, location_number: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Sayı</option>
                      {LOCATION_NUMBERS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Satır 4: Adet + Min Adet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mevcut Adet <span className="text-red-500">*</span></label>
                  <input type="number" required min="0" value={toolForm.quantity} onChange={e => setToolForm({ ...toolForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Minimum Adet <span className="text-red-500">*</span></label>
                  <input type="number" required min="0" value={toolForm.min_quantity} onChange={e => setToolForm({ ...toolForm, min_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Satır 5: Notlar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                <textarea value={toolForm.notes} onChange={e => setToolForm({ ...toolForm, notes: e.target.value })} rows={3}
                  placeholder="Ek bilgiler..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowToolModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={isSubmittingTool}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingTool ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────── TEZGAHA VER MODAL ─────── */}
      {showDeliveryModal && deliveryTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">Tezgaha Ver</h3>
              <p className="text-green-100 text-sm">
                {deliveryTarget.tool_code} - {deliveryTarget.tool_name} (Stok: {deliveryTarget.quantity})
              </p>
            </div>

            <form onSubmit={handleDeliverToMachine} className="p-6 space-y-4">
              {/* Tezgah Seçimi */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tezgah <span className="text-red-500">*</span></label>
                <select required value={deliveryForm.machine_id} onChange={e => setDeliveryForm({ ...deliveryForm, machine_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">Tezgah Seçiniz</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} - {m.machine_name}</option>)}
                </select>
              </div>

              {/* Adet */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Adet <span className="text-red-500">*</span></label>
                <input type="number" required min="1" max={deliveryTarget.quantity} value={deliveryForm.quantity}
                  onChange={e => setDeliveryForm({ ...deliveryForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              {/* Teslim Eden */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Teslim Eden</label>
                <input type="text" value={deliveryForm.delivered_by} onChange={e => setDeliveryForm({ ...deliveryForm, delivered_by: e.target.value })}
                  placeholder="İsim (Opsiyonel)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                <textarea value={deliveryForm.notes} onChange={e => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} rows={3}
                  placeholder="Ek bilgiler..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"></textarea>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={isSubmittingDelivery}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingDelivery ? 'Teslim Ediliyor...' : 'Teslim Et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────── DURUM DEĞİŞTİR MODAL ─────── */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Durum Değiştir</h3>
              <p className="text-sm text-gray-600">{statusTarget.tool_code} - {statusTarget.tool_name}</p>
            </div>
            <div className="p-6 space-y-3">
              {(Object.keys(STATUS) as ToolStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${STATUS[s].bg} ${STATUS[s].text} ${STATUS[s].border} hover:scale-105 flex items-center gap-2`}
                >
                  <span className={`w-3 h-3 rounded-full ${STATUS[s].dot}`}></span>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setShowStatusModal(false)}
                className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── BAKIM EKLE MODAL ─────── */}
      {showMaintenanceModal && maintenanceTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">Bakım Ekle</h3>
              <p className="text-orange-100 text-sm">
                {maintenanceTool.tool_code} - {maintenanceTool.tool_name}
              </p>
            </div>

            <form onSubmit={handleSaveMaintenance} className="p-6 space-y-4">
              {/* Bakım Türü */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bakım Türü <span className="text-red-500">*</span></label>
                <input type="text" required value={maintenanceForm.maintenance_type}
                  onChange={e => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })}
                  placeholder="Kesici değişim, Yağlama, vb." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>

              {/* Yapan + Maliyet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Yapan</label>
                  <input type="text" value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })}
                    placeholder="İsim (Opsiyonel)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Maliyet (₺)</label>
                  <input type="number" step="0.01" min="0" value={maintenanceForm.cost}
                    onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>

              {/* Sonraki Durum */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bakım Sonrası Durum <span className="text-red-500">*</span></label>
                <select required value={maintenanceForm.status_after} onChange={e => setMaintenanceForm({ ...maintenanceForm, status_after: e.target.value as ToolStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  {(Object.keys(STATUS) as ToolStatus[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </select>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                <textarea value={maintenanceForm.notes} onChange={e => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} rows={3}
                  placeholder="Bakım detayları..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"></textarea>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={isSubmittingMaintenance}
                  className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingMaintenance ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─────── SATIN ALMA TALEBİ MODAL ─────── */}
      {showPurchaseRequestModal && purchaseRequestTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Satın Alma Talebi Oluştur
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                Takımhane'den satınalma takip sistemine talep gönder
              </p>
            </div>

            <form onSubmit={handleSubmitPurchaseRequest} className="p-6 space-y-5">

              {/* Takım Bilgi Kartı */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-purple-800 mb-3 uppercase tracking-wide">Takım Bilgileri</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Takım Kodu</span>
                    <span className="font-mono font-bold text-gray-900">{purchaseRequestTool.tool_code}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Takım Adı</span>
                    <span className="font-semibold text-gray-900">{purchaseRequestTool.tool_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Tür</span>
                    <span className="font-semibold text-gray-900">{purchaseRequestTool.tool_type || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Model</span>
                    <span className="font-semibold text-gray-900">{purchaseRequestTool.model || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Lokasyon</span>
                    <span className="font-semibold text-gray-900">{purchaseRequestTool.location || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-0.5">Mevcut Stok</span>
                    <span className={`font-bold text-lg ${purchaseRequestTool.quantity < purchaseRequestTool.min_quantity ? 'text-red-600' : 'text-green-600'}`}>
                      {purchaseRequestTool.quantity}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">/ min: {purchaseRequestTool.min_quantity}</span>
                    {purchaseRequestTool.quantity < purchaseRequestTool.min_quantity && (
                      <span className="block text-xs text-red-600 font-semibold mt-0.5">Kritik stok seviyesi!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Aciliyet Durumu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Aciliyet Durumu</label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { key: 'dusuk', label: 'Düşük', color: 'bg-gray-100 text-gray-700 border-gray-300', active: 'bg-gray-600 text-white border-gray-600' },
                    { key: 'normal', label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-300', active: 'bg-blue-600 text-white border-blue-600' },
                    { key: 'yuksek', label: 'Yüksek', color: 'bg-orange-50 text-orange-700 border-orange-300', active: 'bg-orange-600 text-white border-orange-600' },
                    { key: 'acil', label: 'ACİL', color: 'bg-red-50 text-red-700 border-red-300', active: 'bg-red-600 text-white border-red-600' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPurchaseRequestForm({ ...purchaseRequestForm, aciliyet: opt.key })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        purchaseRequestForm.aciliyet === opt.key ? opt.active : opt.color
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Firma Adı + Miktar + Fiyat */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Tedarikçi / Firma Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={purchaseRequestForm.firma_adi}
                    onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, firma_adi: e.target.value })}
                    placeholder="Firma adı"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  {purchaseRequestTool.supplier?.company_name && purchaseRequestForm.firma_adi !== purchaseRequestTool.supplier.company_name && (
                    <button
                      type="button"
                      onClick={() => setPurchaseRequestForm({ ...purchaseRequestForm, firma_adi: purchaseRequestTool.supplier!.company_name })}
                      className="text-xs text-purple-600 hover:text-purple-800 mt-1"
                    >
                      Mevcut tedarikçiyi kullan: {purchaseRequestTool.supplier.company_name}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Talep Miktarı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={purchaseRequestForm.miktar}
                    onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, miktar: e.target.value })}
                    placeholder="Adet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tahmini Birim Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchaseRequestForm.fiyat}
                    onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, fiyat: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  {purchaseRequestForm.fiyat && purchaseRequestForm.miktar && (
                    <p className="text-xs text-gray-500 mt-1">
                      Toplam: <span className="font-semibold text-gray-800">
                        {(parseFloat(purchaseRequestForm.fiyat) * parseFloat(purchaseRequestForm.miktar)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Numara Alanları */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Malzeme Talep No</label>
                  <input
                    type="text"
                    value={purchaseRequestForm.malzeme_talep_no}
                    onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, malzeme_talep_no: e.target.value })}
                    placeholder="DNYS-588-TLP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sipariş (PO) Numarası</label>
                  <input
                    type="text"
                    value={purchaseRequestForm.po_numarasi}
                    onChange={e => {
                      const po = e.target.value
                      setPurchaseRequestForm({
                        ...purchaseRequestForm,
                        po_numarasi: po,
                        malzeme_talep_no: po ? `${po}-TLP` : '',
                        satinalma_teklif_no: po ? `${po}-TLF` : '',
                      })
                    }}
                    placeholder="DNYS-588"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Satınalma Teklif No</label>
                  <input
                    type="text"
                    value={purchaseRequestForm.satinalma_teklif_no}
                    onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, satinalma_teklif_no: e.target.value })}
                    placeholder="DNYS-588-TLF"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50"
                  />
                </div>
              </div>

              {/* Sipariş Detayı */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sipariş Detayı</label>
                <textarea
                  value={purchaseRequestForm.siparis_detayi}
                  onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, siparis_detayi: e.target.value })}
                  rows={2}
                  placeholder="Takım detayları, özel gereksinimler..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ek Açıklama / Not</label>
                <textarea
                  value={purchaseRequestForm.aciklama}
                  onChange={e => setPurchaseRequestForm({ ...purchaseRequestForm, aciklama: e.target.value })}
                  rows={3}
                  placeholder="Talep nedeni, neden bu firmadan alınmalı, alternatif ürün var mı, vb."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              {/* Özet */}
              {purchaseRequestForm.miktar && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Talep Özeti</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs block">Parça</span>
                      <span className="font-mono font-semibold">{purchaseRequestTool.tool_code}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Firma</span>
                      <span className="font-semibold">{purchaseRequestForm.firma_adi || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Miktar</span>
                      <span className="font-bold text-purple-700">{purchaseRequestForm.miktar} adet</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Tahmini Tutar</span>
                      <span className="font-bold text-green-700">
                        {purchaseRequestForm.fiyat
                          ? `${(parseFloat(purchaseRequestForm.fiyat) * parseFloat(purchaseRequestForm.miktar)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Butonlar */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseRequestModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPurchaseRequest}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isSubmittingPurchaseRequest ? 'Gönderiliyor...' : 'Satın Alma Talebi Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

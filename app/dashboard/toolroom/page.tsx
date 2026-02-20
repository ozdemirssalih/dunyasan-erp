'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

// ── Tipler ───────────────────────────────────────────────────
type Tab = 'inventory' | 'checkouts' | 'maintenance'
type ToolStatus = 'available' | 'checked_out' | 'maintenance' | 'broken' | 'lost'
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
    name: string
  } | null
}

interface Supplier {
  id: string
  name: string
}

interface Checkout {
  id: string
  tool_id: string
  checked_out_by: string
  department: string | null
  tezgah: string | null
  checked_out_at: string
  expected_return_at: string | null
  returned_at: string | null
  condition_on_return: 'good' | 'worn' | 'damaged' | null
  notes: string | null
  tool: { tool_code: string; tool_name: string; location: string | null } | null
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
const LOCATION_LETTERS = ['A', 'B', 'C', 'D', 'E']
const LOCATION_NUMBERS = ['1', '2', '3', '4']

const STATUS: Record<ToolStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available:    { label: 'Müsait',     bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-200' },
  checked_out:  { label: 'Zimmette',   bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200' },
  maintenance:  { label: 'Bakımda',    bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  broken:       { label: 'Arızalı',   bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200' },
  lost:         { label: 'Kayıp',      bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   border: 'border-gray-300' },
}

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  good:    { label: 'İyi Durumda', color: 'text-green-600' },
  worn:    { label: 'Yıpranmış',  color: 'text-orange-600' },
  damaged: { label: 'Hasarlı',    color: 'text-red-600' },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const isOverdue = (expected: string | null) =>
  expected ? new Date(expected) < new Date() : false

// ── Ana Bileşen ──────────────────────────────────────────────
export default function ToolroomPage() {
  const [tab, setTab] = useState<Tab>('inventory')
  const [tools, setTools] = useState<Tool[]>([])
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Filtreler (Envanter tab)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredTools, setFilteredTools] = useState<Tool[]>([])

  // ── Modaller ─────────────────────────────────────────────
  // 1. Ekle / Düzenle
  const [showToolModal, setShowToolModal] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [toolModalLoading, setToolModalLoading] = useState(false)
  const [toolForm, setToolForm] = useState({
    tool_code: '', tool_name: '', tool_type: '', supplier_id: '', model: '',
    location_letter: '', location_number: '', quantity: 1, min_quantity: 1, notes: '',
  })

  // 2. Zimmetle (checkout)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutTarget, setCheckoutTarget] = useState<Tool | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    checked_out_by: '', department: '', tezgah: '', expected_return_at: '', notes: '',
  })

  // 3. İade Al (return)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnTarget, setReturnTarget] = useState<Checkout | null>(null)
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnForm, setReturnForm] = useState({
    condition_on_return: 'good' as 'good' | 'worn' | 'damaged',
    status_after: 'available' as ToolStatus,
    notes: '',
  })

  // 4. Durum Değiştir
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Tool | null>(null)

  // 5. Bakım Ekle
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceTool, setMaintenanceTool] = useState<Tool | null>(null)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: '', performed_by: '', cost: '', notes: '', status_after: 'available' as ToolStatus,
  })

  // ── Lifecycle ────────────────────────────────────────────
  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    let f = tools
    if (statusFilter !== 'all') f = f.filter(t => t.status === statusFilter)
    if (typeFilter !== 'all') f = f.filter(t => (t.tool_type || '') === typeFilter)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      f = f.filter(t =>
        t.tool_code.toLowerCase().includes(q) ||
        t.tool_name.toLowerCase().includes(q) ||
        (t.tool_type || '').toLowerCase().includes(q) ||
        (t.supplier?.name || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      )
    }
    setFilteredTools(f)
  }, [tools, statusFilter, typeFilter, searchTerm])

  // ── Veri Yükleme ─────────────────────────────────────────
  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    setCurrentUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    let cid = profile?.company_id
    if (!cid) {
      const { data: co } = await supabase.from('companies').select('id').ilike('name', '%dünyasan%').limit(1).single()
      if (co?.id) { cid = co.id; await supabase.from('profiles').update({ company_id: cid }).eq('id', user.id) }
      else {
        const { data: first } = await supabase.from('companies').select('id').limit(1).single()
        if (first?.id) { cid = first.id; await supabase.from('profiles').update({ company_id: cid }).eq('id', user.id) }
      }
    }
    return cid
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      const cid = await getCompanyId()
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)

      const [toolsRes, checkoutsRes, maintenanceRes, suppliersRes] = await Promise.all([
        supabase.from('tools').select('*, supplier:suppliers(id, name)').eq('company_id', cid).eq('is_active', true).order('tool_code'),
        supabase.from('tool_checkouts')
          .select('*, tool:tools(tool_code, tool_name, location)')
          .eq('company_id', cid).is('returned_at', null)
          .order('checked_out_at', { ascending: false }),
        supabase.from('tool_maintenance')
          .select('*, tool:tools(tool_code, tool_name)')
          .eq('company_id', cid)
          .order('performed_at', { ascending: false })
          .limit(100),
        supabase.from('suppliers').select('id, name').eq('company_id', cid).order('name'),
      ])

      setTools(toolsRes.data || [])
      setCheckouts(checkoutsRes.data || [])
      setMaintenance(maintenanceRes.data || [])
      setSuppliers(suppliersRes.data || [])
    } catch (err) {
      console.error('Takımhane yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Takım Ekle / Düzenle ─────────────────────────────────
  const openAddToolModal = () => {
    setEditingTool(null)
    setToolForm({ tool_code: '', tool_name: '', tool_type: '', supplier_id: '', model: '', location_letter: '', location_number: '', quantity: 1, min_quantity: 1, notes: '' })
    setShowToolModal(true)
  }

  const openEditToolModal = (tool: Tool) => {
    setEditingTool(tool)
    // Lokasyonu ayır (örn: "A-2" → letter="A", number="2")
    const locParts = (tool.location || '').split('-')
    setToolForm({
      tool_code: tool.tool_code, tool_name: tool.tool_name, tool_type: tool.tool_type || '',
      supplier_id: tool.supplier_id || '', model: tool.model || '',
      location_letter: locParts[0] || '', location_number: locParts[1] || '',
      quantity: tool.quantity, min_quantity: tool.min_quantity, notes: tool.notes || '',
    })
    setShowToolModal(true)
  }

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setToolModalLoading(true)
    try {
      // Lokasyonu birleştir (örn: letter="A", number="2" → "A-2")
      const location = toolForm.location_letter && toolForm.location_number
        ? `${toolForm.location_letter}-${toolForm.location_number}`
        : null

      const payload = {
        tool_code: toolForm.tool_code.trim(), tool_name: toolForm.tool_name.trim(),
        tool_type: toolForm.tool_type.trim() || null,
        supplier_id: toolForm.supplier_id || null,
        model: toolForm.model.trim() || null,
        location,
        quantity: toolForm.quantity, min_quantity: toolForm.min_quantity,
        notes: toolForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!editingTool) {
        const { error } = await supabase.from('tools').insert({ ...payload, company_id: companyId, is_active: true, status: 'available' })
        if (error) throw error
      } else {
        const { error } = await supabase.from('tools').update(payload).eq('id', editingTool.id)
        if (error) throw error
      }
      setShowToolModal(false)
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    } finally {
      setToolModalLoading(false)
    }
  }

  const handleDeleteTool = async (tool: Tool) => {
    if (!confirm(`"${tool.tool_name}" silinsin mi?`)) return
    try {
      const { error } = await supabase.from('tools').update({ is_active: false }).eq('id', tool.id)
      if (error) throw error
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    }
  }

  // ── Zimmet (Checkout) ────────────────────────────────────
  const openCheckoutModal = (tool: Tool) => {
    setCheckoutTarget(tool)
    setCheckoutForm({ checked_out_by: '', department: '', tezgah: '', expected_return_at: '', notes: '' })
    setShowCheckoutModal(true)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkoutTarget || !companyId) return
    setCheckoutLoading(true)
    try {
      const { error: coErr } = await supabase.from('tool_checkouts').insert({
        company_id: companyId,
        tool_id: checkoutTarget.id,
        checked_out_by: checkoutForm.checked_out_by.trim(),
        department: checkoutForm.department.trim() || null,
        tezgah: checkoutForm.tezgah.trim() || null,
        expected_return_at: checkoutForm.expected_return_at || null,
        notes: checkoutForm.notes.trim() || null,
        created_by: currentUserId || null,
      })
      if (coErr) throw coErr

      const { error: tErr } = await supabase.from('tools').update({
        status: 'checked_out', updated_at: new Date().toISOString(),
      }).eq('id', checkoutTarget.id)
      if (tErr) throw tErr

      setShowCheckoutModal(false)
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  // ── İade (Return) ────────────────────────────────────────
  const openReturnModal = (checkout: Checkout) => {
    setReturnTarget(checkout)
    setReturnForm({ condition_on_return: 'good', status_after: 'available', notes: '' })
    setShowReturnModal(true)
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnTarget) return
    setReturnLoading(true)
    try {
      const { error: coErr } = await supabase.from('tool_checkouts').update({
        returned_at: new Date().toISOString(),
        condition_on_return: returnForm.condition_on_return,
        notes: returnForm.notes.trim() || null,
      }).eq('id', returnTarget.id)
      if (coErr) throw coErr

      const { error: tErr } = await supabase.from('tools').update({
        status: returnForm.status_after, updated_at: new Date().toISOString(),
      }).eq('id', returnTarget.tool_id)
      if (tErr) throw tErr

      setShowReturnModal(false)
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    } finally {
      setReturnLoading(false)
    }
  }

  // ── Durum Değiştir ───────────────────────────────────────
  const handleStatusChange = async (newStatus: ToolStatus) => {
    if (!statusTarget) return
    try {
      const { error } = await supabase.from('tools').update({
        status: newStatus, updated_at: new Date().toISOString(),
      }).eq('id', statusTarget.id)
      if (error) throw error
      setShowStatusModal(false)
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    }
  }

  // ── Bakım Ekle ───────────────────────────────────────────
  const openMaintenanceModal = (tool: Tool) => {
    setMaintenanceTool(tool)
    setMaintenanceForm({ maintenance_type: '', performed_by: '', cost: '', notes: '', status_after: 'available' })
    setShowMaintenanceModal(true)
  }

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceTool || !companyId) return
    setMaintenanceLoading(true)
    try {
      const { error: mErr } = await supabase.from('tool_maintenance').insert({
        company_id: companyId,
        tool_id: maintenanceTool.id,
        maintenance_type: maintenanceForm.maintenance_type.trim(),
        performed_by: maintenanceForm.performed_by.trim() || null,
        cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        notes: maintenanceForm.notes.trim() || null,
        status_after: maintenanceForm.status_after,
        created_by: currentUserId || null,
      })
      if (mErr) throw mErr

      const { error: tErr } = await supabase.from('tools').update({
        status: maintenanceForm.status_after, updated_at: new Date().toISOString(),
      }).eq('id', maintenanceTool.id)
      if (tErr) throw tErr

      setShowMaintenanceModal(false)
      loadAll()
    } catch (err: any) {
      alert('❌ ' + err.message)
    } finally {
      setMaintenanceLoading(false)
    }
  }

  // ── Yükleniyor ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Takımhane yükleniyor...</p>
        </div>
      </div>
    )
  }

  // ── Hesaplamalar ──────────────────────────────────────────
  const counts = {
    total:       tools.length,
    available:   tools.filter(t => t.status === 'available').length,
    checked_out: tools.filter(t => t.status === 'checked_out').length,
    maintenance: tools.filter(t => t.status === 'maintenance').length,
    broken:      tools.filter(t => t.status === 'broken').length,
    lost:        tools.filter(t => t.status === 'lost').length,
    low_stock:   tools.filter(t => t.quantity < t.min_quantity).length,
  }
  const overdueCount = checkouts.filter(c => isOverdue(c.expected_return_at)).length
  const uniqueTypes = Array.from(new Set(tools.map(t => t.tool_type || '').filter(Boolean))).sort()
  const uniqueLocations = Array.from(new Set(tools.map(t => t.location || '').filter(Boolean))).sort()

  return (
    <PermissionGuard module="toolroom" permission="view">
      <div className="space-y-5">

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Takımhane</h2>
            <p className="text-gray-500 text-sm mt-1">
              Takım envanteri · zimmet · bakım geçmişi
            </p>
          </div>
          <button
            onClick={openAddToolModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Yeni Takım
          </button>
        </div>

        {/* ── STATS ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {[
            { key: 'all',         label: 'Toplam',      val: counts.total,       color: 'text-gray-800', bg: 'bg-white' },
            { key: 'available',   label: 'Müsait',      val: counts.available,   color: 'text-green-600', bg: 'bg-green-50' },
            { key: 'checked_out', label: 'Zimmette',    val: counts.checked_out, color: 'text-blue-600',  bg: 'bg-blue-50' },
            { key: 'maintenance', label: 'Bakımda',     val: counts.maintenance, color: 'text-orange-600',bg: 'bg-orange-50' },
            { key: 'broken',      label: 'Arızalı',    val: counts.broken,      color: 'text-red-600',   bg: 'bg-red-50' },
            { key: 'lost',        label: 'Kayıp',       val: counts.lost,        color: 'text-gray-600',  bg: 'bg-gray-100' },
            { key: 'low_stock',   label: 'Kritik Stok', val: counts.low_stock,   color: 'text-purple-600',bg: 'bg-purple-50' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => {
                if (s.key === 'all' || s.key === 'low_stock') { setStatusFilter('all'); setTab('inventory') }
                else { setStatusFilter(s.key as StatusFilter); setTab('inventory') }
              }}
              className={`${s.bg} rounded-xl border border-gray-200 px-3 py-4 shadow-sm text-left hover:shadow-md transition-shadow`}
            >
              <p className="text-gray-500 text-xs font-medium mb-1 truncate">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </button>
          ))}
        </div>

        {/* ── UYARILAR ─────────────────────────────────────────── */}
        {(overdueCount > 0 || counts.low_stock > 0 || counts.lost > 0) && (
          <div className="space-y-2">
            {overdueCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">
                  <span className="font-bold">{overdueCount} zimmet süresi doldu</span> — iade alınması gerekiyor.{' '}
                  <button onClick={() => setTab('checkouts')} className="underline font-semibold">Zimmetlere git</button>
                </p>
              </div>
            )}
            {counts.low_stock > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-purple-800">
                  <span className="font-bold">{counts.low_stock} takım</span> minimum stok altında.
                </p>
              </div>
            )}
            {counts.lost > 0 && (
              <div className="bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-700">
                  <span className="font-bold">{counts.lost} kayıp takım</span> kaydedilmiş — lokasyon aramasıyla kontrol edin.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB NAVİGASYON ───────────────────────────────────── */}
        <div className="flex border-b border-gray-200 gap-1">
          {(([
            { key: 'inventory',   label: 'Envanter',       badge: counts.total },
            { key: 'checkouts',   label: 'Aktif Zimmetler', badge: checkouts.length, alert: overdueCount > 0 },
            { key: 'maintenance', label: 'Bakım Geçmişi',  badge: null },
          ]) as { key: Tab; label: string; badge: number | null; alert?: boolean }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  t.alert ? 'bg-red-500 text-white' :
                  tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 1: ENVANTER                                       */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'inventory' && (
          <div className="space-y-4">
            {/* Filtreler */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Arama */}
                <div className="flex-1 min-w-[240px] relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Kod, isim, marka, tür, lokasyon..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Tür filtre */}
                {uniqueTypes.length > 0 && (
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">Tüm Türler</option>
                    {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <button onClick={loadAll} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">↻</button>
              </div>

              {/* Durum butonları */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'all',         label: 'Tümü',      n: counts.total },
                  { key: 'available',   label: 'Müsait',    n: counts.available },
                  { key: 'checked_out', label: 'Zimmette',  n: counts.checked_out },
                  { key: 'maintenance', label: 'Bakımda',   n: counts.maintenance },
                  { key: 'broken',      label: 'Arızalı',  n: counts.broken },
                  { key: 'lost',        label: 'Kayıp',     n: counts.lost },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      statusFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {f.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${statusFilter === f.key ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{f.n}</span>
                  </button>
                ))}
              </div>

              {/* Lokasyon hızlı filtre */}
              {uniqueLocations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400 self-center mr-1">Lokasyon:</span>
                  {uniqueLocations.map(loc => (
                    <button key={loc} onClick={() => setSearchTerm(searchTerm === loc ? '' : loc)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        searchTerm === loc ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tablo */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">{filteredTools.length} takım</span>
                {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
                  <button onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm('') }}
                    className="text-xs text-blue-600 hover:underline">Filtreleri temizle</button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kod / Takım</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tür / Tedarikçi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lokasyon</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Adet</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTools.length > 0 ? filteredTools.map(tool => {
                      const sc = STATUS[tool.status] || STATUS.available
                      const lowStock = tool.quantity < tool.min_quantity
                      return (
                        <tr key={tool.id} className={`hover:bg-gray-50 transition-colors group ${lowStock ? 'bg-purple-50/30' : ''}`}>
                          {/* Kod / Takım */}
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-gray-800 text-sm">{tool.tool_code}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{tool.tool_name}</p>
                          </td>
                          {/* Tür / Tedarikçi */}
                          <td className="px-4 py-3.5">
                            {tool.tool_type && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium block w-fit">{tool.tool_type}</span>}
                            {tool.supplier && <p className="text-xs text-gray-400 mt-0.5">{tool.supplier.name}{tool.model ? ` · ${tool.model}` : ''}</p>}
                          </td>
                          {/* Lokasyon */}
                          <td className="px-4 py-3.5">
                            {tool.location ? (
                              <button onClick={() => setSearchTerm(searchTerm === tool.location ? '' : tool.location!)}
                                className="flex items-center gap-1 text-sm text-gray-700 hover:text-purple-700 transition-colors">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {tool.location}
                              </button>
                            ) : <span className="text-gray-300 text-sm">—</span>}
                          </td>
                          {/* Adet */}
                          <td className="px-4 py-3.5">
                            <span className={`font-bold text-lg ${lowStock ? 'text-purple-600' : 'text-gray-800'}`}>{tool.quantity}</span>
                            <span className="text-gray-400 text-xs"> / min {tool.min_quantity}</span>
                            {lowStock && <p className="text-xs text-purple-600 font-semibold">Kritik stok!</p>}
                          </td>
                          {/* İşlemler */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              {tool.status === 'available' && (
                                <button onClick={() => openCheckoutModal(tool)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                  Zimmetle
                                </button>
                              )}
                              <button onClick={() => openMaintenanceModal(tool)}
                                className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Bakım Ekle">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                              <button onClick={() => openEditToolModal(tool)}
                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Düzenle">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteTool(tool)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Sil">
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
                        <td colSpan={5} className="px-6 py-16 text-center">
                          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                          </svg>
                          <p className="text-gray-400">{searchTerm || statusFilter !== 'all' ? 'Filtreye uygun takım yok.' : 'Henüz takım yok. "Yeni Takım" ile ekleyin.'}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 2: AKTİF ZİMMETLER                               */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'checkouts' && (
          <div className="space-y-4">
            {checkouts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 font-medium">Tüm takımlar iade edilmiş — aktif zimmet yok.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-500">{checkouts.length} aktif zimmet{overdueCount > 0 && <span className="ml-2 text-red-600 font-semibold">· {overdueCount} süresi dolmuş</span>}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Takım</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teslim Alan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tezgah / Bölüm</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Çıkış</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Beklenen İade</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {checkouts.map(co => {
                        const overdue = isOverdue(co.expected_return_at)
                        return (
                          <tr key={co.id} className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-gray-800 text-sm">{co.tool?.tool_code}</p>
                              <p className="text-gray-500 text-xs">{co.tool?.tool_name}</p>
                              {co.tool?.location && <p className="text-xs text-gray-400 mt-0.5">📍 {co.tool.location}</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-sm font-medium text-gray-800">{co.checked_out_by}</p>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-600">
                              {co.tezgah && <p>{co.tezgah}</p>}
                              {co.department && <p className="text-xs text-gray-400">{co.department}</p>}
                              {!co.tezgah && !co.department && <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-600">
                              {formatDate(co.checked_out_at)}
                            </td>
                            <td className="px-4 py-3.5">
                              {co.expected_return_at ? (
                                <span className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
                                  {overdue && '⚠ '}{formatDate(co.expected_return_at)}
                                  {overdue && <span className="block text-xs font-normal">Süre doldu!</span>}
                                </span>
                              ) : <span className="text-gray-300 text-sm">Belirtilmemiş</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              <button onClick={() => openReturnModal(co)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                İade Al
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB 3: BAKIM GEÇMİŞİ                                 */}
        {/* ══════════════════════════════════════════════════════ */}
        {tab === 'maintenance' && (
          <div className="space-y-4">
            {maintenance.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
                <p className="text-gray-400">Henüz bakım kaydı yok.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-500">{maintenance.length} bakım kaydı</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tarih</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Takım</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bakım Türü</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Yapan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Maliyet</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sonraki Durum</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {maintenance.map(m => {
                        const sc = m.status_after ? STATUS[m.status_after as ToolStatus] : null
                        return (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(m.performed_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-gray-800 text-sm">{m.tool?.tool_code}</p>
                              <p className="text-gray-500 text-xs">{m.tool?.tool_name}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">{m.maintenance_type}</span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-600">{m.performed_by || <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-3.5 text-sm text-gray-600">
                              {m.cost != null ? `${m.cost.toLocaleString('tr-TR')} ₺` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {sc ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[160px]">
                              <span className="line-clamp-1">{m.notes || <span className="text-gray-300">—</span>}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL 1: YENİ TAKIM / DÜZENLE                         */}
      {/* ══════════════════════════════════════════════════════ */}
      {showToolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{editingTool ? 'Takımı Düzenle' : 'Yeni Takım Ekle'}</h3>
                {editingTool && <p className="text-xs text-gray-400 mt-0.5">{editingTool.tool_code}</p>}
              </div>
              <button onClick={() => setShowToolModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveTool} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Kodu *</label>
                  <input type="text" value={toolForm.tool_code} onChange={e => setToolForm({ ...toolForm, tool_code: e.target.value })} required placeholder="TK-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tür</label>
                  <select value={toolForm.tool_type} onChange={e => setToolForm({ ...toolForm, tool_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seçiniz</option>
                    {TOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Adı *</label>
                <input type="text" value={toolForm.tool_name} onChange={e => setToolForm({ ...toolForm, tool_name: e.target.value })} required placeholder="Ø10 Parmak Freze, Dijital Kumpas 150mm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tedarikçi</label>
                  <select value={toolForm.supplier_id} onChange={e => setToolForm({ ...toolForm, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seçiniz (Opsiyonel)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Model / Seri</label>
                  <input type="text" value={toolForm.model} onChange={e => setToolForm({ ...toolForm, model: e.target.value })} placeholder="CoroMill 390..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lokasyon</label>
                <div className="grid grid-cols-2 gap-4">
                  <select value={toolForm.location_letter} onChange={e => setToolForm({ ...toolForm, location_letter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Harf Seçiniz</option>
                    {LOCATION_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select value={toolForm.location_number} onChange={e => setToolForm({ ...toolForm, location_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Sayı Seçiniz</option>
                    {LOCATION_NUMBERS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Adet</label>
                  <input type="number" min="0" value={toolForm.quantity} onChange={e => setToolForm({ ...toolForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min. Adet</label>
                  <input type="number" min="0" value={toolForm.min_quantity} onChange={e => setToolForm({ ...toolForm, min_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                <textarea value={toolForm.notes} onChange={e => setToolForm({ ...toolForm, notes: e.target.value })} rows={2}
                  placeholder="Opsiyonel..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={toolModalLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-semibold transition-colors">
                  {toolModalLoading ? 'Kaydediliyor...' : editingTool ? 'Güncelle' : 'Ekle'}
                </button>
                <button type="button" onClick={() => setShowToolModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL 2: ZİMMET (CHECKOUT)                            */}
      {/* ══════════════════════════════════════════════════════ */}
      {showCheckoutModal && checkoutTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Zimmetle</h3>
                <p className="text-sm text-gray-500 mt-0.5">{checkoutTarget.tool_code} — {checkoutTarget.tool_name}</p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Teslim Alan *</label>
                <input type="text" value={checkoutForm.checked_out_by} onChange={e => setCheckoutForm({ ...checkoutForm, checked_out_by: e.target.value })} required
                  placeholder="Ad Soyad" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tezgah</label>
                  <input type="text" value={checkoutForm.tezgah} onChange={e => setCheckoutForm({ ...checkoutForm, tezgah: e.target.value })}
                    placeholder="Tezgah 3, CNC-1..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Departman</label>
                  <input type="text" value={checkoutForm.department} onChange={e => setCheckoutForm({ ...checkoutForm, department: e.target.value })}
                    placeholder="Freze, Torna..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Beklenen İade Tarihi</label>
                <input type="datetime-local" value={checkoutForm.expected_return_at} onChange={e => setCheckoutForm({ ...checkoutForm, expected_return_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Not</label>
                <input type="text" value={checkoutForm.notes} onChange={e => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                  placeholder="Opsiyonel" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={checkoutLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-semibold transition-colors">
                  {checkoutLoading ? 'Kaydediliyor...' : 'Zimmete Ver'}
                </button>
                <button type="button" onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL 3: İADE AL (RETURN)                             */}
      {/* ══════════════════════════════════════════════════════ */}
      {showReturnModal && returnTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">İade Al</h3>
                <p className="text-sm text-gray-500 mt-0.5">{returnTarget.tool?.tool_code} — {returnTarget.tool?.tool_name}</p>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Zimmet bilgisi */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm space-y-1">
              <p><span className="text-gray-500">Teslim alan:</span> <span className="font-semibold text-gray-800">{returnTarget.checked_out_by}</span></p>
              {returnTarget.tezgah && <p><span className="text-gray-500">Tezgah:</span> <span className="text-gray-700">{returnTarget.tezgah}</span></p>}
              <p><span className="text-gray-500">Çıkış:</span> <span className="text-gray-700">{formatDate(returnTarget.checked_out_at)}</span></p>
            </div>

            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">İade Durumu</label>
                <div className="space-y-2">
                  {(['good', 'worn', 'damaged'] as const).map(c => {
                    const cl = CONDITION_LABELS[c]
                    return (
                      <label key={c} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${returnForm.condition_on_return === c ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="condition" value={c} checked={returnForm.condition_on_return === c}
                          onChange={() => {
                            setReturnForm({
                              ...returnForm,
                              condition_on_return: c,
                              status_after: c === 'damaged' ? 'broken' : 'available',
                            })
                          }} className="sr-only" />
                        <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${returnForm.condition_on_return === c ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
                        <span className={`font-medium ${cl.color}`}>{cl.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">İade Sonrası Durum</label>
                <select value={returnForm.status_after} onChange={e => setReturnForm({ ...returnForm, status_after: e.target.value as ToolStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="available">Müsait</option>
                  <option value="maintenance">Bakıma Al</option>
                  <option value="broken">Arızalı Olarak İşaretle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Not</label>
                <input type="text" value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Opsiyonel" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={returnLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2.5 rounded-lg font-semibold transition-colors">
                  {returnLoading ? 'Kaydediliyor...' : 'İade Al'}
                </button>
                <button type="button" onClick={() => setShowReturnModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL 4: DURUM DEĞİŞTİR                              */}
      {/* ══════════════════════════════════════════════════════ */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Durum Değiştir</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
              <p className="font-semibold text-gray-800 text-sm">{statusTarget.tool_code} — {statusTarget.tool_name}</p>
              {statusTarget.location && <p className="text-xs text-gray-500 mt-0.5">📍 {statusTarget.location}</p>}
            </div>
            <div className="space-y-2">
              {(Object.entries(STATUS) as [ToolStatus, typeof STATUS[ToolStatus]][]).map(([key, cfg]) => (
                <button key={key} onClick={() => handleStatusChange(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    statusTarget.status === key ? `border-blue-500 ${cfg.bg}` : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className={`font-medium ${statusTarget.status === key ? cfg.text : 'text-gray-700'}`}>{cfg.label}</span>
                  {statusTarget.status === key && <span className="ml-auto text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">Mevcut</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowStatusModal(false)} className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors">İptal</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL 5: BAKIM EKLE                                   */}
      {/* ══════════════════════════════════════════════════════ */}
      {showMaintenanceModal && maintenanceTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Bakım Ekle</h3>
                <p className="text-sm text-gray-500 mt-0.5">{maintenanceTool.tool_code} — {maintenanceTool.tool_name}</p>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bakım Türü *</label>
                <input type="text" value={maintenanceForm.maintenance_type} onChange={e => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })} required
                  placeholder="Bileme, Tamir, Kalibrasyon, Temizlik..." list="maint-types"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <datalist id="maint-types">
                  <option value="Bileme" /><option value="Tamir" /><option value="Kalibrasyon" /><option value="Temizlik" /><option value="Yağlama" />
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Yapan</label>
                  <input type="text" value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })}
                    placeholder="Ad Soyad" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Maliyet (₺)</label>
                  <input type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bakım Sonrası Durum</label>
                <select value={maintenanceForm.status_after} onChange={e => setMaintenanceForm({ ...maintenanceForm, status_after: e.target.value as ToolStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="available">Müsait (Bakım tamamlandı)</option>
                  <option value="maintenance">Bakımda (devam ediyor)</option>
                  <option value="broken">Arızalı (tamir edilemedi)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Not</label>
                <textarea value={maintenanceForm.notes} onChange={e => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} rows={2}
                  placeholder="Opsiyonel..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={maintenanceLoading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white py-2.5 rounded-lg font-semibold transition-colors">
                  {maintenanceLoading ? 'Kaydediliyor...' : 'Bakım Ekle'}
                </button>
                <button type="button" onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

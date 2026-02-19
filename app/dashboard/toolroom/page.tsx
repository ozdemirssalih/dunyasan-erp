'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

type ToolStatus = 'available' | 'in_use' | 'maintenance' | 'lost'
type StatusFilter = 'all' | ToolStatus

interface Tool {
  id: string
  tool_code: string
  tool_name: string
  tool_type: string | null
  location: string | null
  status: ToolStatus
  notes: string | null
  created_at: string
}

const STATUS_CONFIG: Record<ToolStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available:   { label: 'Müsait',     bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-200' },
  in_use:      { label: 'Kullanımda', bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200' },
  maintenance: { label: 'Bakımda',    bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  lost:        { label: 'Kayıp',      bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200' },
}

export default function ToolroomPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [filtered, setFiltered] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filtreler
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Ekle / Düzenle Modal
  const [showModal, setShowModal] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [form, setForm] = useState({
    tool_code: '',
    tool_name: '',
    tool_type: '',
    location: '',
    status: 'available' as ToolStatus,
    notes: '',
  })

  // Durum Değiştir Modal
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Tool | null>(null)

  useEffect(() => { loadData() }, [])

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
        (t.location || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      )
    }
    setFiltered(f)
  }, [tools, statusFilter, typeFilter, searchTerm])

  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    let cid = profile?.company_id
    if (!cid) {
      const { data: co } = await supabase.from('companies').select('id').ilike('name', '%dünyasan%').limit(1).single()
      if (co?.id) {
        cid = co.id
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
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('company_id', cid)
        .order('tool_code')
      if (error) throw error
      setTools(data || [])
    } catch (err) {
      console.error('Takımhane yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingTool(null)
    setForm({ tool_code: '', tool_name: '', tool_type: '', location: '', status: 'available', notes: '' })
    setShowModal(true)
  }

  const openEditModal = (tool: Tool) => {
    setEditingTool(tool)
    setForm({
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      tool_type: tool.tool_type || '',
      location: tool.location || '',
      status: tool.status,
      notes: tool.notes || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setModalLoading(true)
    try {
      const payload = {
        tool_code: form.tool_code.trim(),
        tool_name: form.tool_name.trim(),
        tool_type: form.tool_type.trim() || null,
        location: form.location.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (!editingTool) {
        const { error } = await supabase.from('tools').insert({ ...payload, company_id: companyId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('tools').update(payload).eq('id', editingTool.id)
        if (error) throw error
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      alert('❌ Hata: ' + err.message)
    } finally {
      setModalLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: ToolStatus) => {
    if (!statusTarget) return
    try {
      const { error } = await supabase.from('tools').update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', statusTarget.id)
      if (error) throw error
      setShowStatusModal(false)
      setStatusTarget(null)
      loadData()
    } catch (err: any) {
      alert('❌ Hata: ' + err.message)
    }
  }

  const handleDelete = async (tool: Tool) => {
    if (!confirm(`"${tool.tool_name}" silinsin mi?`)) return
    try {
      const { error } = await supabase.from('tools').delete().eq('id', tool.id)
      if (error) throw error
      loadData()
    } catch (err: any) {
      alert('❌ Hata: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Takımhane yükleniyor...</p>
        </div>
      </div>
    )
  }

  const counts = {
    total:       tools.length,
    available:   tools.filter(t => t.status === 'available').length,
    in_use:      tools.filter(t => t.status === 'in_use').length,
    maintenance: tools.filter(t => t.status === 'maintenance').length,
    lost:        tools.filter(t => t.status === 'lost').length,
  }
  const uniqueTypes = Array.from(new Set(tools.map(t => t.tool_type || '').filter(Boolean))).sort()
  const uniqueLocations = Array.from(new Set(tools.map(t => t.location || '').filter(Boolean))).sort()

  return (
    <PermissionGuard module="toolroom" permission="view">
      <div className="space-y-6">

        {/* ── HEADER ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Takımhane</h2>
            <p className="text-gray-500 text-sm mt-1">Takım ve ekipman envanteri · {counts.total} kayıt</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Yeni Takım Ekle
          </button>
        </div>

        {/* ── STATS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {([
            { key: 'total',       label: 'Toplam',      value: counts.total,       color: 'text-gray-800', bg: 'bg-white' },
            { key: 'available',   label: 'Müsait',      value: counts.available,   color: 'text-green-600', bg: 'bg-green-50' },
            { key: 'in_use',      label: 'Kullanımda',  value: counts.in_use,      color: 'text-blue-600',  bg: 'bg-blue-50' },
            { key: 'maintenance', label: 'Bakımda',     value: counts.maintenance, color: 'text-orange-600',bg: 'bg-orange-50' },
            { key: 'lost',        label: 'Kayıp',       value: counts.lost,        color: 'text-red-600',   bg: 'bg-red-50' },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key === 'total' ? 'all' : s.key as StatusFilter)}
              className={`${s.bg} rounded-xl border border-gray-200 p-5 shadow-sm text-left hover:shadow-md transition-shadow`}
            >
              <p className="text-gray-500 text-sm font-medium mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* ── UYARI ─────────────────────────────────────────────── */}
        {(counts.lost > 0 || counts.maintenance > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-orange-800">
              {counts.lost > 0 && <p><span className="font-semibold">{counts.lost} kayıp takım</span> tespit edildi — lokasyon aramasıyla kontrol edin.</p>}
              {counts.maintenance > 0 && <p>{counts.maintenance} takım bakımda.</p>}
            </div>
          </div>
        )}

        {/* ── FİLTRELER ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          {/* Arama */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[260px] relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kod, isim, tür veya lokasyon ara..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {uniqueTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Tüm Türler</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            <button onClick={loadData} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">
              ↻ Yenile
            </button>
          </div>

          {/* Durum Filtresi */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all',         label: 'Tümü',       count: counts.total },
              { key: 'available',   label: 'Müsait',     count: counts.available },
              { key: 'in_use',      label: 'Kullanımda', count: counts.in_use },
              { key: 'maintenance', label: 'Bakımda',    count: counts.maintenance },
              { key: 'lost',        label: 'Kayıp',      count: counts.lost },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${statusFilter === f.key ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Lokasyon hızlı filtre (varsa) */}
          {uniqueLocations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-400 self-center mr-1">Lokasyon:</span>
              {uniqueLocations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setSearchTerm(searchTerm === loc ? '' : loc)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    searchTerm === loc
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── TABLO ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">{filtered.length} takım gösteriliyor</span>
            {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm('') }}
                className="text-xs text-blue-600 hover:underline"
              >
                Filtreleri temizle
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kod / Ad</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tür</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lokasyon</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notlar</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length > 0 ? filtered.map((tool) => {
                  const sc = STATUS_CONFIG[tool.status]
                  return (
                    <tr key={tool.id} className="hover:bg-gray-50 transition-colors group">

                      {/* Kod / Ad */}
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-800 text-sm">{tool.tool_code}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{tool.tool_name}</p>
                      </td>

                      {/* Tür */}
                      <td className="px-5 py-3.5">
                        {tool.tool_type
                          ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">{tool.tool_type}</span>
                          : <span className="text-gray-300 text-sm">—</span>}
                      </td>

                      {/* Lokasyon */}
                      <td className="px-5 py-3.5">
                        {tool.location
                          ? (
                            <button
                              onClick={() => setSearchTerm(searchTerm === tool.location ? '' : tool.location!)}
                              className="flex items-center gap-1 text-sm text-gray-700 hover:text-purple-700 transition-colors group/loc"
                              title="Bu lokasyona göre filtrele"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-400 group-hover/loc:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {tool.location}
                            </button>
                          )
                          : <span className="text-gray-300 text-sm">—</span>}
                      </td>

                      {/* Durum */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => { setStatusTarget(tool); setShowStatusModal(true) }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border} hover:opacity-80 transition-opacity`}
                          title="Durumu değiştir"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </button>
                      </td>

                      {/* Notlar */}
                      <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[200px]">
                        <span className="line-clamp-1">{tool.notes || <span className="text-gray-300">—</span>}</span>
                      </td>

                      {/* İşlemler */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(tool)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                            title="Düzenle"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(tool)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
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
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                      <p className="text-gray-400 font-medium">
                        {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                          ? 'Filtreye uygun takım bulunamadı.'
                          : 'Henüz takım kaydı yok. "Yeni Takım Ekle" ile başlayın.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── EKLE / DÜZENLE MODAL ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {editingTool ? 'Takımı Düzenle' : 'Yeni Takım Ekle'}
                </h3>
                {editingTool && <p className="text-xs text-gray-400 mt-0.5">{editingTool.tool_code}</p>}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Kod & Tür */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Kodu *</label>
                  <input
                    type="text"
                    value={form.tool_code}
                    onChange={(e) => setForm({ ...form, tool_code: e.target.value })}
                    required
                    placeholder="TK-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tür</label>
                  <input
                    type="text"
                    value={form.tool_type}
                    onChange={(e) => setForm({ ...form, tool_type: e.target.value })}
                    placeholder="Kesici, matkap..."
                    list="tool-type-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <datalist id="tool-type-list">
                    {uniqueTypes.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>

              {/* Ad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Takım Adı *</label>
                <input
                  type="text"
                  value={form.tool_name}
                  onChange={(e) => setForm({ ...form, tool_name: e.target.value })}
                  required
                  placeholder="Takımın tam adı"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Lokasyon & Durum */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lokasyon</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Raf B3, Dolap 2..."
                    list="location-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <datalist id="location-list">
                    {uniqueLocations.map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durum</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ToolStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="available">Müsait</option>
                    <option value="in_use">Kullanımda</option>
                    <option value="maintenance">Bakımda</option>
                    <option value="lost">Kayıp</option>
                  </select>
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notlar</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Opsiyonel not..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {modalLoading ? 'Kaydediliyor...' : editingTool ? 'Güncelle' : 'Ekle'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DURUM DEĞİŞTİR MODAL ──────────────────────────────── */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Durum Değiştir</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
              <p className="font-semibold text-gray-800 text-sm">{statusTarget.tool_code} — {statusTarget.tool_name}</p>
              {statusTarget.location && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {statusTarget.location}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {(Object.entries(STATUS_CONFIG) as [ToolStatus, typeof STATUS_CONFIG[ToolStatus]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    statusTarget.status === key
                      ? `border-blue-500 ${cfg.bg}`
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className={`font-medium ${statusTarget.status === key ? cfg.text : 'text-gray-700'}`}>{cfg.label}</span>
                  {statusTarget.status === key && (
                    <span className="ml-auto text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">Mevcut</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

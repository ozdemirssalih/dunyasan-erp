'use client'

import { useState, useEffect, useMemo } from 'react'
import { Play, Square, RotateCcw, StopCircle, Activity, Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Package, User, Target, X } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  status: string
}

interface WorkSession {
  id: string
  machine_id: string
  status: 'running_pending_qc' | 'running_approved' | 'paused' | 'ended'
  accumulated_seconds: number
  started_at: string
  ended_at: string | null
  project_id: string | null
  operator_id: string | null
  part_cycle_seconds: number | null
  part_name: string | null
  produced_quantity: number | null
}

interface WorkRun {
  id: string
  session_id: string
  machine_id: string
  started_at: string
  stopped_at: string | null
  duration_seconds: number | null
  quality_status: 'pending' | 'approved'
  quality_approved_at: string | null
  pause_reason: string | null
}

interface Project {
  id: string
  project_name: string
}

interface Employee {
  id: string
  full_name: string
  department: string | null
}

export default function StationTrackingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState<Machine[]>([])
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [runs, setRuns] = useState<WorkRun[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [_, setTick] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  const [showStartModal, setShowStartModal] = useState(false)
  const [startingMachineId, setStartingMachineId] = useState<string | null>(null)
  const [startForm, setStartForm] = useState({ project_id: '', operator_id: '', part_name: '', part_cycle_minutes: '', part_cycle_seconds: '' })

  const [showStopModal, setShowStopModal] = useState(false)
  const [stoppingMachineId, setStoppingMachineId] = useState<string | null>(null)
  const [stopReason, setStopReason] = useState('')

  const [showEndModal, setShowEndModal] = useState(false)
  const [endingSession, setEndingSession] = useState<WorkSession | null>(null)
  const [endProducedQty, setEndProducedQty] = useState('')

  const [expandedMachine, setExpandedMachine] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [machinesRes, sessionsRes, runsRes, projectsRes, employeesRes] = await Promise.all([
        supabase.from('machines').select('id, machine_code, machine_name, status').eq('company_id', profile.company_id).order('machine_code'),
        supabase.from('machine_work_sessions').select('*').eq('company_id', profile.company_id).neq('status', 'ended').order('started_at', { ascending: false }),
        supabase.from('machine_work_runs').select('*').eq('company_id', profile.company_id).order('started_at', { ascending: false }).limit(500),
        supabase.from('projects').select('id, project_name').eq('company_id', profile.company_id).order('project_name'),
        supabase.from('employees').select('id, full_name, department').eq('company_id', profile.company_id).eq('status', 'active').order('full_name'),
      ])

      setMachines(machinesRes.data || [])
      setSessions(sessionsRes.data || [])
      setRuns(runsRes.data || [])
      setProjects(projectsRes.data || [])
      setEmployees(employeesRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // ============ HELPERS ============
  const getActiveSession = (machineId: string) => sessions.find(s => s.machine_id === machineId && s.status !== 'ended')
  const getCurrentRun = (sessionId: string) => runs.find(r => r.session_id === sessionId && !r.stopped_at)

  // Bugünün başlangıcı (yerel saat, 00:00)
  const todayStartISO = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  // Bugünkü toplam çalışma süresi (sadece bu makinenin bu gün içindeki run'ları — duruşlarda ekleme yok)
  const getTodayWorkedSeconds = (machineId: string) => {
    const machineRuns = runs.filter(r => r.machine_id === machineId)
    let total = 0
    machineRuns.forEach(r => {
      if (r.started_at < todayStartISO && (!r.stopped_at || r.stopped_at < todayStartISO)) return
      const startMs = Math.max(new Date(r.started_at).getTime(), new Date(todayStartISO).getTime())
      const endMs = r.stopped_at ? new Date(r.stopped_at).getTime() : Date.now()
      if (endMs > startMs) total += Math.floor((endMs - startMs) / 1000)
    })
    return total
  }

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatCycle = (sec: number | null) => {
    if (!sec || sec <= 0) return '—'
    if (sec < 60) return `${sec} sn`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}dk ${s}sn` : `${m} dk`
  }

  // ============ START MODAL ============
  const openStartModal = (machineId: string) => {
    if (getActiveSession(machineId)) return alert('Bu makinede zaten aktif bir oturum var!')
    setStartingMachineId(machineId)
    setStartForm({ project_id: '', operator_id: '', part_name: '', part_cycle_minutes: '', part_cycle_seconds: '' })
    setShowStartModal(true)
  }

  const handleStartConfirm = async () => {
    if (!companyId || !userId || !startingMachineId) return
    const mins = parseInt(startForm.part_cycle_minutes || '0', 10) || 0
    const secs = parseInt(startForm.part_cycle_seconds || '0', 10) || 0
    const cycleSec = mins * 60 + secs
    if (cycleSec <= 0) return alert('Parça başı süre 0\'dan büyük olmalı!')
    if (!startForm.operator_id) return alert('Operatör seçimi zorunlu!')

    try {
      const { data: session, error: sErr } = await supabase.from('machine_work_sessions').insert({
        company_id: companyId,
        machine_id: startingMachineId,
        status: 'running_pending_qc',
        accumulated_seconds: 0,
        started_by: userId,
        project_id: startForm.project_id || null,
        operator_id: startForm.operator_id,
        part_name: startForm.part_name.trim() || null,
        part_cycle_seconds: cycleSec,
      }).select().single()
      if (sErr) throw sErr

      const { error: rErr } = await supabase.from('machine_work_runs').insert({
        session_id: session.id,
        company_id: companyId,
        machine_id: startingMachineId,
        started_at: new Date().toISOString(),
        quality_status: 'pending',
        started_by: userId,
      })
      if (rErr) throw rErr

      setShowStartModal(false)
      setStartingMachineId(null)
      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  // ============ RESUME / END ============
  const handleResume = async (session: WorkSession) => {
    if (!companyId || !userId) return
    try {
      await supabase.from('machine_work_runs').insert({
        session_id: session.id,
        company_id: companyId,
        machine_id: session.machine_id,
        started_at: new Date().toISOString(),
        quality_status: 'pending',
        started_by: userId,
      })
      await supabase.from('machine_work_sessions')
        .update({ status: 'running_pending_qc' })
        .eq('id', session.id)
      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleStopClick = (machineId: string) => {
    setStoppingMachineId(machineId)
    setStopReason('')
    setShowStopModal(true)
  }

  const handleStopConfirm = async () => {
    if (!companyId || !userId || !stoppingMachineId) return
    if (!stopReason.trim()) return alert('Duruş sebebi zorunludur!')
    const session = getActiveSession(stoppingMachineId)
    if (!session) return alert('Aktif oturum bulunamadı!')
    const currentRun = getCurrentRun(session.id)
    if (!currentRun) return alert('Aktif run bulunamadı!')

    const now = new Date()
    const runDuration = Math.floor((now.getTime() - new Date(currentRun.started_at).getTime()) / 1000)

    try {
      await supabase.from('machine_work_runs').update({
        stopped_at: now.toISOString(),
        duration_seconds: runDuration,
        pause_reason: stopReason.trim(),
        stopped_by: userId,
      }).eq('id', currentRun.id)

      await supabase.from('machine_work_sessions').update({
        status: 'paused',
        accumulated_seconds: (session.accumulated_seconds || 0) + runDuration,
      }).eq('id', session.id)

      setShowStopModal(false)
      setStoppingMachineId(null)
      setStopReason('')
      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const openEndModal = (session: WorkSession) => {
    setEndingSession(session)
    setEndProducedQty('')
    setShowEndModal(true)
  }

  const handleEndConfirm = async () => {
    if (!companyId || !userId || !endingSession) return
    const producedQty = parseInt(endProducedQty || '0', 10)
    if (isNaN(producedQty) || producedQty < 0) return alert('Geçerli bir üretim miktarı gir!')

    try {
      if (endingSession.status === 'running_pending_qc' || endingSession.status === 'running_approved') {
        const currentRun = getCurrentRun(endingSession.id)
        if (currentRun) {
          const now = new Date()
          const runDuration = Math.floor((now.getTime() - new Date(currentRun.started_at).getTime()) / 1000)
          await supabase.from('machine_work_runs').update({
            stopped_at: now.toISOString(),
            duration_seconds: runDuration,
            pause_reason: 'Mesai bitirildi',
            stopped_by: userId,
          }).eq('id', currentRun.id)
          await supabase.from('machine_work_sessions').update({
            accumulated_seconds: (endingSession.accumulated_seconds || 0) + runDuration,
          }).eq('id', endingSession.id)
        }
      }
      await supabase.from('machine_work_sessions').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_by: userId,
        produced_quantity: producedQty,
      }).eq('id', endingSession.id)

      setShowEndModal(false)
      setEndingSession(null)
      setEndProducedQty('')
      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const filteredMachines = machines.filter(m =>
    searchTerm === '' || m.machine_code.toLowerCase().includes(searchTerm.toLowerCase()) || m.machine_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const runningCount = sessions.filter(s => s.status === 'running_approved').length
  const pendingQCCount = sessions.filter(s => s.status === 'running_pending_qc').length
  const pausedCount = sessions.filter(s => s.status === 'paused').length
  const idleCount = machines.length - runningCount - pendingQCCount - pausedCount

  const todayTotalAll = machines.reduce((s, m) => s + getTodayWorkedSeconds(m.id), 0)

  if (loading) return (
    <PermissionGuard module="machines" permission="view">
      <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
    </PermissionGuard>
  )

  return (
    <PermissionGuard module="machines" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              İstasyon Takip Sistemi (İTS)
            </h2>
            <p className="text-gray-600 text-sm">Süreler her yeni günde otomatik sıfırlanır. Duruşlarda süre işlemez, tekrar başlayınca kaldığı yerden devam.</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-gray-800">{new Date().toLocaleTimeString('tr-TR')}</div>
            <div className="text-xs text-gray-500">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-500">Kalite Onayı Bekliyor</p>
            <p className="text-3xl font-bold text-orange-600">{pendingQCCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Çalışıyor (Onaylı)</p>
            <p className="text-3xl font-bold text-green-600">{runningCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">Duruşta</p>
            <p className="text-3xl font-bold text-blue-600">{pausedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-500">Boş / Beklemede</p>
            <p className="text-3xl font-bold text-gray-600">{idleCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500">Bugün Toplam Çalışma</p>
            <p className="text-3xl font-bold text-purple-600 font-mono">{formatDuration(todayTotalAll)}</p>
          </div>
        </div>

        {/* Arama */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Makine kodu veya adı ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Makine Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map(machine => {
            const session = getActiveSession(machine.id)
            const state = session?.status || 'idle'
            const todaySec = getTodayWorkedSeconds(machine.id)
            const machineRuns = runs.filter(r => r.machine_id === machine.id).slice(0, 5)
            const isExpanded = expandedMachine === machine.id

            const isPendingQC = state === 'running_pending_qc'
            const isApproved = state === 'running_approved'
            const isPaused = state === 'paused'
            const isRunning = isPendingQC || isApproved

            const borderColor = isPendingQC ? 'border-orange-400' : isApproved ? 'border-green-400' : isPaused ? 'border-blue-400' : 'border-gray-200'
            const bgColor = isPendingQC ? 'bg-orange-50' : isApproved ? 'bg-green-50' : isPaused ? 'bg-blue-50' : 'bg-gray-50'
            const textColor = isPendingQC ? 'text-orange-600' : isApproved ? 'text-green-600' : isPaused ? 'text-blue-600' : 'text-gray-400'
            const dotColor = isPendingQC ? 'bg-orange-500 animate-pulse' : isApproved ? 'bg-green-500 animate-pulse' : isPaused ? 'bg-blue-500' : 'bg-gray-300'
            const statusLabel = isPendingQC ? 'ÇALIŞIYOR — KALİTE ONAYI BEKLENİYOR' : isApproved ? 'ÇALIŞIYOR — ONAYLI' : isPaused ? 'DURUŞTA' : 'BOŞ'

            const project = session?.project_id ? projects.find(p => p.id === session.project_id) : null
            const operator = session?.operator_id ? employees.find(e => e.id === session.operator_id) : null
            const cycleSec = session?.part_cycle_seconds || 0
            const targetQty = cycleSec > 0 ? Math.floor(todaySec / cycleSec) : 0

            return (
              <div key={machine.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${borderColor}`}>
                {/* Başlık */}
                <div className={`px-4 py-3 ${bgColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{machine.machine_code}</h3>
                      <p className="text-xs text-gray-500 truncate">{machine.machine_name}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                  </div>
                </div>

                {/* Timer */}
                <div className="px-4 py-3 text-center">
                  <div className={`text-3xl font-mono font-bold mb-1 ${textColor}`}>{formatDuration(todaySec)}</div>
                  <p className={`text-[10px] font-semibold ${textColor}`}>{statusLabel}</p>
                </div>

                {/* Session Bilgi Kutuları */}
                {session && (
                  <div className="mx-3 mb-3 grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2 col-span-2">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase mb-0.5">
                        <Package className="w-3 h-3" /> Proje
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate" title={project?.project_name || '—'}>{project?.project_name || '—'}</p>
                      {session.part_name && <p className="text-[10px] text-gray-500 truncate">{session.part_name}</p>}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase mb-0.5">
                        <User className="w-3 h-3" /> Operatör
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate" title={operator?.full_name || '—'}>{operator?.full_name || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase mb-0.5">Parça Başı</div>
                      <p className="text-xs font-semibold text-gray-800">{formatCycle(cycleSec)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 col-span-2">
                      <div className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold uppercase mb-0.5">
                        <Target className="w-3 h-3" /> Hedef Miktar (Bugünkü Çalışma / Parça Başı)
                      </div>
                      <p className="text-lg font-bold text-blue-700">{cycleSec > 0 ? `${targetQty.toLocaleString('tr-TR')} adet` : '—'}</p>
                    </div>
                  </div>
                )}

                {/* Butonlar */}
                <div className="px-4 pb-3 space-y-2">
                  {!session && (
                    <button onClick={() => openStartModal(machine.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
                      <Play className="w-4 h-4" /> Makineyi Çalıştır
                    </button>
                  )}
                  {isRunning && (
                    <>
                      <button onClick={() => handleStopClick(machine.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">
                        <Square className="w-4 h-4" /> Durdur
                      </button>
                      <button onClick={() => openEndModal(session!)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold text-[11px]">
                        <StopCircle className="w-3 h-3" /> İşi Bitir
                      </button>
                    </>
                  )}
                  {isPaused && (
                    <div className="space-y-2">
                      <button onClick={() => handleResume(session!)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                        <RotateCcw className="w-4 h-4" /> Tekrar Başlat
                      </button>
                      <button onClick={() => openEndModal(session!)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-xs">
                        <StopCircle className="w-3 h-3" /> İşi Bitir (Session Kapat)
                      </button>
                    </div>
                  )}
                </div>

                {/* Son Kayıtlar Toggle */}
                <div className="border-t">
                  <button onClick={() => setExpandedMachine(isExpanded ? null : machine.id)}
                    className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-500 hover:bg-gray-50">
                    <span>Son runlar ({machineRuns.length})</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                      {machineRuns.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Kayıt yok</p>
                      ) : machineRuns.map(run => (
                        <div key={run.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            !run.stopped_at ? (run.quality_status === 'approved' ? 'bg-green-500' : 'bg-orange-500') : 'bg-gray-400'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            {run.duration_seconds != null ? (
                              <>
                                <span className="font-semibold text-gray-800">{formatDuration(run.duration_seconds)}</span>
                                <span className="text-gray-400 ml-1">• {new Date(run.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                {run.pause_reason && (
                                  <p className="text-gray-500 mt-0.5 truncate" title={run.pause_reason}>
                                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />{run.pause_reason}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className={run.quality_status === 'approved' ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                                {run.quality_status === 'approved' ? 'Çalışıyor (onaylı)' : 'Çalışıyor (KK bekliyor)'}
                              </span>
                            )}
                            {run.quality_approved_at && !run.stopped_at && (
                              <p className="text-green-600 mt-0.5 text-[10px]">
                                <CheckCircle2 className="w-3 h-3 inline" /> Onaylandı {new Date(run.quality_approved_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* START MODAL — proje/operatör/parça-başı-süre al */}
        {showStartModal && startingMachineId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowStartModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Makineyi Çalıştır</h3>
                  <p className="text-sm text-gray-500">
                    {machines.find(m => m.id === startingMachineId)?.machine_code} — {machines.find(m => m.id === startingMachineId)?.machine_name}
                  </p>
                </div>
                <button onClick={() => setShowStartModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600"/></button>
              </div>

              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 mb-4">
                ⏱ Onay butonuna basınca süre <b>hemen başlar</b> ve kart turuncu olur — kaliteden onay gelince yeşile döner.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Proje</label>
                  <select value={startForm.project_id} onChange={e => setStartForm({...startForm, project_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">— Seçiniz (opsiyonel) —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Operatör *</label>
                  <select value={startForm.operator_id} onChange={e => setStartForm({...startForm, operator_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">— Seçiniz —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} {e.department ? `(${e.department})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Parça Adı / Kod</label>
                  <input value={startForm.part_name} onChange={e => setStartForm({...startForm, part_name: e.target.value})}
                    placeholder="Opsiyonel — örn: MP5-Yatak"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Parça Başı Süre *</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={startForm.part_cycle_minutes} onChange={e => setStartForm({...startForm, part_cycle_minutes: e.target.value})}
                      placeholder="dk" className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"/>
                    <span className="text-gray-500 text-xs">dakika</span>
                    <input type="number" min="0" max="59" value={startForm.part_cycle_seconds} onChange={e => setStartForm({...startForm, part_cycle_seconds: e.target.value})}
                      placeholder="sn" className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"/>
                    <span className="text-gray-500 text-xs">saniye</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Bir parçayı üretmek için gereken standart süre. Hedef miktar buradan hesaplanır.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowStartModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={handleStartConfirm}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> Başlat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STOP MODAL */}
        {showStopModal && stoppingMachineId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowStopModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Makineyi Durdur</h3>
              <p className="text-sm text-gray-500 mb-4">
                {machines.find(m => m.id === stoppingMachineId)?.machine_code} — {machines.find(m => m.id === stoppingMachineId)?.machine_name}
              </p>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                💡 Süre sıfırlanmaz — biriken toplam saklanır. Tekrar Başlat'a bastığında kaldığı yerden devam eder ve yeni kalite onayı beklenir.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Duruş Sebebi <span className="text-red-500">*</span></label>
                <textarea value={stopReason} onChange={e => setStopReason(e.target.value)} rows={3}
                  placeholder="Duruş sebebini yazın... (Ör: Arıza, Bakım, Mola, Malzeme bekleme)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" autoFocus />
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {['Arıza', 'Planlı Bakım', 'Malzeme Bekleme', 'Takım Değişimi', 'Vardiya Sonu', 'Mola', 'Kalite Problemi', 'Elektrik Kesintisi'].map(reason => (
                  <button key={reason} onClick={() => setStopReason(reason)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${stopReason === reason ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                    {reason}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowStopModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={handleStopConfirm} disabled={!stopReason.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-300 flex items-center justify-center gap-2">
                  <Square className="w-4 h-4" /> Durdur
                </button>
              </div>
            </div>
          </div>
        )}

        {/* END SESSION MODAL — mesai bitiminde üretim miktarı sor */}
        {showEndModal && endingSession && (() => {
          const machine = machines.find(m => m.id === endingSession.machine_id)
          const todaySec = getTodayWorkedSeconds(endingSession.machine_id)
          const cycleSec = endingSession.part_cycle_seconds || 0
          const targetQty = cycleSec > 0 ? Math.floor(todaySec / cycleSec) : 0
          const producedNum = parseInt(endProducedQty || '0', 10) || 0
          const eff = targetQty > 0 ? Math.round((producedNum / targetQty) * 100) : 0
          const operator = endingSession.operator_id ? employees.find(e => e.id === endingSession.operator_id) : null
          return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEndModal(false)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Mesai / İşi Bitir</h3>
                    <p className="text-sm text-gray-500">{machine?.machine_code} — {machine?.machine_name}</p>
                  </div>
                  <button onClick={() => setShowEndModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600"/></button>
                </div>

                {/* Özet Kartları */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-[10px] text-purple-700 font-semibold uppercase">Bugünkü Çalışma</p>
                    <p className="text-xl font-mono font-bold text-purple-900">{formatDuration(todaySec)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-[10px] text-blue-700 font-semibold uppercase">Hedef Miktar</p>
                    <p className="text-xl font-bold text-blue-900">{targetQty} adet</p>
                    {cycleSec > 0 && <p className="text-[10px] text-blue-600 mt-0.5">Parça başı {formatCycle(cycleSec)}</p>}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 col-span-2">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase">Operatör</p>
                    <p className="text-sm font-semibold text-gray-800">{operator?.full_name || '—'}</p>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kaç Ürün Üretildi? <span className="text-red-500">*</span></label>
                  <input type="number" min="0" value={endProducedQty} onChange={e => setEndProducedQty(e.target.value)}
                    placeholder="Örn: 320"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
                    autoFocus />
                </div>

                {producedNum > 0 && targetQty > 0 && (
                  <div className={`rounded-lg p-3 mb-4 border-2 ${eff >= 100 ? 'bg-green-50 border-green-300' : eff >= 80 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300'}`}>
                    <p className="text-[10px] font-semibold uppercase text-gray-700">Verimlilik</p>
                    <p className={`text-3xl font-bold ${eff >= 100 ? 'text-green-700' : eff >= 80 ? 'text-yellow-700' : 'text-red-700'}`}>
                      %{eff}
                    </p>
                    <p className="text-[10px] text-gray-600">{producedNum} üretim / {targetQty} hedef</p>
                  </div>
                )}

                <p className="text-[11px] text-gray-500 mb-4">
                  Bu bilgi kayda geçer. Session ended olur — yeni "Makineyi Çalıştır" ile ayrı bir oturum açılır. Süre yarın 00:00'da sıfırlanır.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setShowEndModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">İptal</button>
                  <button onClick={handleEndConfirm}
                    className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                    <StopCircle className="w-4 h-4" /> İşi Bitir
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </PermissionGuard>
  )
}

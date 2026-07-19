'use client'

import { useState, useEffect } from 'react'
import { Play, Square, RotateCcw, StopCircle, Clock, Activity, Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

export default function StationTrackingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState<Machine[]>([])
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [runs, setRuns] = useState<WorkRun[]>([])
  const [_, setTick] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  const [showStopModal, setShowStopModal] = useState(false)
  const [stoppingMachineId, setStoppingMachineId] = useState<string | null>(null)
  const [stopReason, setStopReason] = useState('')

  const [expandedMachine, setExpandedMachine] = useState<string | null>(null)

  // Canlı timer
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

      const [machinesRes, sessionsRes, runsRes] = await Promise.all([
        supabase.from('machines').select('id, machine_code, machine_name, status').eq('company_id', profile.company_id).order('machine_code'),
        supabase.from('machine_work_sessions').select('*').eq('company_id', profile.company_id).neq('status', 'ended').order('started_at', { ascending: false }),
        supabase.from('machine_work_runs').select('*').eq('company_id', profile.company_id).order('started_at', { ascending: false }).limit(500),
      ])

      setMachines(machinesRes.data || [])
      setSessions(sessionsRes.data || [])
      setRuns(runsRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // ============ HELPERS ============
  const getActiveSession = (machineId: string) => sessions.find(s => s.machine_id === machineId && s.status !== 'ended')
  const getCurrentRun = (sessionId: string) => runs.find(r => r.session_id === sessionId && !r.stopped_at)
  const getElapsedNow = (session: WorkSession) => {
    let total = session.accumulated_seconds || 0
    if (session.status === 'running_pending_qc' || session.status === 'running_approved') {
      const currentRun = getCurrentRun(session.id)
      if (currentRun) {
        total += Math.floor((Date.now() - new Date(currentRun.started_at).getTime()) / 1000)
      }
    }
    return total
  }
  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ============ ACTIONS ============
  const handleStart = async (machineId: string) => {
    if (!companyId || !userId) return
    if (getActiveSession(machineId)) return alert('Bu makinede zaten aktif bir oturum var!')
    try {
      // Yeni session
      const { data: session, error: sErr } = await supabase.from('machine_work_sessions').insert({
        company_id: companyId,
        machine_id: machineId,
        status: 'running_pending_qc',
        accumulated_seconds: 0,
        started_by: userId,
      }).select().single()
      if (sErr) throw sErr

      // İlk run
      const { error: rErr } = await supabase.from('machine_work_runs').insert({
        session_id: session.id,
        company_id: companyId,
        machine_id: machineId,
        started_at: new Date().toISOString(),
        quality_status: 'pending',
        started_by: userId,
      })
      if (rErr) throw rErr

      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleResume = async (session: WorkSession) => {
    if (!companyId || !userId) return
    if (session.status !== 'paused') return
    try {
      // Yeni run — pending qc
      const { error: rErr } = await supabase.from('machine_work_runs').insert({
        session_id: session.id,
        company_id: companyId,
        machine_id: session.machine_id,
        started_at: new Date().toISOString(),
        quality_status: 'pending',
        started_by: userId,
      })
      if (rErr) throw rErr

      // Session status
      const { error: sErr } = await supabase.from('machine_work_sessions')
        .update({ status: 'running_pending_qc' })
        .eq('id', session.id)
      if (sErr) throw sErr

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
    const startedAt = new Date(currentRun.started_at)
    const runDuration = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    const newAccumulated = (session.accumulated_seconds || 0) + runDuration

    try {
      // Run kapat
      const { error: rErr } = await supabase.from('machine_work_runs').update({
        stopped_at: now.toISOString(),
        duration_seconds: runDuration,
        pause_reason: stopReason.trim(),
        stopped_by: userId,
      }).eq('id', currentRun.id)
      if (rErr) throw rErr

      // Session paused, accumulated güncelle
      const { error: sErr } = await supabase.from('machine_work_sessions').update({
        status: 'paused',
        accumulated_seconds: newAccumulated,
      }).eq('id', session.id)
      if (sErr) throw sErr

      setShowStopModal(false)
      setStoppingMachineId(null)
      setStopReason('')
      await loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleEndSession = async (session: WorkSession) => {
    if (!companyId || !userId) return
    if (!confirm(`İş oturumunu tamamen bitir?\n\nToplam süre: ${formatDuration(getElapsedNow(session))}\n\nBu işlem geri alınamaz — session ended olacak, yeni "Makineyi Çalıştır" ile ayrı bir oturum başlar.`)) return

    try {
      // Eğer running ise önce aktif run'ı kapat
      if (session.status === 'running_pending_qc' || session.status === 'running_approved') {
        const currentRun = getCurrentRun(session.id)
        if (currentRun) {
          const now = new Date()
          const runDuration = Math.floor((now.getTime() - new Date(currentRun.started_at).getTime()) / 1000)
          await supabase.from('machine_work_runs').update({
            stopped_at: now.toISOString(),
            duration_seconds: runDuration,
            pause_reason: 'İş bitirildi',
            stopped_by: userId,
          }).eq('id', currentRun.id)
          await supabase.from('machine_work_sessions').update({
            accumulated_seconds: (session.accumulated_seconds || 0) + runDuration,
          }).eq('id', session.id)
        }
      }

      const { error } = await supabase.from('machine_work_sessions').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_by: userId,
      }).eq('id', session.id)
      if (error) throw error

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

  // Bugünkü toplam çalışma
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotalSec = runs
    .filter(r => r.started_at >= todayStr && r.duration_seconds)
    .reduce((s, r) => s + (r.duration_seconds || 0), 0)

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
            <p className="text-gray-600">Makine çalıştır → süre hemen başlar (turuncu) → kalite onayı gelince yeşile döner → duruşta süre birikir</p>
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
            <p className="text-3xl font-bold text-purple-600 font-mono">{formatDuration(todayTotalSec)}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMachines.map(machine => {
            const session = getActiveSession(machine.id)
            const state = session?.status || 'idle'
            const elapsed = session ? getElapsedNow(session) : 0
            const machineRuns = runs.filter(r => r.machine_id === machine.id).slice(0, 5)
            const isExpanded = expandedMachine === machine.id

            const isPendingQC = state === 'running_pending_qc'
            const isApproved = state === 'running_approved'
            const isPaused = state === 'paused'
            const isRunning = isPendingQC || isApproved

            const borderColor =
              isPendingQC ? 'border-orange-400' :
              isApproved ? 'border-green-400' :
              isPaused ? 'border-blue-400' :
              'border-gray-200'
            const bgColor =
              isPendingQC ? 'bg-orange-50' :
              isApproved ? 'bg-green-50' :
              isPaused ? 'bg-blue-50' :
              'bg-gray-50'
            const textColor =
              isPendingQC ? 'text-orange-600' :
              isApproved ? 'text-green-600' :
              isPaused ? 'text-blue-600' :
              'text-gray-400'
            const dotColor =
              isPendingQC ? 'bg-orange-500 animate-pulse' :
              isApproved ? 'bg-green-500 animate-pulse' :
              isPaused ? 'bg-blue-500' :
              'bg-gray-300'
            const statusLabel =
              isPendingQC ? 'ÇALIŞIYOR — KALİTE ONAYI BEKLENİYOR' :
              isApproved ? 'ÇALIŞIYOR — ONAYLI' :
              isPaused ? 'DURUŞTA' :
              'BOŞ'

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
                <div className="px-4 py-4 text-center">
                  <div className={`text-3xl font-mono font-bold mb-2 ${textColor}`}>
                    {formatDuration(elapsed)}
                  </div>
                  <p className={`text-[10px] font-semibold ${textColor}`}>{statusLabel}</p>
                </div>

                {/* Butonlar */}
                <div className="px-4 pb-3 space-y-2">
                  {!session && (
                    <button onClick={() => handleStart(machine.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
                      <Play className="w-4 h-4" /> Makineyi Çalıştır
                    </button>
                  )}
                  {isRunning && (
                    <button onClick={() => handleStopClick(machine.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">
                      <Square className="w-4 h-4" /> Durdur
                    </button>
                  )}
                  {isPaused && (
                    <div className="space-y-2">
                      <button onClick={() => handleResume(session!)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                        <RotateCcw className="w-4 h-4" /> Tekrar Başlat
                      </button>
                      <button onClick={() => handleEndSession(session!)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-xs">
                        <StopCircle className="w-3 h-3" /> İşi Bitir (Session Kapat)
                      </button>
                    </div>
                  )}
                  {isRunning && (
                    <button onClick={() => handleEndSession(session!)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold text-[11px]">
                      <StopCircle className="w-3 h-3" /> İşi Bitir
                    </button>
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
                            !run.stopped_at ? (run.quality_status === 'approved' ? 'bg-green-500' : 'bg-orange-500') :
                            'bg-gray-400'
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

        {/* Durdurma Modalı */}
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
      </div>
    </PermissionGuard>
  )
}

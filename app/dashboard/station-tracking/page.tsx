'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Square, Clock, Activity, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  status: string
}

interface ActiveSession {
  id: string
  machine_id: string
  started_at: string
  started_by: string
}

interface StationLog {
  id: string
  machine_id: string
  action: string
  started_at: string
  stopped_at: string | null
  duration_seconds: number | null
  stop_reason: string | null
  started_by_name?: string
  stopped_by_name?: string
  created_at: string
}

export default function StationTrackingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState<Machine[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [logs, setLogs] = useState<StationLog[]>([])
  const [tick, setTick] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [showStopModal, setShowStopModal] = useState(false)
  const [stoppingMachineId, setStoppingMachineId] = useState<string | null>(null)
  const [stopReason, setStopReason] = useState('')
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<'all' | 'today' | 'week'>('today')
  const [pendingQC, setPendingQC] = useState<any[]>([])
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Timer tick
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
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

      const [machinesRes, sessionsRes, logsRes, pendingRes] = await Promise.all([
        supabase.from('machines').select('id, machine_code, machine_name, status').eq('company_id', profile.company_id).order('machine_code'),
        supabase.from('station_logs').select('id, machine_id, started_at, started_by').eq('company_id', profile.company_id).eq('action', 'start').is('stopped_at', null),
        supabase.from('station_logs').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(200),
        supabase.from('station_logs').select('id, machine_id, started_by, created_at').eq('company_id', profile.company_id).eq('action', 'pending_qc').eq('qc_status', 'pending'),
      ])

      setMachines(machinesRes.data || [])
      setActiveSessions(sessionsRes.data || [])
      setLogs(logsRes.data || [])
      setPendingQC(pendingRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleRequestStart = async (machineId: string) => {
    if (!companyId || !userId) return
    const existing = activeSessions.find(s => s.machine_id === machineId)
    if (existing) return alert('Bu makine zaten çalışıyor!')
    const existingPending = pendingQC.find(p => p.machine_id === machineId)
    if (existingPending) return alert('Bu makine için zaten KK onayı bekleniyor!')

    try {
      const { error } = await supabase.from('station_logs').insert({
        company_id: companyId,
        machine_id: machineId,
        action: 'pending_qc',
        qc_status: 'pending',
        started_by: userId,
      })
      if (error) throw error
      alert('✅ Kalite kontrol onayı talep edildi!')
      loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleQCApprove = async (logId: string, machineId: string) => {
    if (!companyId || !userId) return
    try {
      // Pending kaydını onayla ve start olarak güncelle
      const { error } = await supabase.from('station_logs')
        .update({
          action: 'start',
          qc_status: 'approved',
          qc_approved_by: userId,
          qc_approved_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
        })
        .eq('id', logId)
      if (error) throw error
      alert('✅ Onaylandı! Makine çalıştırıldı.')
      loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleQCRejectClick = (logId: string) => {
    setRejectingId(logId)
    setRejectReason('')
    setShowRejectModal(true)
  }

  const handleQCRejectConfirm = async () => {
    if (!rejectingId || !rejectReason.trim()) return alert('Red sebebi zorunludur!')
    try {
      const { error } = await supabase.from('station_logs')
        .update({
          qc_status: 'rejected',
          qc_approved_by: userId,
          qc_approved_at: new Date().toISOString(),
          qc_reject_reason: rejectReason.trim(),
        })
        .eq('id', rejectingId)
      if (error) throw error
      setShowRejectModal(false)
      setRejectingId(null)
      alert('Talep reddedildi.')
      loadData()
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

    const session = activeSessions.find(s => s.machine_id === stoppingMachineId)
    if (!session) return alert('Aktif oturum bulunamadı!')

    const now = new Date()
    const startedAt = new Date(session.started_at)
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

    try {
      const { error } = await supabase.from('station_logs')
        .update({
          action: 'stop',
          stopped_at: now.toISOString(),
          duration_seconds: durationSeconds,
          stop_reason: stopReason.trim(),
          stopped_by: userId,
        })
        .eq('id', session.id)

      if (error) throw error

      setShowStopModal(false)
      setStoppingMachineId(null)
      setStopReason('')
      loadData()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getElapsed = (startedAt: string) => {
    const start = new Date(startedAt).getTime()
    const now = Date.now()
    return Math.floor((now - start) / 1000)
  }

  const filteredMachines = machines.filter(m =>
    searchTerm === '' || m.machine_code.toLowerCase().includes(searchTerm.toLowerCase()) || m.machine_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const runningCount = activeSessions.length
  const pendingCount = pendingQC.length
  const stoppedCount = machines.length - runningCount - pendingCount

  // Log filtreleme
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

  const filteredLogs = logs.filter(l => {
    if (logFilter === 'today') return l.created_at >= todayStr
    if (logFilter === 'week') return l.created_at >= weekAgo
    return true
  })

  // Toplam çalışma süresi (bugün)
  const todayTotalSeconds = logs
    .filter(l => l.created_at >= todayStr && l.duration_seconds)
    .reduce((s, l) => s + (l.duration_seconds || 0), 0)

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
              İstasyon Takip Sistemi (İBS)
            </h2>
            <p className="text-gray-600">Makine çalışma ve duruş sürelerini takip edin</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-gray-800">
              {new Date().toLocaleTimeString('tr-TR')}
            </div>
            <div className="text-xs text-gray-500">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Çalışan</p>
            <p className="text-3xl font-bold text-green-600">{runningCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500">KK Onayı Bekleyen</p>
            <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-500">Duran</p>
            <p className="text-3xl font-bold text-gray-600">{stoppedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">Toplam</p>
            <p className="text-3xl font-bold text-blue-600">{machines.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500">Bugün Çalışma</p>
            <p className="text-3xl font-bold text-purple-600 font-mono">{formatDuration(todayTotalSeconds)}</p>
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
            const session = activeSessions.find(s => s.machine_id === machine.id)
            const isRunning = !!session
            const isPending = pendingQC.some(p => p.machine_id === machine.id)
            const pendingLog = pendingQC.find(p => p.machine_id === machine.id)
            const elapsed = session ? getElapsed(session.started_at) : 0
            const machineLogs = logs.filter(l => l.machine_id === machine.id).slice(0, 5)
            const isExpanded = expandedMachine === machine.id

            return (
              <div key={machine.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${isRunning ? 'border-green-400' : isPending ? 'border-yellow-400' : 'border-gray-200'}`}>
                {/* Makine Başlık */}
                <div className={`px-4 py-3 ${isRunning ? 'bg-green-50' : isPending ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{machine.machine_code}</h3>
                      <p className="text-xs text-gray-500 truncate">{machine.machine_name}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : isPending ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  </div>
                </div>

                {/* Timer */}
                <div className="px-4 py-4 text-center">
                  <div className={`text-3xl font-mono font-bold mb-2 ${isRunning ? 'text-green-600' : isPending ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {isRunning ? formatDuration(elapsed) : '00:00:00'}
                  </div>
                  <p className={`text-xs font-semibold ${isRunning ? 'text-green-600' : isPending ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {isRunning ? 'ÇALIŞIYOR' : isPending ? 'KK ONAYI BEKLENİYOR' : 'DURDU'}
                  </p>
                </div>

                {/* Butonlar */}
                <div className="px-4 pb-3 space-y-2">
                  {isRunning ? (
                    <button
                      onClick={() => handleStopClick(machine.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      <Square className="w-4 h-4" /> Durdur
                    </button>
                  ) : isPending ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleQCApprove(pendingLog!.id, machine.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        ✓ KK Onayla & Çalıştır
                      </button>
                      <button
                        onClick={() => handleQCRejectClick(pendingLog!.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold text-sm transition-colors"
                      >
                        ✕ Reddet
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRequestStart(machine.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      <Play className="w-4 h-4" /> KK Onayı Talep Et
                    </button>
                  )}
                </div>

                {/* Son Kayıtlar Toggle */}
                <div className="border-t">
                  <button
                    onClick={() => setExpandedMachine(isExpanded ? null : machine.id)}
                    className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-500 hover:bg-gray-50"
                  >
                    <span>Son kayıtlar ({machineLogs.length})</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                      {machineLogs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Kayıt yok</p>
                      ) : machineLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${log.action === 'start' && !log.stopped_at ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div className="flex-1 min-w-0">
                            {log.duration_seconds != null ? (
                              <>
                                <span className="font-semibold text-gray-800">{formatDuration(log.duration_seconds)}</span>
                                <span className="text-gray-400 ml-1">• {new Date(log.started_at).toLocaleDateString('tr-TR')} {new Date(log.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                {log.stop_reason && (
                                  <p className="text-red-500 mt-0.5 truncate" title={log.stop_reason}>
                                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />{log.stop_reason}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-green-600 font-semibold">Çalışıyor...</span>
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

        {/* Log Geçmişi */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-600" /> Duruş Kayıtları</h3>
              <p className="text-xs text-gray-500 mt-1">{filteredLogs.filter(l => l.stop_reason).length} duruş kaydı</p>
            </div>
            <div className="flex gap-2">
              {(['today', 'week', 'all'] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${logFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f === 'today' ? 'Bugün' : f === 'week' ? 'Bu Hafta' : 'Tümü'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Makine</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Başlangıç</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Bitiş</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Süre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Duruş Sebebi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.filter(l => l.stop_reason || l.action === 'start').slice(0, 50).map(log => {
                  const machine = machines.find(m => m.id === log.machine_id)
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{machine?.machine_code || '?'}</span>
                        <span className="text-xs text-gray-400 ml-1">{machine?.machine_name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.started_at ? `${new Date(log.started_at).toLocaleDateString('tr-TR')} ${new Date(log.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.stopped_at ? `${new Date(log.stopped_at).toLocaleDateString('tr-TR')} ${new Date(log.stopped_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {log.duration_seconds != null ? (
                          <span className="font-mono font-bold text-blue-700">{formatDuration(log.duration_seconds)}</span>
                        ) : log.action === 'start' && !log.stopped_at ? (
                          <span className="text-green-600 font-semibold text-sm">Devam ediyor</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {log.stopped_at ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Durduruldu</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Çalışıyor</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={log.stop_reason || ''}>
                        {log.stop_reason || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-gray-400">Henüz kayıt yok</div>
            )}
          </div>
        </div>

        {/* Durdurma Modalı */}
        {showStopModal && stoppingMachineId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowStopModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Makineyi Durdur</h3>
              <p className="text-sm text-gray-500 mb-4">
                {machines.find(m => m.id === stoppingMachineId)?.machine_code} — {machines.find(m => m.id === stoppingMachineId)?.machine_name}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Duruş Sebebi <span className="text-red-500">*</span></label>
                <textarea
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  rows={3}
                  placeholder="Duruş sebebini yazın... (Ör: Arıza, Bakım, Mola, Malzeme bekleme)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoFocus
                />
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
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <Square className="w-4 h-4" /> Durdur
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Red Modalı */}
        {showRejectModal && rejectingId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">KK Talebini Reddet</h3>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Red Sebebi <span className="text-red-500">*</span></label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                  placeholder="Red sebebini yazın..." autoFocus
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={handleQCRejectConfirm} disabled={!rejectReason.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-300">Reddet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

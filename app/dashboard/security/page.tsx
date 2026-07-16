'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Shield, UserPlus, Car, Package, LogIn, LogOut, Search, Plus, X,
  Clock, Users, IdCard, Printer, Trash2, ArrowLeft
} from 'lucide-react'

// =============================================================
// SABİTLER
// =============================================================
const VEHICLE_TYPES = ['Otomobil', 'Kamyonet', 'Kamyon', 'TIR', 'Minibüs', 'Motosiklet', 'Forklift', 'İş Makinesi', 'Diğer']
const VISIT_PURPOSES = ['İş Görüşmesi', 'Teslimat', 'Teslim Alma', 'Servis / Tamir', 'Denetim', 'Numune', 'Müşteri Ziyareti', 'Tedarikçi Ziyareti', 'Aday Görüşme', 'Diğer']
const VEHICLE_PURPOSES = ['Malzeme Teslim', 'Malzeme Alma', 'Personel Servisi', 'Yemek Servisi', 'Kargo', 'Ziyaret', 'Bakım / Servis', 'Diğer']
const COURIER_COMPANIES = ['Aras Kargo', 'Yurtiçi Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo', 'UPS', 'DHL', 'FedEx', 'HepsiJet', 'Kolay Gelsin', 'Trendyol Express', 'Diğer']
const PACKAGE_TYPES = ['Koli', 'Zarf / Evrak', 'Numune', 'Yedek Parça', 'Sarf Malzeme', 'Diğer']
const DEPARTMENTS = ['Üretim', 'Kalite', 'Depo', 'Satın Alma', 'Muhasebe', 'İK', 'Yönetim', 'IT', 'Güvenlik', 'Diğer']

// =============================================================
// TYPES
// =============================================================
type Visitor = {
  id: string
  first_name: string; last_name?: string | null
  tc_no?: string | null; passport_no?: string | null
  phone?: string | null
  visitor_company?: string | null
  visiting_person?: string | null; visiting_department?: string | null
  purpose?: string | null
  badge_no?: string | null
  entry_time: string; exit_time?: string | null
  kvkk_consent?: boolean
  status: 'inside' | 'left'
  notes?: string | null
}
type Vehicle = {
  id: string
  plate_number: string; vehicle_type?: string | null
  driver_name: string; driver_tc?: string | null; driver_phone?: string | null
  driver_company?: string | null
  purpose?: string | null; cargo_info?: string | null
  entry_km?: number | null; exit_km?: number | null
  entry_time: string; exit_time?: string | null
  status: 'inside' | 'left'
  notes?: string | null
}
type EmployeeLog = {
  id: string
  employee_id?: string | null; employee_name?: string | null; employee_tc?: string | null
  direction: 'in' | 'out'
  log_time: string
  method?: string | null
  notes?: string | null
}
type PackageLog = {
  id: string
  direction: 'in' | 'out'
  package_type?: string | null; courier_company?: string | null; tracking_no?: string | null
  sender?: string | null; receiver?: string | null; receiver_department?: string | null
  description?: string | null; quantity?: number | null; weight?: number | null
  received_by_name?: string | null
  log_time: string
  notes?: string | null
}

type TabKey = 'dashboard' | 'visitors' | 'vehicles' | 'employees' | 'packages'

// =============================================================
// HELPERS
// =============================================================
const fmtDateTime = (s?: string | null) => s ? new Date(s).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'
const fmtTime = (s?: string | null) => s ? new Date(s).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' }) : '-'
const isToday = (s?: string | null) => {
  if (!s) return false
  const d = new Date(s), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
const duration = (from?: string | null, to?: string | null) => {
  if (!from) return '-'
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  const mins = Math.max(0, Math.floor((end - start) / 60000))
  if (mins < 60) return `${mins} dk`
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}s ${m}dk`
}
const normPlate = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim()

// =============================================================
// PAGE
// =============================================================
export default function SecurityPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('dashboard')

  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [empLogs, setEmpLogs] = useState<EmployeeLog[]>([])
  const [packages, setPackages] = useState<PackageLog[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [visitorSearch, setVisitorSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [pkgSearch, setPkgSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today')

  const [showVisitorModal, setShowVisitorModal] = useState(false)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [showPkgModal, setShowPkgModal] = useState(false)

  useEffect(() => { init() }, [])

  const init = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) { setLoading(false); return }
    setCompanyId(profile.company_id)
    await Promise.all([
      loadVisitors(profile.company_id),
      loadVehicles(profile.company_id),
      loadEmpLogs(profile.company_id),
      loadPackages(profile.company_id),
      loadEmployees(profile.company_id),
    ])
    setLoading(false)
  }

  const loadVisitors = async (cid: string) => {
    const { data } = await supabase.from('security_visitors').select('*').eq('company_id', cid).order('entry_time', { ascending: false }).limit(500)
    setVisitors(data || [])
  }
  const loadVehicles = async (cid: string) => {
    const { data } = await supabase.from('security_vehicles').select('*').eq('company_id', cid).order('entry_time', { ascending: false }).limit(500)
    setVehicles(data || [])
  }
  const loadEmpLogs = async (cid: string) => {
    const { data } = await supabase.from('security_employee_logs').select('*').eq('company_id', cid).order('log_time', { ascending: false }).limit(500)
    setEmpLogs(data || [])
  }
  const loadPackages = async (cid: string) => {
    const { data } = await supabase.from('security_packages').select('*').eq('company_id', cid).order('log_time', { ascending: false }).limit(500)
    setPackages(data || [])
  }
  const loadEmployees = async (cid: string) => {
    const { data } = await supabase.from('employees').select('id, first_name, last_name, national_id, department').eq('company_id', cid).order('first_name')
    setEmployees(data || [])
  }

  // =============================================================
  // FİLTRELER
  // =============================================================
  const withinDateFilter = (dateStr: string) => {
    if (dateFilter === 'all') return true
    const d = new Date(dateStr); const n = new Date()
    if (dateFilter === 'today') return isToday(dateStr)
    const diff = (n.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    if (dateFilter === 'week') return diff <= 7
    if (dateFilter === 'month') return diff <= 31
    return true
  }

  const filteredVisitors = useMemo(() => visitors.filter(v => {
    if (!withinDateFilter(v.entry_time)) return false
    if (!visitorSearch) return true
    const q = visitorSearch.toLowerCase()
    return [v.first_name, v.last_name, v.tc_no, v.phone, v.visitor_company, v.visiting_person, v.badge_no]
      .some(x => (x || '').toLowerCase().includes(q))
  }), [visitors, visitorSearch, dateFilter])

  const filteredVehicles = useMemo(() => vehicles.filter(v => {
    if (!withinDateFilter(v.entry_time)) return false
    if (!vehicleSearch) return true
    const q = vehicleSearch.toLowerCase()
    return [v.plate_number, v.driver_name, v.driver_company, v.vehicle_type]
      .some(x => (x || '').toLowerCase().includes(q))
  }), [vehicles, vehicleSearch, dateFilter])

  const filteredEmpLogs = useMemo(() => empLogs.filter(l => {
    if (!withinDateFilter(l.log_time)) return false
    if (!empSearch) return true
    const q = empSearch.toLowerCase()
    return [l.employee_name, l.employee_tc].some(x => (x || '').toLowerCase().includes(q))
  }), [empLogs, empSearch, dateFilter])

  const filteredPackages = useMemo(() => packages.filter(p => {
    if (!withinDateFilter(p.log_time)) return false
    if (!pkgSearch) return true
    const q = pkgSearch.toLowerCase()
    return [p.tracking_no, p.sender, p.receiver, p.courier_company, p.description]
      .some(x => (x || '').toLowerCase().includes(q))
  }), [packages, pkgSearch, dateFilter])

  // =============================================================
  // ÇIKIŞ İŞLEMLERİ
  // =============================================================
  const exitVisitor = async (v: Visitor) => {
    if (!companyId) return
    if (!confirm(`${v.first_name} ${v.last_name || ''} çıkış yapsın mı?`)) return
    const { error } = await supabase.from('security_visitors').update({
      exit_time: new Date().toISOString(), exit_by: userId, status: 'left', updated_at: new Date().toISOString()
    }).eq('id', v.id)
    if (error) return alert('Hata: ' + error.message)
    await loadVisitors(companyId)
  }

  const exitVehicle = async (v: Vehicle) => {
    if (!companyId) return
    const km = prompt(`${v.plate_number} çıkış KM (opsiyonel):`, '')
    const { error } = await supabase.from('security_vehicles').update({
      exit_time: new Date().toISOString(), exit_by: userId, status: 'left',
      exit_km: km ? parseFloat(km) : null
    }).eq('id', v.id)
    if (error) return alert('Hata: ' + error.message)
    await loadVehicles(companyId)
  }

  const deleteRecord = async (table: string, id: string, reloader: () => Promise<void>) => {
    if (!confirm('Bu kaydı silmek istediğine emin misin?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return alert('Hata: ' + error.message)
    await reloader()
  }

  // =============================================================
  // İSTATİSTİKLER
  // =============================================================
  const stats = useMemo(() => {
    const insideVisitors = visitors.filter(v => v.status === 'inside').length
    const insideVehicles = vehicles.filter(v => v.status === 'inside').length
    const todayVisitorEntries = visitors.filter(v => isToday(v.entry_time)).length
    const todayVisitorExits = visitors.filter(v => v.exit_time && isToday(v.exit_time)).length
    const todayVehicleEntries = vehicles.filter(v => isToday(v.entry_time)).length
    const todayVehicleExits = vehicles.filter(v => v.exit_time && isToday(v.exit_time)).length
    const todayEmpIn = empLogs.filter(l => l.direction === 'in' && isToday(l.log_time)).length
    const todayEmpOut = empLogs.filter(l => l.direction === 'out' && isToday(l.log_time)).length
    const todayPkgIn = packages.filter(p => p.direction === 'in' && isToday(p.log_time)).length
    const todayPkgOut = packages.filter(p => p.direction === 'out' && isToday(p.log_time)).length
    return { insideVisitors, insideVehicles, todayVisitorEntries, todayVisitorExits, todayVehicleEntries, todayVehicleExits, todayEmpIn, todayEmpOut, todayPkgIn, todayPkgOut }
  }, [visitors, vehicles, empLogs, packages])

  const insideVisitorsList = useMemo(() => visitors.filter(v => v.status === 'inside'), [visitors])
  const insideVehiclesList = useMemo(() => vehicles.filter(v => v.status === 'inside'), [vehicles])

  if (loading) return <div className="p-8"><div className="text-gray-600">Yükleniyor...</div></div>

  // =============================================================
  // RENDER
  // =============================================================
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center shadow">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Güvenlik</h1>
            <p className="text-sm text-gray-500">Ziyaretçi, araç, personel giriş-çıkış ve kargo takibi</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border p-1">
          {(['today','week','month','all'] as const).map(k => (
            <button key={k} onClick={() => setDateFilter(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${dateFilter === k ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {k === 'today' ? 'Bugün' : k === 'week' ? 'Son 7 Gün' : k === 'month' ? 'Son 30 Gün' : 'Tümü'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <div className="flex min-w-max">
          {([
            { k: 'dashboard', label: 'Dashboard', icon: Shield },
            { k: 'visitors', label: `Ziyaretçiler (${stats.insideVisitors} içeride)`, icon: Users },
            { k: 'vehicles', label: `Araçlar (${stats.insideVehicles} içeride)`, icon: Car },
            { k: 'employees', label: 'Personel Giriş-Çıkış', icon: IdCard },
            { k: 'packages', label: 'Kargo & Paket', icon: Package },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t.k ? 'border-slate-800 text-slate-800 bg-slate-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {/* İstatistik Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard color="emerald" label="Şu An İçeride (Ziyaretçi)" value={stats.insideVisitors} icon={Users} />
            <StatCard color="blue" label="Şu An İçeride (Araç)" value={stats.insideVehicles} icon={Car} />
            <StatCard color="indigo" label="Bugün Giriş / Çıkış (Ziyaretçi)" value={`${stats.todayVisitorEntries} / ${stats.todayVisitorExits}`} icon={LogIn} />
            <StatCard color="cyan" label="Bugün Giriş / Çıkış (Araç)" value={`${stats.todayVehicleEntries} / ${stats.todayVehicleExits}`} icon={LogIn} />
            <StatCard color="purple" label="Bugün Kargo (Gelen / Giden)" value={`${stats.todayPkgIn} / ${stats.todayPkgOut}`} icon={Package} />
          </div>

          {/* Şu an içeride — Ziyaretçi listesi */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-emerald-900 flex items-center gap-2"><Users className="w-4 h-4"/> Şu An İçerideki Ziyaretçiler ({insideVisitorsList.length})</h3>
              <button onClick={() => setShowVisitorModal(true)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-semibold flex items-center gap-1"><UserPlus className="w-3 h-3"/> Yeni Ziyaretçi</button>
            </div>
            {insideVisitorsList.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">Şu an içeride ziyaretçi yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">İsim</th>
                      <th className="px-3 py-2 text-left">Firma</th>
                      <th className="px-3 py-2 text-left">Ziyaret Ettiği</th>
                      <th className="px-3 py-2 text-left">Amaç</th>
                      <th className="px-3 py-2 text-left">Yaka Kartı</th>
                      <th className="px-3 py-2 text-left">Giriş</th>
                      <th className="px-3 py-2 text-left">Süre</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {insideVisitorsList.map(v => (
                      <tr key={v.id} className="hover:bg-emerald-50/40">
                        <td className="px-3 py-2 font-semibold text-gray-800">{v.first_name} {v.last_name || ''}</td>
                        <td className="px-3 py-2 text-gray-600">{v.visitor_company || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{v.visiting_person || '-'} {v.visiting_department ? <span className="text-xs text-gray-400">({v.visiting_department})</span> : ''}</td>
                        <td className="px-3 py-2 text-gray-600">{v.purpose || '-'}</td>
                        <td className="px-3 py-2 font-mono text-blue-700">{v.badge_no || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtTime(v.entry_time)}</td>
                        <td className="px-3 py-2 text-gray-600">{duration(v.entry_time, null)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => exitVisitor(v)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1 ml-auto">
                            <LogOut className="w-3 h-3"/> Çıkış
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Şu an içeride — Araç listesi */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-blue-50">
              <h3 className="font-bold text-blue-900 flex items-center gap-2"><Car className="w-4 h-4"/> Şu An İçerideki Araçlar ({insideVehiclesList.length})</h3>
              <button onClick={() => setShowVehicleModal(true)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-semibold flex items-center gap-1"><Plus className="w-3 h-3"/> Yeni Araç Girişi</button>
            </div>
            {insideVehiclesList.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">Şu an içeride araç yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Plaka</th>
                      <th className="px-3 py-2 text-left">Tip</th>
                      <th className="px-3 py-2 text-left">Sürücü</th>
                      <th className="px-3 py-2 text-left">Firma</th>
                      <th className="px-3 py-2 text-left">Amaç</th>
                      <th className="px-3 py-2 text-left">Kargo Bilgisi</th>
                      <th className="px-3 py-2 text-left">Giriş KM</th>
                      <th className="px-3 py-2 text-left">Giriş</th>
                      <th className="px-3 py-2 text-left">Süre</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {insideVehiclesList.map(v => (
                      <tr key={v.id} className="hover:bg-blue-50/40">
                        <td className="px-3 py-2 font-bold font-mono text-blue-800">{v.plate_number}</td>
                        <td className="px-3 py-2 text-gray-600">{v.vehicle_type || '-'}</td>
                        <td className="px-3 py-2 text-gray-800">{v.driver_name}</td>
                        <td className="px-3 py-2 text-gray-600">{v.driver_company || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{v.purpose || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={v.cargo_info || ''}>{v.cargo_info || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{v.entry_km ?? '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtTime(v.entry_time)}</td>
                        <td className="px-3 py-2 text-gray-600">{duration(v.entry_time, null)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => exitVehicle(v)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1 ml-auto">
                            <LogOut className="w-3 h-3"/> Çıkış
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bugünkü personel hareket özeti */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><IdCard className="w-4 h-4"/> Bugün Personel Hareketi</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-700 font-semibold">Giriş</p>
                  <p className="text-2xl font-bold text-emerald-900">{stats.todayEmpIn}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3">
                  <p className="text-xs text-rose-700 font-semibold">Çıkış</p>
                  <p className="text-2xl font-bold text-rose-900">{stats.todayEmpOut}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Package className="w-4 h-4"/> Bugün Kargo Hareketi</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-xs text-indigo-700 font-semibold">Gelen</p>
                  <p className="text-2xl font-bold text-indigo-900">{stats.todayPkgIn}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700 font-semibold">Giden</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.todayPkgOut}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZİYARETÇİ TAB */}
      {tab === 'visitors' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={visitorSearch} onChange={e => setVisitorSearch(e.target.value)}
                  placeholder="İsim, TC, firma, telefon, yaka kartı ara..."
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full"/>
              </div>
            </div>
            <button onClick={() => setShowVisitorModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4"/> Yeni Ziyaretçi Girişi
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Durum</th>
                  <th className="px-3 py-2 text-left">İsim</th>
                  <th className="px-3 py-2 text-left">TC / Pasaport</th>
                  <th className="px-3 py-2 text-left">Telefon</th>
                  <th className="px-3 py-2 text-left">Firma</th>
                  <th className="px-3 py-2 text-left">Ziyaret Ettiği</th>
                  <th className="px-3 py-2 text-left">Amaç</th>
                  <th className="px-3 py-2 text-left">Yaka</th>
                  <th className="px-3 py-2 text-left">KVKK</th>
                  <th className="px-3 py-2 text-left">Giriş</th>
                  <th className="px-3 py-2 text-left">Çıkış</th>
                  <th className="px-3 py-2 text-left">Süre</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVisitors.length === 0 ? (
                  <tr><td colSpan={13} className="p-8 text-center text-gray-400">Kayıt bulunamadı</td></tr>
                ) : filteredVisitors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {v.status === 'inside'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">İÇERİDE</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">ÇIKTI</span>}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{v.first_name} {v.last_name || ''}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{v.tc_no || v.passport_no || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.phone || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.visitor_company || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.visiting_person || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.purpose || '-'}</td>
                    <td className="px-3 py-2 font-mono text-blue-700">{v.badge_no || '-'}</td>
                    <td className="px-3 py-2">{v.kvkk_consent ? <span className="text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(v.entry_time)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(v.exit_time)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{duration(v.entry_time, v.exit_time)}</td>
                    <td className="px-3 py-2 text-right flex items-center gap-1 justify-end">
                      {v.status === 'inside' && (
                        <button onClick={() => exitVisitor(v)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-2 py-1 rounded font-semibold">Çıkış</button>
                      )}
                      <button onClick={() => deleteRecord('security_visitors', v.id, () => loadVisitors(companyId!))} className="text-gray-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ARAÇ TAB */}
      {tab === 'vehicles' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)}
                  placeholder="Plaka, sürücü, firma, tip ara..."
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full"/>
              </div>
            </div>
            <button onClick={() => setShowVehicleModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4"/> Yeni Araç Girişi
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Durum</th>
                  <th className="px-3 py-2 text-left">Plaka</th>
                  <th className="px-3 py-2 text-left">Tip</th>
                  <th className="px-3 py-2 text-left">Sürücü</th>
                  <th className="px-3 py-2 text-left">TC</th>
                  <th className="px-3 py-2 text-left">Firma</th>
                  <th className="px-3 py-2 text-left">Amaç</th>
                  <th className="px-3 py-2 text-left">Kargo</th>
                  <th className="px-3 py-2 text-left">Giriş / Çıkış KM</th>
                  <th className="px-3 py-2 text-left">Giriş</th>
                  <th className="px-3 py-2 text-left">Çıkış</th>
                  <th className="px-3 py-2 text-left">Süre</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVehicles.length === 0 ? (
                  <tr><td colSpan={13} className="p-8 text-center text-gray-400">Kayıt bulunamadı</td></tr>
                ) : filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {v.status === 'inside'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">İÇERİDE</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">ÇIKTI</span>}
                    </td>
                    <td className="px-3 py-2 font-bold font-mono text-blue-800">{v.plate_number}</td>
                    <td className="px-3 py-2 text-gray-600">{v.vehicle_type || '-'}</td>
                    <td className="px-3 py-2 text-gray-800">{v.driver_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{v.driver_tc || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.driver_company || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.purpose || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate" title={v.cargo_info || ''}>{v.cargo_info || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{v.entry_km ?? '-'} / {v.exit_km ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(v.entry_time)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(v.exit_time)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{duration(v.entry_time, v.exit_time)}</td>
                    <td className="px-3 py-2 text-right flex items-center gap-1 justify-end">
                      {v.status === 'inside' && (
                        <button onClick={() => exitVehicle(v)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-2 py-1 rounded font-semibold">Çıkış</button>
                      )}
                      <button onClick={() => deleteRecord('security_vehicles', v.id, () => loadVehicles(companyId!))} className="text-gray-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERSONEL TAB */}
      {tab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Personel isim veya TC ara..."
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full"/>
              </div>
            </div>
            <button onClick={() => setShowEmpModal(true)} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4"/> Personel Giriş / Çıkış Kaydı
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Yön</th>
                  <th className="px-3 py-2 text-left">Personel</th>
                  <th className="px-3 py-2 text-left">TC</th>
                  <th className="px-3 py-2 text-left">Yöntem</th>
                  <th className="px-3 py-2 text-left">Zaman</th>
                  <th className="px-3 py-2 text-left">Not</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmpLogs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Kayıt bulunamadı</td></tr>
                ) : filteredEmpLogs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {l.direction === 'in'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit"><LogIn className="w-3 h-3"/> GİRİŞ</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 flex items-center gap-1 w-fit"><LogOut className="w-3 h-3"/> ÇIKIŞ</span>}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{l.employee_name || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{l.employee_tc || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{l.method || 'manual'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(l.log_time)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs max-w-[220px] truncate" title={l.notes || ''}>{l.notes || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteRecord('security_employee_logs', l.id, () => loadEmpLogs(companyId!))} className="text-gray-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KARGO TAB */}
      {tab === 'packages' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={pkgSearch} onChange={e => setPkgSearch(e.target.value)}
                  placeholder="Takip no, gönderen, alıcı, kargo firması ara..."
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full"/>
              </div>
            </div>
            <button onClick={() => setShowPkgModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4"/> Kargo Kaydı Ekle
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Yön</th>
                  <th className="px-3 py-2 text-left">Tip</th>
                  <th className="px-3 py-2 text-left">Kargo Firması</th>
                  <th className="px-3 py-2 text-left">Takip No</th>
                  <th className="px-3 py-2 text-left">Gönderen</th>
                  <th className="px-3 py-2 text-left">Alıcı</th>
                  <th className="px-3 py-2 text-left">Departman</th>
                  <th className="px-3 py-2 text-left">Adet / Kg</th>
                  <th className="px-3 py-2 text-left">Açıklama</th>
                  <th className="px-3 py-2 text-left">Teslim Alan</th>
                  <th className="px-3 py-2 text-left">Zaman</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPackages.length === 0 ? (
                  <tr><td colSpan={12} className="p-8 text-center text-gray-400">Kayıt bulunamadı</td></tr>
                ) : filteredPackages.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {p.direction === 'in'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">GELEN</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">GİDEN</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.package_type || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.courier_company || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{p.tracking_no || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.sender || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.receiver || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.receiver_department || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{p.quantity ?? '-'} / {p.weight ? `${p.weight} kg` : '-'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={p.description || ''}>{p.description || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.received_by_name || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtDateTime(p.log_time)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteRecord('security_packages', p.id, () => loadPackages(companyId!))} className="text-gray-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showVisitorModal && companyId && (
        <VisitorModal companyId={companyId} userId={userId} onClose={() => setShowVisitorModal(false)} onSaved={async () => { await loadVisitors(companyId); setShowVisitorModal(false) }} />
      )}
      {showVehicleModal && companyId && (
        <VehicleModal companyId={companyId} userId={userId} onClose={() => setShowVehicleModal(false)} onSaved={async () => { await loadVehicles(companyId); setShowVehicleModal(false) }} />
      )}
      {showEmpModal && companyId && (
        <EmployeeLogModal companyId={companyId} userId={userId} employees={employees} onClose={() => setShowEmpModal(false)} onSaved={async () => { await loadEmpLogs(companyId); setShowEmpModal(false) }} />
      )}
      {showPkgModal && companyId && (
        <PackageModal companyId={companyId} userId={userId} onClose={() => setShowPkgModal(false)} onSaved={async () => { await loadPackages(companyId); setShowPkgModal(false) }} />
      )}
    </div>
  )
}

// =============================================================
// COMPONENTS
// =============================================================
function StatCard({ color, label, value, icon: Icon }: { color: string, label: string, value: string | number, icon: any }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-700',
    blue: 'from-blue-500 to-blue-700',
    indigo: 'from-indigo-500 to-indigo-700',
    cyan: 'from-cyan-500 to-cyan-700',
    purple: 'from-purple-500 to-purple-700',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 shadow text-white`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold opacity-90">{label}</p>
        <Icon className="w-5 h-5 opacity-80" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

// =============================================================
// VISITOR MODAL
// =============================================================
function VisitorModal({ companyId, userId, onClose, onSaved }: { companyId: string, userId: string | null, onClose: () => void, onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', tc_no: '', passport_no: '', phone: '',
    visitor_company: '', visiting_person: '', visiting_department: '',
    purpose: '', badge_no: '', kvkk_consent: false, notes: ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.first_name.trim()) return alert('Ad zorunlu!')
    setSaving(true)
    const { error } = await supabase.from('security_visitors').insert({
      company_id: companyId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      tc_no: form.tc_no.trim() || null,
      passport_no: form.passport_no.trim() || null,
      phone: form.phone.trim() || null,
      visitor_company: form.visitor_company.trim() || null,
      visiting_person: form.visiting_person.trim() || null,
      visiting_department: form.visiting_department || null,
      purpose: form.purpose || null,
      badge_no: form.badge_no.trim() || null,
      kvkk_consent: form.kvkk_consent,
      notes: form.notes.trim() || null,
      entry_by: userId,
      entry_time: new Date().toISOString(),
      status: 'inside'
    })
    setSaving(false)
    if (error) return alert('Hata: ' + error.message)
    await onSaved()
  }

  return (
    <ModalShell title="Yeni Ziyaretçi Girişi" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad *"><input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className={inputCls} autoFocus/></Field>
        <Field label="Soyad"><input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className={inputCls}/></Field>
        <Field label="TC Kimlik No"><input value={form.tc_no} onChange={e => setForm({...form, tc_no: e.target.value.replace(/\D/g,'').slice(0,11)})} className={inputCls} placeholder="11 haneli"/></Field>
        <Field label="Pasaport No (yabancıysa)"><input value={form.passport_no} onChange={e => setForm({...form, passport_no: e.target.value})} className={inputCls}/></Field>
        <Field label="Telefon"><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputCls} placeholder="05xx xxx xx xx"/></Field>
        <Field label="Firma"><input value={form.visitor_company} onChange={e => setForm({...form, visitor_company: e.target.value})} className={inputCls}/></Field>
        <Field label="Ziyaret Ettiği Kişi"><input value={form.visiting_person} onChange={e => setForm({...form, visiting_person: e.target.value})} className={inputCls}/></Field>
        <Field label="Departman">
          <select value={form.visiting_department} onChange={e => setForm({...form, visiting_department: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Ziyaret Amacı">
          <select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Yaka Kartı No"><input value={form.badge_no} onChange={e => setForm({...form, badge_no: e.target.value})} className={inputCls} placeholder="Örn: 042"/></Field>
        <div className="col-span-2">
          <Field label="Not"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className={inputCls}/></Field>
        </div>
        <div className="col-span-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <input type="checkbox" checked={form.kvkk_consent} onChange={e => setForm({...form, kvkk_consent: e.target.checked})} className="w-4 h-4"/>
          <label className="text-xs text-amber-900">KVKK aydınlatma metnini okudum, kişisel verilerimin ziyaret süresince işlenmesine onay veriyorum.</label>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50">İptal</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-semibold">
          {saving ? 'Kaydediliyor...' : 'Girişi Kaydet'}
        </button>
      </div>
    </ModalShell>
  )
}

// =============================================================
// VEHICLE MODAL
// =============================================================
function VehicleModal({ companyId, userId, onClose, onSaved }: { companyId: string, userId: string | null, onClose: () => void, onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    plate_number: '', vehicle_type: '', driver_name: '', driver_tc: '',
    driver_phone: '', driver_company: '', purpose: '', cargo_info: '',
    entry_km: '', notes: ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.plate_number.trim()) return alert('Plaka zorunlu!')
    if (!form.driver_name.trim()) return alert('Sürücü adı zorunlu!')
    setSaving(true)
    const { error } = await supabase.from('security_vehicles').insert({
      company_id: companyId,
      plate_number: normPlate(form.plate_number),
      vehicle_type: form.vehicle_type || null,
      driver_name: form.driver_name.trim(),
      driver_tc: form.driver_tc.trim() || null,
      driver_phone: form.driver_phone.trim() || null,
      driver_company: form.driver_company.trim() || null,
      purpose: form.purpose || null,
      cargo_info: form.cargo_info.trim() || null,
      entry_km: form.entry_km ? parseFloat(form.entry_km) : null,
      notes: form.notes.trim() || null,
      entry_by: userId,
      entry_time: new Date().toISOString(),
      status: 'inside'
    })
    setSaving(false)
    if (error) return alert('Hata: ' + error.message)
    await onSaved()
  }

  return (
    <ModalShell title="Yeni Araç Girişi" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plaka *"><input value={form.plate_number} onChange={e => setForm({...form, plate_number: e.target.value.toUpperCase()})} className={inputCls + ' font-mono font-bold'} placeholder="34 ABC 123" autoFocus/></Field>
        <Field label="Araç Tipi">
          <select value={form.vehicle_type} onChange={e => setForm({...form, vehicle_type: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Sürücü Adı *"><input value={form.driver_name} onChange={e => setForm({...form, driver_name: e.target.value})} className={inputCls}/></Field>
        <Field label="Sürücü TC"><input value={form.driver_tc} onChange={e => setForm({...form, driver_tc: e.target.value.replace(/\D/g,'').slice(0,11)})} className={inputCls}/></Field>
        <Field label="Sürücü Telefon"><input value={form.driver_phone} onChange={e => setForm({...form, driver_phone: e.target.value})} className={inputCls}/></Field>
        <Field label="Firma"><input value={form.driver_company} onChange={e => setForm({...form, driver_company: e.target.value})} className={inputCls}/></Field>
        <Field label="Amaç">
          <select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {VEHICLE_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Giriş KM"><input type="number" step="0.1" value={form.entry_km} onChange={e => setForm({...form, entry_km: e.target.value})} className={inputCls} placeholder="Opsiyonel"/></Field>
        <div className="col-span-2">
          <Field label="Kargo / Malzeme Bilgisi"><textarea value={form.cargo_info} onChange={e => setForm({...form, cargo_info: e.target.value})} rows={2} className={inputCls} placeholder="Ne getiriyor / götürüyor..."/></Field>
        </div>
        <div className="col-span-2">
          <Field label="Not"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className={inputCls}/></Field>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50">İptal</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold">
          {saving ? 'Kaydediliyor...' : 'Girişi Kaydet'}
        </button>
      </div>
    </ModalShell>
  )
}

// =============================================================
// EMPLOYEE LOG MODAL
// =============================================================
function EmployeeLogModal({ companyId, userId, employees, onClose, onSaved }: { companyId: string, userId: string | null, employees: any[], onClose: () => void, onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    employee_id: '', employee_name: '', employee_tc: '',
    direction: 'in' as 'in' | 'out', method: 'manual', notes: ''
  })
  const [saving, setSaving] = useState(false)

  const onSelectEmployee = (id: string) => {
    const e = employees.find(x => x.id === id)
    if (e) {
      setForm({ ...form, employee_id: id, employee_name: `${e.first_name} ${e.last_name || ''}`.trim(), employee_tc: e.national_id || '' })
    } else {
      setForm({ ...form, employee_id: '' })
    }
  }

  const save = async () => {
    if (!form.employee_name.trim()) return alert('Personel adı zorunlu!')
    setSaving(true)
    const { error } = await supabase.from('security_employee_logs').insert({
      company_id: companyId,
      employee_id: form.employee_id || null,
      employee_name: form.employee_name.trim(),
      employee_tc: form.employee_tc.trim() || null,
      direction: form.direction,
      method: form.method,
      notes: form.notes.trim() || null,
      logged_by: userId,
      log_time: new Date().toISOString()
    })
    setSaving(false)
    if (error) return alert('Hata: ' + error.message)
    await onSaved()
  }

  return (
    <ModalShell title="Personel Giriş / Çıkış Kaydı" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-2">
          <button onClick={() => setForm({...form, direction: 'in'})}
            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${form.direction === 'in' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <LogIn className="w-4 h-4"/> GİRİŞ
          </button>
          <button onClick={() => setForm({...form, direction: 'out'})}
            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${form.direction === 'out' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <LogOut className="w-4 h-4"/> ÇIKIŞ
          </button>
        </div>
        <div className="col-span-2">
          <Field label="Personel Seç (kayıtlıysa)">
            <select value={form.employee_id} onChange={e => onSelectEmployee(e.target.value)} className={inputCls}>
              <option value="">— Liste dışı manuel gir —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name || ''} {e.department ? `(${e.department})` : ''}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Ad Soyad *"><input value={form.employee_name} onChange={e => setForm({...form, employee_name: e.target.value})} className={inputCls}/></Field>
        <Field label="TC"><input value={form.employee_tc} onChange={e => setForm({...form, employee_tc: e.target.value.replace(/\D/g,'').slice(0,11)})} className={inputCls}/></Field>
        <Field label="Yöntem">
          <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className={inputCls}>
            <option value="manual">Manuel</option>
            <option value="card">Kart</option>
            <option value="biometric">Biyometrik</option>
            <option value="other">Diğer</option>
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Not"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className={inputCls}/></Field>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50">İptal</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 text-white rounded-lg font-semibold">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </ModalShell>
  )
}

// =============================================================
// PACKAGE MODAL
// =============================================================
function PackageModal({ companyId, userId, onClose, onSaved }: { companyId: string, userId: string | null, onClose: () => void, onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    direction: 'in' as 'in' | 'out',
    package_type: '', courier_company: '', tracking_no: '',
    sender: '', receiver: '', receiver_department: '',
    description: '', quantity: '1', weight: '',
    received_by_name: '', notes: ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('security_packages').insert({
      company_id: companyId,
      direction: form.direction,
      package_type: form.package_type || null,
      courier_company: form.courier_company || null,
      tracking_no: form.tracking_no.trim() || null,
      sender: form.sender.trim() || null,
      receiver: form.receiver.trim() || null,
      receiver_department: form.receiver_department || null,
      description: form.description.trim() || null,
      quantity: form.quantity ? parseInt(form.quantity, 10) : 1,
      weight: form.weight ? parseFloat(form.weight) : null,
      received_by: userId,
      received_by_name: form.received_by_name.trim() || null,
      log_time: new Date().toISOString(),
      notes: form.notes.trim() || null
    })
    setSaving(false)
    if (error) return alert('Hata: ' + error.message)
    await onSaved()
  }

  return (
    <ModalShell title="Kargo / Paket Kaydı" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-2">
          <button onClick={() => setForm({...form, direction: 'in'})}
            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${form.direction === 'in' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            GELEN
          </button>
          <button onClick={() => setForm({...form, direction: 'out'})}
            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${form.direction === 'out' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            GİDEN
          </button>
        </div>
        <Field label="Paket Tipi">
          <select value={form.package_type} onChange={e => setForm({...form, package_type: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {PACKAGE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Kargo Firması">
          <select value={form.courier_company} onChange={e => setForm({...form, courier_company: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {COURIER_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Takip No"><input value={form.tracking_no} onChange={e => setForm({...form, tracking_no: e.target.value})} className={inputCls + ' font-mono'}/></Field>
        <Field label="Adet"><input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className={inputCls}/></Field>
        <Field label="Ağırlık (kg)"><input type="number" step="0.01" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className={inputCls}/></Field>
        <Field label="Gönderen"><input value={form.sender} onChange={e => setForm({...form, sender: e.target.value})} className={inputCls}/></Field>
        <Field label="Alıcı"><input value={form.receiver} onChange={e => setForm({...form, receiver: e.target.value})} className={inputCls}/></Field>
        <Field label="Alıcı Departman">
          <select value={form.receiver_department} onChange={e => setForm({...form, receiver_department: e.target.value})} className={inputCls}>
            <option value="">Seçiniz...</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Teslim Alan"><input value={form.received_by_name} onChange={e => setForm({...form, received_by_name: e.target.value})} className={inputCls} placeholder="Güvenlikte teslim alan"/></Field>
        <div className="col-span-2">
          <Field label="Açıklama"><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className={inputCls} placeholder="İçerik / açıklama"/></Field>
        </div>
        <div className="col-span-2">
          <Field label="Not"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className={inputCls}/></Field>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50">İptal</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg font-semibold">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </ModalShell>
  )
}

// =============================================================
// SHARED UI
// =============================================================
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-slate-500 focus:border-transparent'

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600"/></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

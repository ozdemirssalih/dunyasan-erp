'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users, Cake, Calendar, DollarSign, TrendingUp, Briefcase,
  UserCheck, UserX, Clock, Wallet, ArrowRight, AlertCircle
} from 'lucide-react'

interface Employee {
  id: string
  full_name: string
  employee_code: string
  department?: string
  position?: string
  hire_date?: string
  birth_date?: string
  salary?: number
  status: string
  phone?: string
}

interface LeaveRecord {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  status: string
  employee?: { full_name: string }
}

interface AdvanceRecord {
  id: string
  employee_id: string
  amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  advance_date: string
  employee?: { full_name: string }
}

interface SalaryPayment {
  id: string
  employee_id: string
  net_amount: number
  payment_date: string
  period_month: number
  period_year: number
  employee?: { full_name: string }
}

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

export default function HRDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [advances, setAdvances] = useState<AdvanceRecord[]>([])
  const [payments, setPayments] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      const cId = profile.company_id

      const [empRes, leaveRes, advRes, payRes] = await Promise.all([
        supabase.from('employees').select('*').eq('company_id', cId).order('full_name'),
        supabase.from('employee_leaves').select('*, employee:employees(full_name)').eq('company_id', cId).order('start_date', { ascending: false }).limit(50),
        supabase.from('salary_advances').select('*, employee:employees(full_name)').eq('company_id', cId).order('advance_date', { ascending: false }).limit(50),
        supabase.from('salary_payments').select('*, employee:employees(full_name)').eq('company_id', cId).order('payment_date', { ascending: false }).limit(50)
      ])

      setEmployees(empRes.data || [])
      setLeaves(leaveRes.data || [])
      setAdvances(advRes.data || [])
      setPayments(payRes.data || [])
    } catch (e) {
      console.error('HR Dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const activeEmployees = employees.filter(e => e.status === 'active')
  const inactiveEmployees = employees.filter(e => e.status !== 'active')

  // Departman dağılımı
  const departmentStats = activeEmployees.reduce((acc, e) => {
    const dep = e.department || 'Belirsiz'
    acc[dep] = (acc[dep] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Bu ay doğum günü olanlar
  const birthdaysThisMonth = activeEmployees
    .filter(e => {
      if (!e.birth_date) return false
      return new Date(e.birth_date).getMonth() === currentMonth
    })
    .sort((a, b) => new Date(a.birth_date!).getDate() - new Date(b.birth_date!).getDate())

  // Bu hafta doğum günü
  const birthdaysThisWeek = birthdaysThisMonth.filter(e => {
    const d = new Date(e.birth_date!).getDate()
    const todayDay = today.getDate()
    return d >= todayDay && d <= todayDay + 7
  })

  // Yaş ortalaması
  const avgAge = (() => {
    const ages = activeEmployees
      .filter(e => e.birth_date)
      .map(e => {
        const birth = new Date(e.birth_date!)
        const diff = today.getTime() - birth.getTime()
        return diff / (1000 * 60 * 60 * 24 * 365.25)
      })
    if (ages.length === 0) return 0
    return ages.reduce((s, a) => s + a, 0) / ages.length
  })()

  // Ortalama kıdem (yıl)
  const avgTenure = (() => {
    const tenures = activeEmployees
      .filter(e => e.hire_date)
      .map(e => {
        const hired = new Date(e.hire_date!)
        const diff = today.getTime() - hired.getTime()
        return diff / (1000 * 60 * 60 * 24 * 365.25)
      })
    if (tenures.length === 0) return 0
    return tenures.reduce((s, a) => s + a, 0) / tenures.length
  })()

  // Aylık maaş yükü
  const monthlySalaryTotal = activeEmployees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0)

  // Şu anda izinde olanlar
  const onLeaveToday = leaves.filter(l => {
    if (l.status !== 'approved') return false
    const start = new Date(l.start_date)
    const end = new Date(l.end_date)
    return today >= start && today <= end
  })

  // Bekleyen izin başvuruları
  const pendingLeaves = leaves.filter(l => l.status === 'pending')

  // Açık avanslar
  const openAdvances = advances.filter(a => a.status === 'open')
  const totalOpenAdvances = openAdvances.reduce((sum, a) => sum + (Number(a.remaining_amount) || Number(a.amount) || 0), 0)

  // Bu ay ödenen maaşlar
  const paidThisMonth = payments.filter(p =>
    p.period_month === currentMonth + 1 && p.period_year === currentYear
  )

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="text-gray-600">Yükleniyor...</div></div>
  }

  return (
    <PermissionGuard module="employees" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">İnsan Kaynakları</h2>
            <p className="text-gray-600">{MONTH_NAMES[currentMonth]} {currentYear} · Genel Bakış</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/hr/leaves" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" /> İzinler
            </Link>
            <Link href="/dashboard/hr/advances" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Avanslar
            </Link>
            <Link href="/dashboard/hr/salaries" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Maaşlar
            </Link>
            <Link href="/dashboard/employees" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Personel
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users />} label="Aktif Personel" value={activeEmployees.length.toString()} sub={`${inactiveEmployees.length} pasif`} color="blue" />
          <StatCard icon={<DollarSign />} label="Aylık Maaş Yükü" value={`${fmt(monthlySalaryTotal)} ₺`} sub={`${activeEmployees.filter(e => e.salary).length} kişi`} color="green" />
          <StatCard icon={<Wallet />} label="Açık Avanslar" value={`${fmt(totalOpenAdvances)} ₺`} sub={`${openAdvances.length} adet`} color="orange" />
          <StatCard icon={<Clock />} label="Bugün İzinde" value={onLeaveToday.length.toString()} sub={`${pendingLeaves.length} bekleyen`} color="purple" />
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Cake />} label="Bu Ay Doğum Günü" value={birthdaysThisMonth.length.toString()} sub={`${birthdaysThisWeek.length} bu hafta`} color="pink" />
          <StatCard icon={<TrendingUp />} label="Yaş Ortalaması" value={`${avgAge.toFixed(1)} yıl`} sub="" color="indigo" />
          <StatCard icon={<Briefcase />} label="Ort. Kıdem" value={`${avgTenure.toFixed(1)} yıl`} sub="" color="teal" />
          <StatCard icon={<UserCheck />} label="Bu Ay Ödenen Maaş" value={paidThisMonth.length.toString()} sub={`${activeEmployees.length - paidThisMonth.length} kalan`} color="green" />
        </div>

        {/* 3-column main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Doğum Günleri */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-500" />
                {MONTH_NAMES[currentMonth]} Doğum Günleri
              </h3>
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-semibold rounded-full">{birthdaysThisMonth.length}</span>
            </div>
            {birthdaysThisMonth.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Bu ay doğum günü yok</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {birthdaysThisMonth.map(e => {
                  const birth = new Date(e.birth_date!)
                  const day = birth.getDate()
                  const isToday = day === today.getDate()
                  const age = currentYear - birth.getFullYear()
                  return (
                    <div key={e.id} className={`flex items-center justify-between p-2 rounded-lg ${isToday ? 'bg-gradient-to-r from-pink-100 to-purple-100 ring-2 ring-pink-300' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isToday ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {day}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{e.full_name} {isToday && '🎂'}</p>
                          <p className="text-xs text-gray-500">{age} yaşında olacak</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bugün İzinde Olanlar */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Bugün İzinde
              </h3>
              <Link href="/dashboard/hr/leaves" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                Tümü <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {onLeaveToday.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Bugün izinde kimse yok</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {onLeaveToday.map(l => (
                  <div key={l.id} className="p-2 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{l.employee?.full_name}</p>
                      <span className="px-2 py-0.5 bg-white text-purple-700 text-xs rounded font-medium">{l.leave_type}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(l.start_date).toLocaleDateString('tr-TR')} → {new Date(l.end_date).toLocaleDateString('tr-TR')} ({l.total_days} gün)
                    </p>
                  </div>
                ))}
              </div>
            )}
            {pendingLeaves.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-orange-600 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  {pendingLeaves.length} bekleyen izin başvurusu
                </div>
              </div>
            )}
          </div>

          {/* Açık Avanslar */}
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" />
                Açık Avanslar
              </h3>
              <Link href="/dashboard/hr/advances" className="text-xs text-orange-600 hover:underline flex items-center gap-1">
                Tümü <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {openAdvances.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Açık avans yok</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {openAdvances.slice(0, 6).map(a => (
                  <div key={a.id} className="p-2 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{a.employee?.full_name}</p>
                      <span className="font-bold text-orange-700 text-sm">{fmt(Number(a.remaining_amount || a.amount))} ₺</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(a.advance_date).toLocaleDateString('tr-TR')} · {a.paid_amount > 0 ? `${fmt(Number(a.paid_amount))} ₺ ödendi` : 'Henüz mahsup edilmedi'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Departman Dağılımı + Son Maaş Ödemeleri */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-5">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-500" />
              Departman Dağılımı
            </h3>
            <div className="space-y-3">
              {Object.entries(departmentStats)
                .sort((a, b) => b[1] - a[1])
                .map(([dep, count]) => {
                  const percent = (count / activeEmployees.length) * 100
                  return (
                    <div key={dep}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{dep}</span>
                        <span className="text-sm text-gray-600">{count} kişi ({percent.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Son Maaş Ödemeleri
              </h3>
              <Link href="/dashboard/hr/salaries" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                Tümü <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Henüz maaş ödemesi yok</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {payments.slice(0, 8).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.employee?.full_name}</p>
                      <p className="text-xs text-gray-500">{MONTH_NAMES[p.period_month - 1]} {p.period_year} · {new Date(p.payment_date).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <span className="font-bold text-green-700 text-sm">{fmt(Number(p.net_amount))} ₺</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
    indigo: 'from-indigo-500 to-indigo-600',
    teal: 'from-teal-500 to-teal-600',
  }
  return (
    <div className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colors[color]} text-white`}>
          <div className="w-5 h-5">{icon}</div>
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

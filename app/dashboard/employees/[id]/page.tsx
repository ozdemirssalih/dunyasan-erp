'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, Calendar, Factory, User } from 'lucide-react'

interface Employee {
  id: string
  employee_code: string
  full_name: string
  department?: string
  position?: string
  phone?: string
  email?: string
  hire_date?: string
  salary?: number
  status: string
}

interface DailyProduction {
  id: string
  production_date: string
  capacity_target: number
  actual_production: number
  defect_count: number
  efficiency_rate: number
  shift: string
  notes: string
  created_at: string
  project?: {
    project_code: string
    project_name: string
  }
  machine?: {
    machine_code: string
    machine_name: string
  }
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [dailyProductions, setDailyProductions] = useState<DailyProduction[]>([])
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    totalProduced: 0,
    totalScrap: 0,
    efficiency: 0,
    totalDays: 0
  })

  useEffect(() => {
    loadEmployeeData()
  }, [employeeId])

  const loadEmployeeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Load employee details
      const { data: employeeData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single()

      setEmployee(employeeData)

      // Load daily production records
      const { data: dailyProductionData, error: dailyError } = await supabase
        .from('machine_daily_production')
        .select(`
          *,
          project:projects(project_code, project_name),
          machine:machines!machine_daily_production_machine_id_fkey(machine_code, machine_name)
        `)
        .eq('employee_id', employeeId)
        .order('production_date', { ascending: false })

      if (dailyError) {
        console.error('Error loading productions:', dailyError)
      }

      setDailyProductions(dailyProductionData || [])

      // Calculate stats
      if (dailyProductionData) {
        const totalProduced = dailyProductionData.reduce((sum, p) => sum + p.actual_production, 0)
        const totalScrap = dailyProductionData.reduce((sum, p) => sum + p.defect_count, 0)
        const avgEfficiency = dailyProductionData.length > 0
          ? dailyProductionData.reduce((sum, p) => sum + p.efficiency_rate, 0) / dailyProductionData.length
          : 0

        setStats({
          totalProduced,
          totalScrap,
          efficiency: avgEfficiency,
          totalDays: dailyProductionData.length
        })
      }
    } catch (error) {
      console.error('Error loading employee data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Personel bulunamadı</p>
          <button
            onClick={() => router.push('/dashboard/employees')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/employees')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Personel Listesine Dön</span>
        </button>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-4 bg-blue-100 rounded-lg">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{employee.full_name}</h1>
                <p className="text-gray-600">#{employee.employee_code}</p>
                {employee.position && (
                  <p className="text-sm text-gray-600 mt-1">{employee.position}</p>
                )}
                {employee.department && (
                  <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                    {employee.department}
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                employee.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {employee.status === 'active' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
            {employee.phone && (
              <div>
                <p className="text-xs text-gray-600">Telefon</p>
                <p className="text-sm font-medium">{employee.phone}</p>
              </div>
            )}
            {employee.email && (
              <div>
                <p className="text-xs text-gray-600">E-posta</p>
                <p className="text-sm font-medium">{employee.email}</p>
              </div>
            )}
            {employee.hire_date && (
              <div>
                <p className="text-xs text-gray-600">İşe Başlama</p>
                <p className="text-sm font-medium">
                  {new Date(employee.hire_date).toLocaleDateString('tr-TR')}
                </p>
              </div>
            )}
            {employee.salary && (
              <div>
                <p className="text-xs text-gray-600">Maaş</p>
                <p className="text-sm font-medium text-green-600">
                  {employee.salary.toLocaleString('tr-TR')} ₺
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Factory className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Toplam Üretim</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalProduced.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.totalDays} gün</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Toplam Fire</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalScrap.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Ortalama Verimlilik</h3>
          </div>
          <p className={`text-3xl font-bold ${
            stats.efficiency >= 80 ? 'text-green-600' :
            stats.efficiency >= 60 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            %{stats.efficiency.toFixed(1)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Çalışma Günü</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalDays}</p>
        </div>
      </div>

      {/* Daily Productions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Günlük Üretim Kayıtları</h2>
          </div>
          <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
            {dailyProductions.length} kayıt
          </span>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {dailyProductions.length > 0 ? (
            dailyProductions.map(record => (
              <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-gray-900">
                      {new Date(record.production_date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {record.project && (
                      <div className="text-sm text-blue-600">
                        {record.project.project_name} ({record.project.project_code})
                      </div>
                    )}
                    {record.machine && (
                      <div className="text-sm text-gray-600 mt-1">
                        🔧 {record.machine.machine_name} ({record.machine.machine_code})
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Vardiya: {record.shift || 'Belirtilmemiş'}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    record.efficiency_rate >= 80 ? 'bg-green-100 text-green-700' :
                    record.efficiency_rate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    %{record.efficiency_rate.toFixed(1)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-600">Hedef</div>
                    <div className="text-sm font-bold text-gray-900">{record.capacity_target}</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-gray-600">Üretilen</div>
                    <div className="text-sm font-bold text-green-600">{record.actual_production}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fire</div>
                    <div className="text-sm font-bold text-red-600">{record.defect_count}</div>
                  </div>
                </div>

                {record.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 italic">{record.notes}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Henüz üretim kaydı bulunmuyor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

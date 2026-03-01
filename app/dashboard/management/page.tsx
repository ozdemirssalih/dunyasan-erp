'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Factory,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  Users,
  Box,
  Activity,
  ArrowRight
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface Stats {
  totalProduction: number
  activeMachines: number
  totalDefects: number
  efficiency: number
  pendingQC: number
  lowStock: number
}

interface MachineStatus {
  id: string
  machine_code: string
  machine_name: string
  status: string
  current_efficiency: number
}

interface DailyProduction {
  date: string
  production: number
  defects: number
  efficiency: number
}

interface ProductDistribution {
  name: string
  value: number
}

interface RecentActivity {
  id: string
  type: string
  description: string
  time: string
  status: string
}

export default function ManagementDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string>('')

  const [stats, setStats] = useState<Stats>({
    totalProduction: 0,
    activeMachines: 0,
    totalDefects: 0,
    efficiency: 0,
    pendingQC: 0,
    lowStock: 0
  })

  const [machines, setMachines] = useState<MachineStatus[]>([])
  const [dailyProduction, setDailyProduction] = useState<DailyProduction[]>([])
  const [productDistribution, setProductDistribution] = useState<ProductDistribution[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)

      await Promise.all([
        loadStats(profile.company_id),
        loadMachines(profile.company_id),
        loadDailyProduction(profile.company_id),
        loadProductDistribution(profile.company_id),
        loadRecentActivities(profile.company_id)
      ])

    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (companyId: string) => {
    // Toplam üretim
    const { data: productionData } = await supabase
      .from('machine_daily_production')
      .select('actual_production, defect_count, efficiency_rate')
      .eq('company_id', companyId)

    const totalProduction = productionData?.reduce((sum, p) => sum + p.actual_production, 0) || 0
    const totalDefects = productionData?.reduce((sum, p) => sum + (p.defect_count || 0), 0) || 0
    const avgEfficiency = productionData && productionData.length > 0
      ? productionData.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / productionData.length
      : 0

    // Aktif tezgahlar
    const { data: machinesData } = await supabase
      .from('machines')
      .select('status')
      .eq('company_id', companyId)

    const activeMachines = machinesData?.filter(m => m.status === 'active').length || 0

    // Bekleyen KK
    const { data: qcData } = await supabase
      .from('production_to_qc_transfers')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('status', 'pending')

    const pendingQC = qcData?.reduce((sum, q) => sum + q.quantity, 0) || 0

    // Düşük stok uyarısı
    const { data: stockData } = await supabase
      .from('warehouse_items')
      .select('current_stock, min_stock')
      .eq('company_id', companyId)

    const lowStock = stockData?.filter(s => s.current_stock <= s.min_stock).length || 0

    setStats({
      totalProduction,
      activeMachines,
      totalDefects,
      efficiency: avgEfficiency,
      pendingQC,
      lowStock
    })
  }

  const loadMachines = async (companyId: string) => {
    const { data } = await supabase
      .from('machines')
      .select('id, machine_code, machine_name, status')
      .eq('company_id', companyId)
      .order('status', { ascending: false })
      .limit(8)

    if (data) {
      // Her tezgah için ortalama verimlilik hesapla
      const machinesWithEfficiency = await Promise.all(
        data.map(async (machine) => {
          const { data: prodData } = await supabase
            .from('machine_daily_production')
            .select('efficiency_rate')
            .eq('machine_id', machine.id)
            .order('production_date', { ascending: false })
            .limit(5)

          const avgEff = prodData && prodData.length > 0
            ? prodData.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / prodData.length
            : 0

          return {
            ...machine,
            current_efficiency: avgEff
          }
        })
      )

      setMachines(machinesWithEfficiency)
    }
  }

  const loadDailyProduction = async (companyId: string) => {
    const { data } = await supabase
      .from('machine_daily_production')
      .select('production_date, actual_production, defect_count, efficiency_rate')
      .eq('company_id', companyId)
      .gte('production_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('production_date', { ascending: true })

    if (data) {
      const grouped = data.reduce((acc: any, curr) => {
        const date = new Date(curr.production_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
        if (!acc[date]) {
          acc[date] = { production: 0, defects: 0, count: 0, effSum: 0 }
        }
        acc[date].production += curr.actual_production
        acc[date].defects += curr.defect_count || 0
        acc[date].effSum += curr.efficiency_rate || 0
        acc[date].count += 1
        return acc
      }, {})

      const chartData = Object.keys(grouped).map(date => ({
        date,
        production: grouped[date].production,
        defects: grouped[date].defects,
        efficiency: grouped[date].count > 0 ? grouped[date].effSum / grouped[date].count : 0
      }))

      setDailyProduction(chartData)
    }
  }

  const loadProductDistribution = async (companyId: string) => {
    const { data } = await supabase
      .from('machine_daily_production')
      .select(`
        actual_production,
        project:projects(project_name)
      `)
      .eq('company_id', companyId)
      .limit(100)

    if (data) {
      const distribution = data.reduce((acc: any, curr: any) => {
        const project = Array.isArray(curr.project) ? curr.project[0] : curr.project
        const name = project?.project_name || 'Diğer'
        if (!acc[name]) acc[name] = 0
        acc[name] += curr.actual_production
        return acc
      }, {})

      const chartData = Object.keys(distribution)
        .map(name => ({ name, value: distribution[name] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)

      setProductDistribution(chartData)
    }
  }

  const loadRecentActivities = async (companyId: string) => {
    const activities: RecentActivity[] = []

    // Son üretim kayıtları
    const { data: prodData } = await supabase
      .from('machine_daily_production')
      .select(`
        id,
        actual_production,
        created_at,
        machine:machines(machine_name),
        project:projects(project_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (prodData) {
      prodData.forEach(p => {
        activities.push({
          id: p.id,
          type: 'production',
          description: `${p.machine?.machine_name} - ${p.actual_production} adet üretim`,
          time: new Date(p.created_at).toLocaleString('tr-TR'),
          status: 'success'
        })
      })
    }

    // Son KK transferleri
    const { data: qcData } = await supabase
      .from('production_to_qc_transfers')
      .select('id, quantity, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3)

    if (qcData) {
      qcData.forEach(q => {
        activities.push({
          id: q.id,
          type: 'qc',
          description: `${q.quantity} adet KK'ya gönderildi`,
          time: new Date(q.created_at).toLocaleString('tr-TR'),
          status: q.status === 'approved' ? 'success' : q.status === 'pending' ? 'warning' : 'error'
        })
      })
    }

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setRecentActivities(activities.slice(0, 8))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">YÖNETİM DASHBOARD</h1>
            <p className="text-blue-100">Gerçek zamanlı üretim ve performans takibi</p>
          </div>
          <Activity className="w-16 h-16 opacity-50" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-10 h-10 opacity-80" />
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="text-3xl font-bold mb-1">{stats.totalProduction.toLocaleString()}</div>
          <div className="text-sm text-blue-100">Toplam Üretim</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Factory className="w-10 h-10 opacity-80" />
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-3xl font-bold mb-1">{stats.activeMachines}</div>
          <div className="text-sm text-green-100">Aktif Tezgah</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-10 h-10 opacity-80" />
            <div className="text-lg font-bold">%{stats.efficiency.toFixed(1)}</div>
          </div>
          <div className="text-3xl font-bold mb-1">Verimlilik</div>
          <div className="text-sm text-purple-100">Ortalama</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-10 h-10 opacity-80" />
            <div className="text-lg">🔥</div>
          </div>
          <div className="text-3xl font-bold mb-1">{stats.totalDefects.toLocaleString()}</div>
          <div className="text-sm text-red-100">Toplam Fire</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-10 h-10 opacity-80" />
            <div className="text-lg">⏳</div>
          </div>
          <div className="text-3xl font-bold mb-1">{stats.pendingQC.toLocaleString()}</div>
          <div className="text-sm text-orange-100">Bekleyen KK</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Box className="w-10 h-10 opacity-80" />
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="text-3xl font-bold mb-1">{stats.lowStock}</div>
          <div className="text-sm text-yellow-100">Düşük Stok</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Daily Production Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Son 7 Gün Üretim Performansı
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyProduction}>
              <defs>
                <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorDefects" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="production" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProduction)" name="Üretim" />
              <Area type="monotone" dataKey="defects" stroke="#ef4444" fillOpacity={1} fill="url(#colorDefects)" name="Fire" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Product Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-6 h-6 text-green-600" />
            Proje Dağılımı
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={productDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {productDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machines and Recent Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Machine Status Grid */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Factory className="w-6 h-6 text-purple-600" />
              Tezgah Durumları
            </h3>
            <button
              onClick={() => router.push('/dashboard/machines')}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {machines.map((machine) => (
              <div
                key={machine.id}
                onClick={() => router.push(`/dashboard/machines/${machine.id}`)}
                className="border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all"
                style={{
                  borderColor:
                    machine.status === 'active' ? '#10b981' :
                    machine.status === 'maintenance' ? '#f59e0b' :
                    machine.status === 'idle' ? '#6b7280' : '#ef4444'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Settings className={`w-6 h-6 ${
                    machine.status === 'active' ? 'text-green-600' :
                    machine.status === 'maintenance' ? 'text-yellow-600' :
                    machine.status === 'idle' ? 'text-gray-600' : 'text-red-600'
                  }`} />
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    machine.status === 'active' ? 'bg-green-100 text-green-700' :
                    machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                    machine.status === 'idle' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {machine.status === 'active' ? 'Aktif' :
                     machine.status === 'maintenance' ? 'Bakım' :
                     machine.status === 'idle' ? 'Boşta' : 'Durduruldu'}
                  </span>
                </div>
                <div className="font-bold text-gray-900 mb-1">{machine.machine_code}</div>
                <div className="text-xs text-gray-600 mb-2 truncate">{machine.machine_name}</div>
                <div className="text-sm">
                  <span className="text-gray-600">Verimlilik: </span>
                  <span className={`font-bold ${
                    machine.current_efficiency >= 80 ? 'text-green-600' :
                    machine.current_efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    %{machine.current_efficiency.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-600" />
            Son İşlemler
          </h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="border-l-4 pl-4 py-2" style={{
                borderColor:
                  activity.status === 'success' ? '#10b981' :
                  activity.status === 'warning' ? '#f59e0b' : '#ef4444'
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{activity.description}</div>
                    <div className="text-xs text-gray-500 mt-1">{activity.time}</div>
                  </div>
                  <div className={`ml-2 w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500' :
                    activity.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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
  ArrowRight,
  Award,
  Target,
  BarChart3,
  Calendar,
  FileText,
  ShoppingCart,
  AlertCircle,
  TrendingDown,
  Zap
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
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface Stats {
  totalProduction: number
  activeMachines: number
  totalDefects: number
  efficiency: number
  pendingQC: number
  lowStock: number
  totalEmployees: number
  activeProjects: number
  monthlyProduction: number
  defectRate: number
  approvedQC: number
  rejectedQC: number
  todayProduction: number
  weeklyProduction: number
}

interface MachineStatus {
  id: string
  machine_code: string
  machine_name: string
  status: string
  current_efficiency: number
  total_production: number
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

interface ProjectDefects {
  name: string
  defects: number
  production: number
  rate: number
}

interface MachineComparison {
  machine: string
  production: number
  efficiency: number
}

interface StockItem {
  item_name: string
  current_stock: number
  min_stock: number
  unit: string
}

interface TopProject {
  project_name: string
  total_production: number
  total_defects: number
  efficiency: number
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
    lowStock: 0,
    totalEmployees: 0,
    activeProjects: 0,
    monthlyProduction: 0,
    defectRate: 0,
    approvedQC: 0,
    rejectedQC: 0,
    todayProduction: 0,
    weeklyProduction: 0
  })

  const [machines, setMachines] = useState<MachineStatus[]>([])
  const [dailyProduction, setDailyProduction] = useState<DailyProduction[]>([])
  const [productDistribution, setProductDistribution] = useState<ProductDistribution[]>([])
  const [projectDefects, setProjectDefects] = useState<ProjectDefects[]>([])
  const [machineComparison, setMachineComparison] = useState<MachineComparison[]>([])
  const [criticalStock, setCriticalStock] = useState<StockItem[]>([])
  const [topProjects, setTopProjects] = useState<TopProject[]>([])
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
        loadProjectDefects(profile.company_id),
        loadMachineComparison(profile.company_id),
        loadCriticalStock(profile.company_id),
        loadTopProjects(profile.company_id),
        loadRecentActivities(profile.company_id)
      ])

    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (companyId: string) => {
    try {
      // Toplam üretim ve fire (TÜM VERİYİ ÇEK - LIMIT YOK)
      const { data: productionData, error: prodError } = await supabase
        .from('machine_daily_production')
        .select('actual_production, defect_count, efficiency_rate, production_date')
        .eq('company_id', companyId)

      if (prodError) {
        console.error('Üretim verileri çekilirken hata:', prodError)
        return
      }

      console.log('✅ Toplam üretim kaydı:', productionData?.length || 0)

      const totalProduction = productionData?.reduce((sum, p) => sum + (p.actual_production || 0), 0) || 0
      const totalDefects = productionData?.reduce((sum, p) => sum + (p.defect_count || 0), 0) || 0
      const avgEfficiency = productionData && productionData.length > 0
        ? productionData.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / productionData.length
        : 0
      const defectRate = totalProduction > 0 ? (totalDefects / totalProduction) * 100 : 0

    // Bu ayki üretim
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthlyProduction = productionData?.filter(p =>
      new Date(p.production_date) >= monthStart
    ).reduce((sum, p) => sum + p.actual_production, 0) || 0

    // Bugünkü üretim
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayProduction = productionData?.filter(p =>
      new Date(p.production_date).toDateString() === today.toDateString()
    ).reduce((sum, p) => sum + p.actual_production, 0) || 0

    // Bu haftaki üretim
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weeklyProduction = productionData?.filter(p =>
      new Date(p.production_date) >= weekStart
    ).reduce((sum, p) => sum + p.actual_production, 0) || 0

      // Aktif tezgahlar (TÜM TEZGAHLAR - LIMIT YOK)
      const { data: machinesData, error: machError } = await supabase
        .from('machines')
        .select('status')
        .eq('company_id', companyId)

      if (machError) console.error('Tezgah verileri hatası:', machError)
      console.log('✅ Toplam tezgah:', machinesData?.length || 0)

      const activeMachines = machinesData?.filter(m => m.status === 'active').length || 0

      // Bekleyen, onaylanan ve reddedilen KK (TÜM KK - LIMIT YOK)
      const { data: qcData, error: qcError } = await supabase
        .from('production_to_qc_transfers')
        .select('quantity, status')
        .eq('company_id', companyId)

      if (qcError) console.error('KK verileri hatası:', qcError)
      console.log('✅ Toplam KK transfer:', qcData?.length || 0)

      const pendingQC = qcData?.filter(q => q.status === 'pending').reduce((sum, q) => sum + (q.quantity || 0), 0) || 0
      const approvedQC = qcData?.filter(q => q.status === 'approved').length || 0
      const rejectedQC = qcData?.filter(q => q.status === 'rejected').length || 0

      // Düşük stok uyarısı (TÜM STOK - LIMIT YOK)
      const { data: stockData, error: stockError } = await supabase
        .from('warehouse_items')
        .select('current_stock, min_stock')
        .eq('company_id', companyId)

      if (stockError) console.error('Stok verileri hatası:', stockError)
      console.log('✅ Toplam stok kalemi:', stockData?.length || 0)

      const lowStock = stockData?.filter(s => s.current_stock <= s.min_stock).length || 0

      // Toplam çalışan sayısı (TÜM ÇALIŞANLAR - LIMIT YOK)
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)

      if (empError) console.error('Çalışan verileri hatası:', empError)
      console.log('✅ Toplam çalışan:', employeesData?.length || 0)

      const totalEmployees = employeesData?.length || 0

      // Aktif proje sayısı (TÜM PROJELER - LIMIT YOK)
      const { data: projectsData, error: projError } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'active')

      if (projError) console.error('Proje verileri hatası:', projError)
      console.log('✅ Aktif proje:', projectsData?.length || 0)

      const activeProjects = projectsData?.length || 0

      setStats({
        totalProduction,
        activeMachines,
        totalDefects,
        efficiency: avgEfficiency,
        pendingQC,
        lowStock,
        totalEmployees,
        activeProjects,
        monthlyProduction,
        defectRate,
        approvedQC,
        rejectedQC,
        todayProduction,
        weeklyProduction
      })

      console.log('📊 İstatistikler yüklendi:', {
        totalProduction,
        activeMachines,
        totalDefects,
        totalEmployees,
        activeProjects
      })
    } catch (error) {
      console.error('❌ loadStats hatası:', error)
    }
  }

  const loadMachines = async (companyId: string) => {
    try {
      // TÜM TEZGAHLARI ÇEK (sonra UI'da ilk 8'ini göster)
      const { data, error } = await supabase
        .from('machines')
        .select('id, machine_code, machine_name, status')
        .eq('company_id', companyId)
        .order('status', { ascending: false })

      if (error) {
        console.error('❌ Tezgah listesi hatası:', error)
        return
      }

      console.log('✅ Tezgah listesi yüklendi:', data?.length || 0)

      if (data && data.length > 0) {
        // Her tezgah için ortalama verimlilik ve toplam üretim hesapla
        const machinesWithData = await Promise.all(
          data.slice(0, 12).map(async (machine) => { // İlk 12 tezgah için detay çek
            const { data: prodData, error: prodError } = await supabase
              .from('machine_daily_production')
              .select('efficiency_rate, actual_production')
              .eq('machine_id', machine.id)
              .order('production_date', { ascending: false })
              .limit(30) // Son 30 üretim kaydı

            if (prodError) {
              console.error(`Tezgah ${machine.machine_code} üretim verisi hatası:`, prodError)
            }

            const avgEff = prodData && prodData.length > 0
              ? prodData.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / prodData.length
              : 0

            const totalProd = prodData?.reduce((sum, p) => sum + (p.actual_production || 0), 0) || 0

            return {
              ...machine,
              current_efficiency: avgEff,
              total_production: totalProd
            }
          })
        )

        setMachines(machinesWithData)
        console.log('📊 Tezgah performansları hesaplandı')
      }
    } catch (error) {
      console.error('❌ loadMachines hatası:', error)
    }
  }

  const loadDailyProduction = async (companyId: string) => {
    try {
      // Son 14 gün üretim verileri
      const { data, error } = await supabase
        .from('machine_daily_production')
        .select('production_date, actual_production, defect_count, efficiency_rate')
        .eq('company_id', companyId)
        .gte('production_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('production_date', { ascending: true })

      if (error) {
        console.error('❌ Günlük üretim hatası:', error)
        return
      }

      console.log('✅ Son 14 gün üretim:', data?.length || 0, 'kayıt')

      if (data && data.length > 0) {
        const grouped = data.reduce((acc: any, curr) => {
          const date = new Date(curr.production_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
          if (!acc[date]) {
            acc[date] = { production: 0, defects: 0, count: 0, effSum: 0 }
          }
          acc[date].production += curr.actual_production || 0
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
        console.log('📊 Günlük üretim grafiği hazır:', chartData.length, 'gün')
      }
    } catch (error) {
      console.error('❌ loadDailyProduction hatası:', error)
    }
  }

  const loadProductDistribution = async (companyId: string) => {
    try {
      // TÜM ÜRETİM VERİSİNİ ÇEK (limit yok)
      const { data, error } = await supabase
        .from('machine_daily_production')
        .select(`
          actual_production,
          project:projects(project_name)
        `)
        .eq('company_id', companyId)

      if (error) {
        console.error('❌ Proje dağılımı hatası:', error)
        return
      }

      console.log('✅ Proje dağılımı için veri:', data?.length || 0, 'kayıt')

      if (data && data.length > 0) {
        const distribution = data.reduce((acc: any, curr: any) => {
          const project = Array.isArray(curr.project) ? curr.project[0] : curr.project
          const name = project?.project_name || 'Diğer'
          if (!acc[name]) acc[name] = 0
          acc[name] += curr.actual_production || 0
          return acc
        }, {})

        const chartData = Object.keys(distribution)
          .map(name => ({ name, value: distribution[name] }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)

        setProductDistribution(chartData)
        console.log('📊 Proje dağılımı hazır:', chartData.length, 'proje')
      }
    } catch (error) {
      console.error('❌ loadProductDistribution hatası:', error)
    }
  }

  const loadProjectDefects = async (companyId: string) => {
    try {
      // TÜM FİRE VERİSİNİ ÇEK (limit yok)
      const { data, error } = await supabase
        .from('machine_daily_production')
        .select(`
          actual_production,
          defect_count,
          project:projects(project_name)
        `)
        .eq('company_id', companyId)

      if (error) {
        console.error('❌ Fire analizi hatası:', error)
        return
      }

      console.log('✅ Fire analizi için veri:', data?.length || 0, 'kayıt')

      if (data && data.length > 0) {
        const defects: any = {}
        data.forEach((curr: any) => {
          const project = Array.isArray(curr.project) ? curr.project[0] : curr.project
          const name = project?.project_name || 'Diğer'
          if (!defects[name]) {
            defects[name] = { defects: 0, production: 0 }
          }
          defects[name].defects += curr.defect_count || 0
          defects[name].production += curr.actual_production || 0
        })

        const chartData = Object.keys(defects)
          .map(name => ({
            name,
            defects: defects[name].defects,
            production: defects[name].production,
            rate: defects[name].production > 0 ? (defects[name].defects / defects[name].production) * 100 : 0
          }))
          .filter(p => p.defects > 0)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 6)

        setProjectDefects(chartData)
        console.log('📊 Fire analizi hazır:', chartData.length, 'proje')
      }
    } catch (error) {
      console.error('❌ loadProjectDefects hatası:', error)
    }
  }

  const loadMachineComparison = async (companyId: string) => {
    try {
      // TÜM TEZGAHLARI ÇEK
      const { data: machinesData, error } = await supabase
        .from('machines')
        .select('id, machine_code')
        .eq('company_id', companyId)

      if (error) {
        console.error('❌ Tezgah karşılaştırma hatası:', error)
        return
      }

      console.log('✅ Tezgah karşılaştırma için:', machinesData?.length || 0, 'tezgah')

      if (machinesData && machinesData.length > 0) {
        const comparison = await Promise.all(
          machinesData.slice(0, 15).map(async (machine) => { // İlk 15 tezgah
            const { data: prodData, error: prodError } = await supabase
              .from('machine_daily_production')
              .select('actual_production, efficiency_rate')
              .eq('machine_id', machine.id)
              .gte('production_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            if (prodError) {
              console.error(`Tezgah ${machine.machine_code} karşılaştırma hatası:`, prodError)
            }

            const totalProd = prodData?.reduce((sum, p) => sum + (p.actual_production || 0), 0) || 0
            const avgEff = prodData && prodData.length > 0
              ? prodData.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / prodData.length
              : 0

            return {
              machine: machine.machine_code,
              production: totalProd,
              efficiency: avgEff
            }
          })
        )

        setMachineComparison(comparison.sort((a, b) => b.production - a.production))
        console.log('📊 Tezgah karşılaştırması hazır')
      }
    } catch (error) {
      console.error('❌ loadMachineComparison hatası:', error)
    }
  }

  const loadCriticalStock = async (companyId: string) => {
    try {
      // TÜM STOK VERİSİNİ ÇEK - unit kolonu olmayabilir, o yüzden önce tüm kolonları dene
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', companyId)

      if (error) {
        console.error('❌ Kritik stok hatası:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        // Hata olsa bile boş array set et
        setCriticalStock([])
        return
      }

      console.log('✅ Toplam stok kalemi:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('📋 Stok kolonları:', Object.keys(data[0]))
      }

      if (data && data.length > 0) {
        // Filter where current_stock <= min_stock in JavaScript
        const criticalItems = data
          .filter(item => item.current_stock <= item.min_stock)
          .map(item => ({
            item_name: item.item_name || item.name || 'İsimsiz',
            current_stock: item.current_stock || 0,
            min_stock: item.min_stock || 0,
            unit: item.unit || item.measurement_unit || 'adet'
          }))
          .sort((a, b) => a.current_stock - b.current_stock)
          .slice(0, 10)

        setCriticalStock(criticalItems)
        console.log('📊 Kritik stok:', criticalItems.length, 'ürün')
      } else {
        // Veri yoksa boş array set et
        setCriticalStock([])
        console.log('📊 Kritik stok: Henüz stok kaydı yok')
      }
    } catch (error) {
      console.error('❌ loadCriticalStock hatası:', error)
      setCriticalStock([])
    }
  }

  const loadTopProjects = async (companyId: string) => {
    try {
      // TÜM PROJE VERİSİNİ ÇEK (limit yok)
      const { data, error } = await supabase
        .from('machine_daily_production')
        .select(`
          actual_production,
          defect_count,
          efficiency_rate,
          project:projects(project_name)
        `)
        .eq('company_id', companyId)

      if (error) {
        console.error('❌ Top projeler hatası:', error)
        return
      }

      console.log('✅ Top projeler için veri:', data?.length || 0, 'kayıt')

      if (data && data.length > 0) {
        const projects: any = {}
        data.forEach((curr: any) => {
          const project = Array.isArray(curr.project) ? curr.project[0] : curr.project
          const name = project?.project_name || 'Diğer'
          if (!projects[name]) {
            projects[name] = { production: 0, defects: 0, effSum: 0, count: 0 }
          }
          projects[name].production += curr.actual_production || 0
          projects[name].defects += curr.defect_count || 0
          projects[name].effSum += curr.efficiency_rate || 0
          projects[name].count += 1
        })

        const topList = Object.keys(projects)
          .map(name => ({
            project_name: name,
            total_production: projects[name].production,
            total_defects: projects[name].defects,
            efficiency: projects[name].count > 0 ? projects[name].effSum / projects[name].count : 0
          }))
          .sort((a, b) => b.total_production - a.total_production)
          .slice(0, 10)

        setTopProjects(topList)
        console.log('📊 Top 10 proje hazır')
      }
    } catch (error) {
      console.error('❌ loadTopProjects hatası:', error)
    }
  }

  const loadRecentActivities = async (companyId: string) => {
    try {
      const activities: RecentActivity[] = []

      // Son üretim kayıtları (daha fazla kayıt çek)
      const { data: prodData, error: prodError } = await supabase
        .from('machine_daily_production')
        .select(`
          id,
          actual_production,
          defect_count,
          created_at,
          machine:machines(machine_name),
          project:projects(project_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20) // 10'dan 20'ye çıkarıldı

      if (prodError) {
        console.error('❌ Son üretim kayıtları hatası:', prodError)
      }

      if (prodData) {
        prodData.forEach((p: any) => {
          const machine = Array.isArray(p.machine) ? p.machine[0] : p.machine
          const project = Array.isArray(p.project) ? p.project[0] : p.project
          activities.push({
            id: p.id,
            type: 'production',
            description: `${machine?.machine_name || 'Tezgah'} - ${project?.project_name || 'Proje'} - ${p.actual_production || 0} adet üretim${p.defect_count > 0 ? ` (${p.defect_count} fire)` : ''}`,
            time: new Date(p.created_at).toLocaleString('tr-TR'),
            status: p.defect_count > 0 && (p.defect_count / p.actual_production) > 0.1 ? 'warning' : 'success'
          })
        })
      }

      // Son KK transferleri (daha fazla kayıt çek)
      const { data: qcData, error: qcError } = await supabase
        .from('production_to_qc_transfers')
        .select('id, quantity, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(15) // 8'den 15'e çıkarıldı

      if (qcError) {
        console.error('❌ Son KK transferleri hatası:', qcError)
      }

      if (qcData) {
        qcData.forEach(q => {
          activities.push({
            id: q.id,
            type: 'qc',
            description: `${q.quantity || 0} adet KK'ya gönderildi - ${
              q.status === 'approved' ? '✓ Onaylandı' :
              q.status === 'pending' ? '⏳ Bekliyor' :
              q.status === 'rejected' ? '✗ Reddedildi' : q.status
            }`,
            time: new Date(q.created_at).toLocaleString('tr-TR'),
            status: q.status === 'approved' ? 'success' : q.status === 'pending' ? 'warning' : 'error'
          })
        })
      }

      // Depo işlemleri (daha fazla kayıt çek)
      const { data: warehouseData, error: warehouseError } = await supabase
        .from('warehouse_qc_requests')
        .select('id, quantity, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10) // 5'ten 10'a çıkarıldı

      if (warehouseError) {
        console.error('❌ Son depo işlemleri hatası:', warehouseError)
      }

      if (warehouseData) {
        warehouseData.forEach(w => {
          activities.push({
            id: w.id,
            type: 'warehouse',
            description: `${w.quantity || 0} adet depo girişi - ${
              w.status === 'approved' ? '✓ Onaylandı' :
              w.status === 'pending' ? '⏳ Bekliyor' :
              w.status === 'rejected' ? '✗ Reddedildi' : w.status
            }`,
            time: new Date(w.created_at).toLocaleString('tr-TR'),
            status: w.status === 'approved' ? 'success' : w.status === 'pending' ? 'warning' : 'error'
          })
        })
      }

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setRecentActivities(activities.slice(0, 15))
      console.log('📊 Son işlemler hazır:', activities.length, 'işlem')
    } catch (error) {
      console.error('❌ loadRecentActivities hatası:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-semibold">Detaylı analiz yükleniyor...</p>
          <p className="text-gray-400 text-sm mt-2">Tüm veriler hesaplanıyor</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Activity className="w-10 h-10" />
              YÖNETİM DASHBOARD
            </h1>
            <p className="text-blue-100 text-lg">Gerçek zamanlı üretim ve performans takibi • Detaylı Analiz</p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.todayProduction.toLocaleString()}</div>
              <div className="text-sm text-blue-200">Bugün</div>
            </div>
            <div className="w-px h-16 bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.weeklyProduction.toLocaleString()}</div>
              <div className="text-sm text-blue-200">Bu Hafta</div>
            </div>
            <div className="w-px h-16 bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.monthlyProduction.toLocaleString()}</div>
              <div className="text-sm text-blue-200">Bu Ay</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Cards - 10 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-12 h-12 opacity-80" />
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.totalProduction.toLocaleString()}</div>
          <div className="text-sm text-blue-100 font-semibold">Toplam Üretim</div>
          <div className="mt-3 pt-3 border-t border-blue-400 text-xs text-blue-100">
            {stats.totalDefects > 0 && `${((stats.totalProduction - stats.totalDefects) / stats.totalProduction * 100).toFixed(1)}% Kaliteli Üretim`}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Factory className="w-12 h-12 opacity-80" />
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.activeMachines}</div>
          <div className="text-sm text-green-100 font-semibold">Aktif Tezgah</div>
          <div className="mt-3 pt-3 border-t border-green-400 text-xs text-green-100">
            Şu anda çalışıyor
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-12 h-12 opacity-80" />
            <Zap className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">%{stats.efficiency.toFixed(1)}</div>
          <div className="text-sm text-purple-100 font-semibold">Ortalama Verimlilik</div>
          <div className="mt-3 pt-3 border-t border-purple-400 text-xs text-purple-100">
            {stats.efficiency >= 80 ? 'Mükemmel performans' : stats.efficiency >= 60 ? 'İyi performans' : 'İyileştirme gerekli'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-12 h-12 opacity-80" />
            <TrendingDown className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.totalDefects.toLocaleString()}</div>
          <div className="text-sm text-red-100 font-semibold">Toplam Fire</div>
          <div className="mt-3 pt-3 border-t border-red-400 text-xs text-red-100">
            %{stats.defectRate.toFixed(2)} Fire Oranı
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-12 h-12 opacity-80" />
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.pendingQC.toLocaleString()}</div>
          <div className="text-sm text-orange-100 font-semibold">Bekleyen KK</div>
          <div className="mt-3 pt-3 border-t border-orange-400 text-xs text-orange-100">
            Kontrol bekliyor
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Box className="w-12 h-12 opacity-80" />
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.lowStock}</div>
          <div className="text-sm text-yellow-100 font-semibold">Kritik Stok</div>
          <div className="mt-3 pt-3 border-t border-yellow-400 text-xs text-yellow-100">
            Minimum seviyede
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-12 h-12 opacity-80" />
            <Activity className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.totalEmployees}</div>
          <div className="text-sm text-cyan-100 font-semibold">Toplam Çalışan</div>
          <div className="mt-3 pt-3 border-t border-cyan-400 text-xs text-cyan-100">
            Aktif personel sayısı
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-12 h-12 opacity-80" />
            <Target className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.activeProjects}</div>
          <div className="text-sm text-pink-100 font-semibold">Aktif Proje</div>
          <div className="mt-3 pt-3 border-t border-pink-400 text-xs text-pink-100">
            Devam eden projeler
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2 className="w-12 h-12 opacity-80" />
            <Award className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.approvedQC}</div>
          <div className="text-sm text-emerald-100 font-semibold">Onaylanan KK</div>
          <div className="mt-3 pt-3 border-t border-emerald-400 text-xs text-emerald-100">
            Başarılı kontroller
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <AlertCircle className="w-12 h-12 opacity-80" />
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="text-4xl font-bold mb-2">{stats.rejectedQC}</div>
          <div className="text-sm text-rose-100 font-semibold">Reddedilen KK</div>
          <div className="mt-3 pt-3 border-t border-rose-400 text-xs text-rose-100">
            Kalite problemleri
          </div>
        </div>
      </div>

      {/* Main Charts Row - 14 Day Production */}
      <div className="bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Son 14 Gün Detaylı Üretim Performansı
          </h3>
          <div className="flex gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Üretim</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Fire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Verimlilik</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '2px solid #ddd', borderRadius: '12px', padding: '12px' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Area type="monotone" dataKey="production" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProduction)" name="Üretim (adet)" />
            <Area type="monotone" dataKey="defects" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDefects)" name="Fire (adet)" />
            <Line type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={3} name="Verimlilik (%)" dot={{ fill: '#10b981', r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row 2 - Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Product Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <Package className="w-7 h-7 text-green-600" />
            Proje Bazlı Üretim Dağılımı
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={productDistribution}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent, value }) => `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {productDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => value.toLocaleString() + ' adet'} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Fire Analysis Pie Chart */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-red-600" />
            Proje Bazlı Fire Analizi
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={projectDefects}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, rate }) => `${name}: %${rate.toFixed(1)}`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="defects"
              >
                {projectDefects.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any, props: any) => [
                `${value} adet fire (${props.payload.rate.toFixed(2)}%)`,
                `Toplam Üretim: ${props.payload.production} adet`
              ]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machine Comparison Bar Chart */}
      <div className="bg-white rounded-xl shadow-xl p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-purple-600" />
          Tezgah Bazlı Üretim Karşılaştırması (Son 30 Gün)
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={machineComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="machine" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis yAxisId="left" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis yAxisId="right" orientation="right" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '2px solid #ddd', borderRadius: '12px', padding: '12px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="production" fill="#3b82f6" name="Üretim (adet)" radius={[8, 8, 0, 0]} />
            <Bar yAxisId="right" dataKey="efficiency" fill="#10b981" name="Verimlilik (%)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Projects Table and Machine Status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top 10 Projects */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Award className="w-7 h-7 text-amber-600" />
              Top 10 Projeler
            </h3>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left p-3 text-sm font-bold text-gray-700">#</th>
                  <th className="text-left p-3 text-sm font-bold text-gray-700">Proje</th>
                  <th className="text-right p-3 text-sm font-bold text-gray-700">Üretim</th>
                  <th className="text-right p-3 text-sm font-bold text-gray-700">Fire</th>
                  <th className="text-right p-3 text-sm font-bold text-gray-700">Verimlilik</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((project, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-gray-500">#{index + 1}</td>
                    <td className="p-3 font-semibold text-gray-900">{project.project_name}</td>
                    <td className="p-3 text-right font-semibold text-blue-600">{project.total_production.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold text-red-600">{project.total_defects.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <span className={`font-bold ${
                        project.efficiency >= 80 ? 'text-green-600' :
                        project.efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        %{project.efficiency.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Machine Status Grid */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Factory className="w-7 h-7 text-purple-600" />
              Tezgah Durumları ve Performans
            </h3>
            <button
              onClick={() => router.push('/dashboard/machines')}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {machines.map((machine) => (
              <div
                key={machine.id}
                onClick={() => router.push(`/dashboard/machines/${machine.id}`)}
                className="border-2 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                style={{
                  borderColor:
                    machine.status === 'active' ? '#10b981' :
                    machine.status === 'maintenance' ? '#f59e0b' :
                    machine.status === 'idle' ? '#6b7280' : '#ef4444'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <Settings className={`w-7 h-7 ${
                    machine.status === 'active' ? 'text-green-600' :
                    machine.status === 'maintenance' ? 'text-yellow-600' :
                    machine.status === 'idle' ? 'text-gray-600' : 'text-red-600'
                  }`} />
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    machine.status === 'active' ? 'bg-green-100 text-green-700' :
                    machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                    machine.status === 'idle' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {machine.status === 'active' ? 'Aktif' :
                     machine.status === 'maintenance' ? 'Bakım' :
                     machine.status === 'idle' ? 'Boşta' : 'Durduruldu'}
                  </span>
                </div>
                <div className="font-bold text-lg text-gray-900 mb-1">{machine.machine_code}</div>
                <div className="text-xs text-gray-600 mb-3 truncate">{machine.machine_name}</div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200">
                  <div>
                    <div className="text-xs text-gray-500">Üretim</div>
                    <div className="font-bold text-blue-600">{machine.total_production.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Verimlilik</div>
                    <div className={`font-bold text-lg ${
                      machine.current_efficiency >= 80 ? 'text-green-600' :
                      machine.current_efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      %{machine.current_efficiency.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Stock and Recent Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Critical Stock Items */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-yellow-600" />
              Kritik Stok Durumu
            </h3>
            <button
              onClick={() => router.push('/dashboard/warehouse')}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Depoya Git <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {criticalStock.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-green-500" />
                <p className="font-semibold">Tebrikler! Kritik stok bulunmuyor.</p>
              </div>
            ) : (
              criticalStock.map((item, index) => (
                <div key={index} className="border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg p-4 hover:bg-yellow-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 mb-1">{item.item_name}</div>
                      <div className="text-sm text-gray-600">
                        Mevcut: <span className="font-semibold text-red-600">{item.current_stock} {item.unit}</span> •
                        Minimum: <span className="font-semibold">{item.min_stock} {item.unit}</span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-600 h-2 rounded-full"
                            style={{ width: `${Math.min((item.current_stock / item.min_stock) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <AlertTriangle className="w-6 h-6 text-yellow-600 ml-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <Clock className="w-7 h-7 text-orange-600" />
            Son İşlemler (Detaylı)
          </h3>

          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="border-l-4 pl-4 py-3 rounded-r-lg hover:bg-gray-50 transition-colors" style={{
                borderColor:
                  activity.status === 'success' ? '#10b981' :
                  activity.status === 'warning' ? '#f59e0b' : '#ef4444'
              }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        activity.type === 'production' ? 'bg-blue-100 text-blue-700' :
                        activity.type === 'qc' ? 'bg-purple-100 text-purple-700' :
                        'bg-cyan-100 text-cyan-700'
                      }`}>
                        {activity.type === 'production' ? 'ÜRETİM' :
                         activity.type === 'qc' ? 'KALİTE' : 'DEPO'}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-500' :
                        activity.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                    </div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">{activity.description}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QC Statistics */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-xl p-8 text-white">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          Kalite Kontrol İstatistikleri
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-10 h-10" />
              <div className="text-3xl font-bold">{stats.pendingQC.toLocaleString()}</div>
            </div>
            <div className="text-sm font-semibold">Bekleyen Kontroller</div>
            <div className="text-xs text-white/70 mt-2">Adet bazında toplam</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="w-10 h-10" />
              <div className="text-3xl font-bold">{stats.approvedQC}</div>
            </div>
            <div className="text-sm font-semibold">Onaylanan Kontroller</div>
            <div className="text-xs text-white/70 mt-2">
              {stats.approvedQC + stats.rejectedQC > 0 &&
                `%${((stats.approvedQC / (stats.approvedQC + stats.rejectedQC)) * 100).toFixed(1)} Başarı Oranı`
              }
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-10 h-10" />
              <div className="text-3xl font-bold">{stats.rejectedQC}</div>
            </div>
            <div className="text-sm font-semibold">Reddedilen Kontroller</div>
            <div className="text-xs text-white/70 mt-2">İyileştirme gerekiyor</div>
          </div>
        </div>
      </div>
    </div>
  )
}

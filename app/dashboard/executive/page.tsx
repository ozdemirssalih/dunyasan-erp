'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  Factory, TrendingUp, Users, Activity, Award, Target,
  Wallet, Truck, Shield, AlertTriangle,
  Clock, ArrowUpRight, ArrowDownRight, Box, FolderKanban,
  ExternalLink, DollarSign, Wrench, BarChart3, Package,
  CheckCircle2, XCircle, Percent, Flame
} from 'lucide-react'

export default function ExecutiveDashboard() {
  const router = useRouter()
  const { isSuperAdmin, loading: permLoading } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [projects, setProjects] = useState<any[]>([])
  const [cashBalance, setCashBalance] = useState({ income: 0, expense: 0, balance: 0 })
  const [receivables, setReceivables] = useState({ total: 0, unpaid: 0, count: 0 })
  const [payables, setPayables] = useState({ total: 0, unpaid: 0, count: 0 })
  const [recentShipments, setRecentShipments] = useState<any[]>([])
  const [topEmployees, setTopEmployees] = useState<any[]>([])
  const [productionStats, setProductionStats] = useState({ total: 0, today: 0, week: 0, defects: 0, efficiency: 0, fireRate: 0 })
  const [warehouseStats, setWarehouseStats] = useState({ totalItems: 0, lowStock: 0, totalValue: 0, criticalItems: [] as any[] })
  const [qcStats, setQcStats] = useState({ pending: 0, approved: 0, rejected: 0, inQC: 0 })
  const [machineStats, setMachineStats] = useState({ active: 0, maintenance: 0, offline: 0, total: 0 })
  const [employeeCount, setEmployeeCount] = useState(0)
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [waybillStats, setWaybillStats] = useState({ pending: 0, completed: 0 })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      let cid = profile?.company_id
      if (!cid) {
        const { data: co } = await supabase.from('companies').select('id').limit(1).single()
        cid = co?.id
      }
      if (!cid) return
      setCompanyId(cid)

      await Promise.all([
        loadProjects(cid).catch(e => console.error('projects:', e)),
        loadFinance(cid).catch(e => console.error('finance:', e)),
        loadShipments(cid).catch(e => console.error('shipments:', e)),
        loadEmployees(cid).catch(e => console.error('employees:', e)),
        loadProduction(cid).catch(e => console.error('production:', e)),
        loadWarehouse(cid).catch(e => console.error('warehouse:', e)),
        loadQC(cid).catch(e => console.error('qc:', e)),
        loadMachines(cid).catch(e => console.error('machines:', e)),
        loadRecentActivities(cid).catch(e => console.error('activities:', e)),
        loadWaybills(cid).catch(e => console.error('waybills:', e)),
      ])
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const loadProjects = async (cid: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, project_name, project_code, status, last_calculated_total_cost, last_calculated_unit_cost, last_cost_calculation_date, customer_company:customer_companies(customer_name)')
      .eq('company_id', cid)
      .order('project_name')
    if (error || !data) return

    // Batch load ALL production data and machine counts in 2 queries
    const projectIds = data.map(p => p.id)
    const [allProdRes, allMachinesRes] = await Promise.all([
      supabase.from('machine_daily_production').select('project_id, actual_production, defect_count, efficiency_rate').in('project_id', projectIds),
      supabase.from('project_machines').select('project_id').in('project_id', projectIds)
    ])

    const prodByProject = new Map<string, any[]>()
    for (const r of allProdRes.data ?? []) {
      if (!prodByProject.has(r.project_id)) prodByProject.set(r.project_id, [])
      prodByProject.get(r.project_id)!.push(r)
    }
    const machineCountByProject = new Map<string, number>()
    for (const r of allMachinesRes.data ?? []) {
      machineCountByProject.set(r.project_id, (machineCountByProject.get(r.project_id) ?? 0) + 1)
    }

    const enriched = data.map(p => {
      const prod = prodByProject.get(p.id) ?? []
      const totalProd = prod.reduce((s, r) => s + (r.actual_production || 0), 0)
      const totalDefects = prod.reduce((s, r) => s + (r.defect_count || 0), 0)
      const avgEff = prod.length > 0 ? prod.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / prod.length : 0
      return {
        ...p, totalProduction: totalProd, totalDefects: totalDefects,
        avgEfficiency: Math.round(avgEff * 10) / 10, machineCount: machineCountByProject.get(p.id) || 0,
        customerName: (p as any).customer_company?.customer_name || null,
        fireRate: totalProd > 0 ? Math.round(totalDefects / totalProd * 1000) / 10 : 0,
      }
    })
    setProjects(enriched)
  }

  const loadFinance = async (cid: string) => {
    try {
      const { data: cash } = await supabase.from('cash_transactions').select('transaction_type, amount').eq('company_id', cid)
      const income = cash?.filter(c => c.transaction_type === 'income').reduce((s, c) => s + (c.amount || 0), 0) || 0
      const expense = cash?.filter(c => c.transaction_type === 'expense').reduce((s, c) => s + (c.amount || 0), 0) || 0
      setCashBalance({ income, expense, balance: income - expense })
    } catch { /* table might not exist */ }

    try {
      const { data: recv } = await supabase.from('current_account_transactions').select('amount, paid_amount, status').eq('company_id', cid).eq('transaction_type', 'receivable')
      const totalRecv = recv?.reduce((s, r) => s + (r.amount || 0), 0) || 0
      const unpaidRecv = recv?.filter(r => r.status !== 'paid').reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0) || 0
      setReceivables({ total: totalRecv, unpaid: unpaidRecv, count: recv?.filter(r => r.status !== 'paid').length || 0 })
    } catch { /* */ }

    try {
      const { data: pay } = await supabase.from('current_account_transactions').select('amount, paid_amount, status').eq('company_id', cid).eq('transaction_type', 'payable')
      const totalPay = pay?.reduce((s, r) => s + (r.amount || 0), 0) || 0
      const unpaidPay = pay?.filter(r => r.status !== 'paid').reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0) || 0
      setPayables({ total: totalPay, unpaid: unpaidPay, count: pay?.filter(r => r.status !== 'paid').length || 0 })
    } catch { /* */ }
  }

  const loadShipments = async (cid: string) => {
    const { data } = await supabase.from('warehouse_transactions')
      .select('id, type, quantity, supplier, shipment_destination, department_name, reference_number, notes, transaction_date, item_id')
      .eq('company_id', cid).order('created_at', { ascending: false }).limit(15)
    if (!data) return

    const itemIds = Array.from(new Set(data.map(t => t.item_id).filter(Boolean)))
    const { data: items } = itemIds.length ? await supabase.from('warehouse_items').select('id, name, code, unit').in('id', itemIds) : { data: [] }
    const itemMap = new Map((items ?? []).map(i => [i.id, i]))
    const withItems = data.map(t => {
      const item = itemMap.get(t.item_id)
      return { ...t, item_name: item?.name || '-', item_code: item?.code || '-', unit: item?.unit || '' }
    })
    setRecentShipments(withItems)
  }

  const loadEmployees = async (cid: string) => {
    const { data: emps } = await supabase.from('employees').select('id, full_name, department, position, status').eq('company_id', cid)
    setEmployeeCount(emps?.filter(e => e.status === 'active').length || 0)

    const { data: prodRecords } = await supabase.from('machine_daily_production').select('created_by, actual_production, defect_count').eq('company_id', cid)
    if (!prodRecords) return

    const byUser: Record<string, { total: number; defects: number; count: number }> = {}
    prodRecords.forEach(r => {
      if (!r.created_by) return
      if (!byUser[r.created_by]) byUser[r.created_by] = { total: 0, defects: 0, count: 0 }
      byUser[r.created_by].total += r.actual_production || 0
      byUser[r.created_by].defects += r.defect_count || 0
      byUser[r.created_by].count++
    })

    const sorted = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
    const topUserIds = sorted.map(([uid]) => uid)
    const { data: topProfiles } = topUserIds.length ? await supabase.from('profiles').select('id, full_name').in('id', topUserIds) : { data: [] }
    const nameMap = new Map((topProfiles ?? []).map(p => [p.id, p.full_name]))
    const topWithNames = sorted.map(([userId, stats]) => {
      return { name: nameMap.get(userId) || 'Bilinmiyor', ...stats, efficiency: stats.total > 0 ? Math.round((1 - stats.defects / stats.total) * 1000) / 10 : 0 }
    })
    setTopEmployees(topWithNames)
  }

  const loadProduction = async (cid: string) => {
    const { data: all } = await supabase.from('machine_daily_production').select('actual_production, defect_count, efficiency_rate, production_date').eq('company_id', cid)
    if (!all) return
    const total = all.reduce((s, r) => s + (r.actual_production || 0), 0)
    const defects = all.reduce((s, r) => s + (r.defect_count || 0), 0)
    const avgEff = all.length > 0 ? all.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / all.length : 0

    const today = new Date().toISOString().split('T')[0]
    const todayProd = all.filter(r => r.production_date === today).reduce((s, r) => s + (r.actual_production || 0), 0)

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().split('T')[0]
    const weekProd = all.filter(r => r.production_date >= weekStr).reduce((s, r) => s + (r.actual_production || 0), 0)

    setProductionStats({ total, today: todayProd, week: weekProd, defects, efficiency: Math.round(avgEff * 10) / 10, fireRate: total > 0 ? Math.round(defects / total * 1000) / 10 : 0 })
  }

  const loadWarehouse = async (cid: string) => {
    const { data } = await supabase.from('warehouse_items').select('id, code, name, current_stock, min_stock, unit_price, unit, is_active').eq('company_id', cid).eq('is_active', true)
    if (!data) return
    const lowStockItems = data.filter(i => i.current_stock <= (i.min_stock || 0) && i.min_stock > 0)
    setWarehouseStats({
      totalItems: data.length,
      lowStock: lowStockItems.length,
      totalValue: data.reduce((s, i) => s + (i.current_stock * (i.unit_price || 0)), 0),
      criticalItems: lowStockItems.slice(0, 5).map(i => ({ name: i.name, code: i.code, stock: i.current_stock, min: i.min_stock, unit: i.unit })),
    })
  }

  const loadQC = async (cid: string) => {
    try {
      const { data: qcInv } = await supabase.from('quality_control_inventory').select('current_stock').eq('company_id', cid)
      const inQC = qcInv?.reduce((s, r) => s + (r.current_stock || 0), 0) || 0
      const { data: transfers } = await supabase.from('production_to_qc_transfers').select('status').eq('company_id', cid)
      setQcStats({
        pending: transfers?.filter(t => t.status === 'pending').length || 0,
        approved: transfers?.filter(t => t.status === 'approved').length || 0,
        rejected: transfers?.filter(t => t.status === 'rejected').length || 0,
        inQC,
      })
    } catch { /* */ }
  }

  const loadMachines = async (cid: string) => {
    const { data } = await supabase.from('machines').select('status').eq('company_id', cid)
    if (!data) return
    setMachineStats({
      active: data.filter(m => m.status === 'active').length,
      maintenance: data.filter(m => m.status === 'maintenance').length,
      offline: data.filter(m => m.status === 'offline').length,
      total: data.length,
    })
  }

  const loadWaybills = async (cid: string) => {
    try {
      const { data } = await supabase.from('waybills').select('status').eq('company_id', cid)
      if (!data) return
      setWaybillStats({
        pending: data.filter(w => w.status === 'pending').length,
        completed: data.filter(w => w.status === 'completed').length,
      })
    } catch { /* */ }
  }

  const loadRecentActivities = async (cid: string) => {
    const activities: any[] = []

    const { data: prod } = await supabase.from('machine_daily_production')
      .select('actual_production, defect_count, production_date, machine_id, project_id')
      .eq('company_id', cid).order('created_at', { ascending: false }).limit(5)

    if (prod) {
      const machineIds = Array.from(new Set(prod.map(p => p.machine_id).filter(Boolean)))
      const projectIds2 = Array.from(new Set(prod.map(p => p.project_id).filter(Boolean)))
      const [machinesRes, projectsRes] = await Promise.all([
        machineIds.length ? supabase.from('machines').select('id, machine_name').in('id', machineIds) : Promise.resolve({ data: [] }),
        projectIds2.length ? supabase.from('projects').select('id, project_name').in('id', projectIds2) : Promise.resolve({ data: [] })
      ])
      const mMap = new Map(((machinesRes as any).data ?? []).map((m: any) => [m.id, m.machine_name]))
      const pMap = new Map(((projectsRes as any).data ?? []).map((p: any) => [p.id, p.project_name]))
      for (const p of prod) {
        activities.push({ type: 'production', text: `${mMap.get(p.machine_id) || '?'} - ${pMap.get(p.project_id) || '?'}: ${p.actual_production} adet${p.defect_count > 0 ? ` (${p.defect_count} fire)` : ''}`, date: p.production_date })
      }
    }

    const { data: txns } = await supabase.from('warehouse_transactions')
      .select('type, quantity, supplier, shipment_destination, transaction_date, item_id')
      .eq('company_id', cid).order('created_at', { ascending: false }).limit(5)

    if (txns) {
      const txnItemIds = Array.from(new Set(txns.map(t => t.item_id).filter(Boolean)))
      const { data: txnItems } = txnItemIds.length ? await supabase.from('warehouse_items').select('id, name').in('id', txnItemIds) : { data: [] }
      const iMap = new Map((txnItems ?? []).map(i => [i.id, i.name]))
      for (const s of txns) {
        const dest = s.shipment_destination || s.supplier || ''
        activities.push({ type: s.type, text: `${iMap.get(s.item_id) || '?'} - ${s.quantity} adet ${s.type === 'entry' ? 'giriş' : s.type === 'exit' ? `sevk${dest ? ' → ' + dest : ''}` : 'hurda'}`, date: s.transaction_date })
      }
    }

    try {
      const { data: qcActs } = await supabase.from('qc_to_warehouse_transfers')
        .select('quantity, quality_result, requested_at, item:warehouse_items(name)')
        .eq('company_id', cid).order('requested_at', { ascending: false }).limit(3)
      if (qcActs) {
        for (const q of qcActs) {
          const result = q.quality_result === 'passed' ? 'geçti' : q.quality_result === 'return' ? 'iade' : q.quality_result === 'scrap' ? 'hurda' : 'kaldı'
          activities.push({ type: 'qc', text: `KK: ${(q as any).item?.name || '?'} - ${q.quantity} adet ${result}`, date: q.requested_at })
        }
      }
    } catch { /* */ }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setRecentActivities(activities.slice(0, 12))
  }

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)
  const fmtN = (n: number) => new Intl.NumberFormat('tr-TR').format(n)

  if (loading || permLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Yönetim Dashboard yükleniyor...</p>
      </div>
    </div>
  )

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Erişim Engellendi</h2>
          <p className="text-gray-600 mb-6">Bu sayfayı sadece Super Admin yetkisine sahip kullanıcılar görüntüleyebilir.</p>
          <button onClick={() => router.push('/dashboard')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold">Ana Dashboard'a Dön</button>
        </div>
      </div>
    )
  }

  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const totalProjectCost = projects.reduce((s, p) => s + (p.last_calculated_total_cost || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><Activity className="w-8 h-8" /> YÖNETİM DASHBOARD</h1>
            <p className="text-slate-300 mt-2">Tüm sistemin genel görünümü</p>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-lg font-bold text-white mt-1">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* Finansal KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div onClick={() => router.push('/dashboard/accounting')} className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg"><Wallet className="w-5 h-5 text-green-600" /></div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">KASA</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(cashBalance.balance)}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{fmt(cashBalance.income)}</span>
            <span className="text-red-600 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" />{fmt(cashBalance.expense)}</span>
          </div>
        </div>

        <div onClick={() => router.push('/dashboard/accounting')} className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg"><ArrowUpRight className="w-5 h-5 text-blue-600" /></div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">ALACAKLAR</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmt(receivables.unpaid)}</p>
          <p className="text-xs text-gray-500 mt-2">{receivables.count} açık fatura • Toplam: {fmt(receivables.total)}</p>
        </div>

        <div onClick={() => router.push('/dashboard/accounting')} className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 rounded-lg"><ArrowDownRight className="w-5 h-5 text-red-600" /></div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">BORÇLAR</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(payables.unpaid)}</p>
          <p className="text-xs text-gray-500 mt-2">{payables.count} açık borç • Toplam: {fmt(payables.total)}</p>
        </div>

        <div onClick={() => router.push('/dashboard/warehouse')} className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Box className="w-5 h-5 text-purple-600" /></div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">DEPO</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{fmt(warehouseStats.totalValue)}</p>
          <p className="text-xs text-gray-500 mt-2">{warehouseStats.totalItems} kalem • {warehouseStats.lowStock > 0 ? <span className="text-red-600 font-semibold">{warehouseStats.lowStock} kritik stok</span> : 'Stoklar yeterli'}</p>
        </div>
      </div>

      {/* Operasyonel KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <div onClick={() => router.push('/dashboard/production')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Factory className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-blue-600">{fmtN(productionStats.total)}</p>
          <p className="text-[10px] text-gray-500">Toplam Üretim</p>
        </div>
        <div onClick={() => router.push('/dashboard/daily-production')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Target className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-600">{fmtN(productionStats.today)}</p>
          <p className="text-[10px] text-gray-500">Bugün</p>
        </div>
        <div onClick={() => router.push('/dashboard/daily-production')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <BarChart3 className="w-5 h-5 text-cyan-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-cyan-600">{fmtN(productionStats.week)}</p>
          <p className="text-[10px] text-gray-500">Bu Hafta</p>
        </div>
        <div onClick={() => router.push('/dashboard/management')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <TrendingUp className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-indigo-600">%{productionStats.efficiency}</p>
          <p className="text-[10px] text-gray-500">Verimlilik</p>
        </div>
        <div onClick={() => router.push('/dashboard/management')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Flame className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-500">%{productionStats.fireRate}</p>
          <p className="text-[10px] text-gray-500">Fire Oranı</p>
        </div>
        <div onClick={() => router.push('/dashboard/machines')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Wrench className="w-5 h-5 text-gray-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-600">{machineStats.active}<span className="text-sm text-gray-400">/{machineStats.total}</span></p>
          <p className="text-[10px] text-gray-500">Tezgah</p>
        </div>
        <div onClick={() => router.push('/dashboard/employees')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Users className="w-5 h-5 text-teal-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-teal-600">{employeeCount}</p>
          <p className="text-[10px] text-gray-500">Personel</p>
        </div>
        <div onClick={() => router.push('/dashboard/quality-control')} className="bg-white rounded-xl shadow-sm border p-3 text-center cursor-pointer hover:shadow-md transition-all">
          <Shield className="w-5 h-5 text-orange-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-orange-600">{qcStats.inQC}</p>
          <p className="text-[10px] text-gray-500">KK Bekleyen</p>
        </div>
      </div>

      {/* Projeler + Çalışanlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div onClick={() => router.push('/dashboard/projects')} className="p-5 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><FolderKanban className="w-5 h-5" /> Projeler</h2>
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{activeProjects.length} aktif</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{completedProjects.length} tamamlanan</span>
              {totalProjectCost > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-semibold">Toplam: {totalProjectCost.toFixed(0)} €</span>}
            </div>
          </div>
          <div className="p-5 max-h-[500px] overflow-y-auto">
            {projects.length === 0 ? <p className="text-gray-400 text-center py-8">Henüz proje yok</p> : (
              <div className="space-y-3">
                {projects.map(p => (
                  <div key={p.id} onClick={() => router.push(`/dashboard/projects/${p.id}`)} className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${p.status === 'completed' ? 'bg-green-500' : p.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{p.project_name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {p.project_code && <span>{p.project_code}</span>}
                            {p.customerName && <span>• {p.customerName}</span>}
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      <div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-gray-500">Üretim</p><p className="font-bold text-sm">{fmtN(p.totalProduction)}</p></div>
                      <div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-gray-500">Fire</p><p className="font-bold text-sm text-red-600">{p.totalDefects}</p></div>
                      <div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-gray-500">Verimlilik</p><p className="font-bold text-sm text-indigo-600">%{p.avgEfficiency}</p></div>
                      <div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-gray-500">Fire %</p><p className="font-bold text-sm text-orange-600">%{p.fireRate}</p></div>
                      <div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-gray-500">Tezgah</p><p className="font-bold text-sm">{p.machineCount}</p></div>
                    </div>
                    {p.last_calculated_total_cost && (
                      <div className="mt-2 bg-blue-50 rounded-lg p-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-blue-700"><DollarSign className="w-3 h-3" />Toplam: <strong>{p.last_calculated_total_cost?.toFixed(2)} €</strong></span>
                        {p.last_calculated_unit_cost && <span className="text-xs text-blue-600">Birim: {p.last_calculated_unit_cost?.toFixed(4)} €</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Çalışanlar + KK Özet */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div onClick={() => router.push('/dashboard/employees')} className="p-5 border-b cursor-pointer hover:bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-500" /> En Verimli Çalışanlar</h2>
            </div>
            <div className="p-5">
              {topEmployees.length === 0 ? <p className="text-gray-400 text-center py-6 text-sm">Veri yok</p> : (
                <div className="space-y-3">
                  {topEmployees.map((emp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-500">{fmtN(emp.total)} üretim • {emp.count} gün • %{emp.efficiency} kalite</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KK Detay */}
          <div onClick={() => router.push('/dashboard/quality-control')} className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Shield className="w-5 h-5 text-orange-500" /> Kalite Kontrol</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-yellow-50 rounded-lg p-3 text-center"><p className="text-xs text-yellow-700">KK Deposu</p><p className="text-xl font-bold text-yellow-800">{qcStats.inQC}</p></div>
              <div className="bg-orange-50 rounded-lg p-3 text-center"><p className="text-xs text-orange-700">Onay Bekleyen</p><p className="text-xl font-bold text-orange-800">{qcStats.pending}</p></div>
              <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-xs text-green-700">Onaylanan</p><p className="text-xl font-bold text-green-800">{qcStats.approved}</p></div>
              <div className="bg-red-50 rounded-lg p-3 text-center"><p className="text-xs text-red-700">Reddedilen</p><p className="text-xl font-bold text-red-800">{qcStats.rejected}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Alt Bölüm */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Son Hareketler */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b"><h2 className="font-bold text-gray-800 flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-500" /> Son Depo Hareketleri</h2></div>
          <div className="p-5 max-h-[400px] overflow-y-auto">
            {recentShipments.length === 0 ? <p className="text-gray-400 text-center py-8">Henüz hareket yok</p> : (
              <div className="space-y-2">
                {recentShipments.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${s.type === 'entry' ? 'bg-green-500' : s.type === 'exit' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="font-semibold text-gray-800">{s.item_name} <span className="text-gray-400 font-normal">({s.item_code})</span></p>
                        <p className="text-xs text-gray-500">{s.type === 'entry' ? 'Giriş' : s.type === 'exit' ? 'Çıkış/Sevk' : 'Hurda'} • {s.shipment_destination || s.department_name || s.supplier || '-'} • {s.reference_number || '-'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${s.type === 'entry' ? 'text-green-700' : 'text-red-700'}`}>{s.type === 'entry' ? '+' : '-'}{s.quantity} {s.unit}</p>
                      <p className="text-xs text-gray-500">{new Date(s.transaction_date).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aktivite Log */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b"><h2 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-500" /> Son Aktiviteler</h2></div>
          <div className="p-5 max-h-[400px] overflow-y-auto">
            {recentActivities.length === 0 ? <p className="text-gray-400 text-center py-8 text-sm">Henüz aktivite yok</p> : (
              <div className="space-y-2">
                {recentActivities.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg text-xs">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'production' ? 'bg-blue-500' : a.type === 'entry' ? 'bg-green-500' : a.type === 'exit' ? 'bg-red-500' : a.type === 'qc' ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                    <div className="flex-1"><p className="text-gray-700">{a.text}</p></div>
                    <p className="text-gray-400 whitespace-nowrap">{new Date(a.date).toLocaleDateString('tr-TR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kritik Stoklar */}
      {warehouseStats.criticalItems.length > 0 && (
        <div onClick={() => router.push('/dashboard/warehouse')} className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 cursor-pointer hover:bg-red-100 transition-all">
          <h2 className="font-bold text-red-800 flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5" /> Kritik Stok Seviyeleri</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {warehouseStats.criticalItems.map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-red-100">
                <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">{item.code}</p>
                <p className="text-sm mt-1"><span className="text-red-600 font-bold">{item.stock}</span> / <span className="text-gray-500">{item.min} {item.unit}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uyarılar */}
      {(qcStats.pending > 0 || machineStats.maintenance > 0 || machineStats.offline > 0 || waybillStats.pending > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-bold text-amber-800 flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5" /> Dikkat</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {qcStats.pending > 0 && <p className="text-amber-700 flex items-center gap-2"><Shield className="w-4 h-4" />{qcStats.pending} kalite kontrol onayı bekliyor</p>}
            {machineStats.maintenance > 0 && <p className="text-amber-700 flex items-center gap-2"><Wrench className="w-4 h-4" />{machineStats.maintenance} tezgah bakımda</p>}
            {machineStats.offline > 0 && <p className="text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" />{machineStats.offline} tezgah devre dışı</p>}
            {waybillStats.pending > 0 && <p className="text-amber-700 flex items-center gap-2"><Truck className="w-4 h-4" />{waybillStats.pending} bekleyen irsaliye</p>}
          </div>
        </div>
      )}
    </div>
  )
}

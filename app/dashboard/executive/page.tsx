'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Factory, Package, TrendingUp, Users, Activity, Award, Target,
  BarChart3, Wallet, Truck, Shield, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, Box, FolderKanban
} from 'lucide-react'

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Data states
  const [projects, setProjects] = useState<any[]>([])
  const [cashBalance, setCashBalance] = useState({ income: 0, expense: 0, balance: 0 })
  const [receivables, setReceivables] = useState({ total: 0, unpaid: 0 })
  const [payables, setPayables] = useState({ total: 0, unpaid: 0 })
  const [recentShipments, setRecentShipments] = useState<any[]>([])
  const [topEmployees, setTopEmployees] = useState<any[]>([])
  const [productionStats, setProductionStats] = useState({ total: 0, today: 0, defects: 0, efficiency: 0 })
  const [warehouseStats, setWarehouseStats] = useState({ totalItems: 0, lowStock: 0, totalValue: 0 })
  const [qcStats, setQcStats] = useState({ pending: 0, approved: 0, rejected: 0, inQC: 0 })
  const [machineStats, setMachineStats] = useState({ active: 0, maintenance: 0, offline: 0 })
  const [employeeCount, setEmployeeCount] = useState(0)
  const [recentActivities, setRecentActivities] = useState<any[]>([])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      let cid = profile?.company_id
      if (!cid) {
        const { data: company } = await supabase.from('companies').select('id').limit(1).single()
        cid = company?.id
      }
      if (!cid) return
      setCompanyId(cid)

      await Promise.all([
        loadProjects(cid),
        loadFinance(cid),
        loadShipments(cid),
        loadEmployees(cid),
        loadProduction(cid),
        loadWarehouse(cid),
        loadQC(cid),
        loadMachines(cid),
        loadRecentActivities(cid),
      ])
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async (cid: string) => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_name, project_code, status')
      .eq('company_id', cid)
      .order('project_name')

    if (data) {
      const projectsWithProduction = await Promise.all(data.map(async (p) => {
        const { data: prod } = await supabase
          .from('machine_daily_production')
          .select('actual_production, defect_count')
          .eq('project_id', p.id)
        const totalProd = prod?.reduce((s, r) => s + (r.actual_production || 0), 0) || 0
        const totalDefects = prod?.reduce((s, r) => s + (r.defect_count || 0), 0) || 0
        return { ...p, totalProduction: totalProd, totalDefects: totalDefects }
      }))
      setProjects(projectsWithProduction)
    }
  }

  const loadFinance = async (cid: string) => {
    // Cash transactions
    const { data: cash } = await supabase.from('cash_transactions').select('transaction_type, amount').eq('company_id', cid)
    const income = cash?.filter(c => c.transaction_type === 'income').reduce((s, c) => s + (c.amount || 0), 0) || 0
    const expense = cash?.filter(c => c.transaction_type === 'expense').reduce((s, c) => s + (c.amount || 0), 0) || 0
    setCashBalance({ income, expense, balance: income - expense })

    // Receivables
    const { data: recv } = await supabase.from('current_account_transactions').select('amount, paid_amount, status').eq('company_id', cid).eq('transaction_type', 'receivable')
    const totalRecv = recv?.reduce((s, r) => s + (r.amount || 0), 0) || 0
    const unpaidRecv = recv?.filter(r => r.status !== 'paid').reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0) || 0
    setReceivables({ total: totalRecv, unpaid: unpaidRecv })

    // Payables
    const { data: pay } = await supabase.from('current_account_transactions').select('amount, paid_amount, status').eq('company_id', cid).eq('transaction_type', 'payable')
    const totalPay = pay?.reduce((s, r) => s + (r.amount || 0), 0) || 0
    const unpaidPay = pay?.filter(r => r.status !== 'paid').reduce((s, r) => s + ((r.amount || 0) - (r.paid_amount || 0)), 0) || 0
    setPayables({ total: totalPay, unpaid: unpaidPay })
  }

  const loadShipments = async (cid: string) => {
    const { data } = await supabase
      .from('warehouse_transactions')
      .select('id, type, quantity, supplier, shipment_destination, reference_number, notes, transaction_date, item_id')
      .eq('company_id', cid)
      .eq('type', 'exit')
      .order('transaction_date', { ascending: false })
      .limit(10)

    if (data) {
      const withItems = await Promise.all(data.map(async (t) => {
        const { data: item } = await supabase.from('warehouse_items').select('name, code, unit').eq('id', t.item_id).single()
        return { ...t, item_name: item?.name || '-', item_code: item?.code || '-', unit: item?.unit || '' }
      }))
      setRecentShipments(withItems)
    }
  }

  const loadEmployees = async (cid: string) => {
    const { data: emps } = await supabase.from('employees').select('id, full_name, department, position, status').eq('company_id', cid)
    setEmployeeCount(emps?.filter(e => e.status === 'active').length || 0)

    // Top employees by production (via profiles who created daily production records)
    const { data: prodRecords } = await supabase
      .from('machine_daily_production')
      .select('created_by, actual_production, defect_count')
      .eq('company_id', cid)

    if (prodRecords) {
      const byUser: Record<string, { total: number; defects: number; count: number }> = {}
      prodRecords.forEach(r => {
        if (!r.created_by) return
        if (!byUser[r.created_by]) byUser[r.created_by] = { total: 0, defects: 0, count: 0 }
        byUser[r.created_by].total += r.actual_production || 0
        byUser[r.created_by].defects += r.defect_count || 0
        byUser[r.created_by].count++
      })

      const sorted = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      const topWithNames = await Promise.all(sorted.map(async ([userId, stats]) => {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
        return { name: profile?.full_name || 'Bilinmiyor', ...stats }
      }))
      setTopEmployees(topWithNames)
    }
  }

  const loadProduction = async (cid: string) => {
    const { data: all } = await supabase.from('machine_daily_production').select('actual_production, defect_count, efficiency_rate, production_date').eq('company_id', cid)
    const total = all?.reduce((s, r) => s + (r.actual_production || 0), 0) || 0
    const defects = all?.reduce((s, r) => s + (r.defect_count || 0), 0) || 0
    const avgEff = all && all.length > 0 ? all.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / all.length : 0

    const today = new Date().toISOString().split('T')[0]
    const todayProd = all?.filter(r => r.production_date === today).reduce((s, r) => s + (r.actual_production || 0), 0) || 0

    setProductionStats({ total, today: todayProd, defects, efficiency: Math.round(avgEff * 10) / 10 })
  }

  const loadWarehouse = async (cid: string) => {
    const { data } = await supabase.from('warehouse_items').select('current_stock, min_stock, unit_price, is_active').eq('company_id', cid).eq('is_active', true)
    const totalItems = data?.length || 0
    const lowStock = data?.filter(i => i.current_stock <= i.min_stock).length || 0
    const totalValue = data?.reduce((s, i) => s + (i.current_stock * (i.unit_price || 0)), 0) || 0
    setWarehouseStats({ totalItems, lowStock, totalValue })
  }

  const loadQC = async (cid: string) => {
    const { data: qcInv } = await supabase.from('quality_control_inventory').select('current_stock').eq('company_id', cid)
    const inQC = qcInv?.reduce((s, r) => s + (r.current_stock || 0), 0) || 0

    const { data: transfers } = await supabase.from('production_to_qc_transfers').select('status').eq('company_id', cid)
    const pending = transfers?.filter(t => t.status === 'pending').length || 0
    const approved = transfers?.filter(t => t.status === 'approved').length || 0
    const rejected = transfers?.filter(t => t.status === 'rejected').length || 0

    setQcStats({ pending, approved, rejected, inQC })
  }

  const loadMachines = async (cid: string) => {
    const { data } = await supabase.from('machines').select('status').eq('company_id', cid)
    setMachineStats({
      active: data?.filter(m => m.status === 'active').length || 0,
      maintenance: data?.filter(m => m.status === 'maintenance').length || 0,
      offline: data?.filter(m => m.status === 'offline').length || 0,
    })
  }

  const loadRecentActivities = async (cid: string) => {
    const { data: prod } = await supabase
      .from('machine_daily_production')
      .select('actual_production, production_date, machine_id, project_id')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
      .limit(5)

    const activities: any[] = []
    if (prod) {
      for (const p of prod) {
        const { data: machine } = await supabase.from('machines').select('machine_name').eq('id', p.machine_id).single()
        const { data: project } = await supabase.from('projects').select('project_name').eq('id', p.project_id).single()
        activities.push({
          type: 'production',
          text: `${machine?.machine_name || '?'} - ${project?.project_name || '?'}: ${p.actual_production} adet üretim`,
          date: p.production_date,
        })
      }
    }

    const { data: shipments } = await supabase
      .from('warehouse_transactions')
      .select('type, quantity, supplier, shipment_destination, transaction_date, item_id')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
      .limit(5)

    if (shipments) {
      for (const s of shipments) {
        const { data: item } = await supabase.from('warehouse_items').select('name').eq('id', s.item_id).single()
        activities.push({
          type: s.type,
          text: `${item?.name || '?'} - ${s.quantity} adet ${s.type === 'entry' ? 'giriş' : s.type === 'exit' ? 'çıkış (sevk)' : 'hurda'}`,
          date: s.transaction_date,
        })
      }
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setRecentActivities(activities.slice(0, 10))
  }

  const formatMoney = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)
  const formatNumber = (n: number) => new Intl.NumberFormat('tr-TR').format(n)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yönetim Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="w-8 h-8" />
              YÖNETİM DASHBOARD
            </h1>
            <p className="text-slate-300 mt-2">Tüm sistemin genel görünümü</p>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-lg font-bold text-white mt-1">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* KPI Row 1 - Finansal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg"><Wallet className="w-5 h-5 text-green-600" /></div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">KASA</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(cashBalance.balance)}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{formatMoney(cashBalance.income)}</span>
            <span className="text-red-600 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" />{formatMoney(cashBalance.expense)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg"><ArrowUpRight className="w-5 h-5 text-blue-600" /></div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">ALACAKLAR</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(receivables.unpaid)}</p>
          <p className="text-xs text-gray-500 mt-2">Toplam: {formatMoney(receivables.total)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 rounded-lg"><ArrowDownRight className="w-5 h-5 text-red-600" /></div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">BORÇLAR</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(payables.unpaid)}</p>
          <p className="text-xs text-gray-500 mt-2">Toplam: {formatMoney(payables.total)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Box className="w-5 h-5 text-purple-600" /></div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">DEPO DEĞER</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(warehouseStats.totalValue)}</p>
          <p className="text-xs text-gray-500 mt-2">{warehouseStats.totalItems} kalem stok</p>
        </div>
      </div>

      {/* KPI Row 2 - Operasyonel */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <Factory className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold">{formatNumber(productionStats.total)}</p>
          <p className="text-xs text-gray-500">Toplam Üretim</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold">{formatNumber(productionStats.today)}</p>
          <p className="text-xs text-gray-500">Bugün Üretim</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <TrendingUp className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
          <p className="text-2xl font-bold">%{productionStats.efficiency}</p>
          <p className="text-xs text-gray-500">Verimlilik</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <Settings className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{machineStats.active}</p>
          <p className="text-xs text-gray-500">Aktif Tezgah</p>
          {machineStats.maintenance > 0 && <p className="text-xs text-yellow-600 mt-1">{machineStats.maintenance} bakımda</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <Users className="w-6 h-6 text-teal-600 mx-auto mb-2" />
          <p className="text-2xl font-bold">{employeeCount}</p>
          <p className="text-xs text-gray-500">Aktif Personel</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <Shield className="w-6 h-6 text-orange-600 mx-auto mb-2" />
          <p className="text-2xl font-bold">{qcStats.inQC}</p>
          <p className="text-xs text-gray-500">KK Bekleyen</p>
          {qcStats.pending > 0 && <p className="text-xs text-yellow-600 mt-1">{qcStats.pending} onay bekliyor</p>}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Projeler */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><FolderKanban className="w-5 h-5" /> Projeler</h2>
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{activeProjects.length} aktif</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{completedProjects.length} tamamlanan</span>
            </div>
          </div>
          <div className="p-5">
            {projects.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Henüz proje yok</p>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${p.status === 'completed' ? 'bg-green-500' : p.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{p.project_name}</p>
                        <p className="text-xs text-gray-500">{p.project_code || ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{formatNumber(p.totalProduction)} üretim</p>
                      {p.totalDefects > 0 && <p className="text-xs text-red-500">{p.totalDefects} fire</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* En Verimli Çalışanlar */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-500" /> En Verimli Çalışanlar</h2>
          </div>
          <div className="p-5">
            {topEmployees.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Veri yok</p>
            ) : (
              <div className="space-y-3">
                {topEmployees.map((emp, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-800">{emp.name}</p>
                      <p className="text-xs text-gray-500">{formatNumber(emp.total)} üretim, {emp.count} gün</p>
                    </div>
                    {emp.defects > 0 && <span className="text-xs text-red-500">{emp.defects} fire</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Son Sevkiyatlar */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-500" /> Son Sevkiyat Hareketleri</h2>
          </div>
          <div className="p-5">
            {recentShipments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Henüz sevkiyat yok</p>
            ) : (
              <div className="space-y-2">
                {recentShipments.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                    <div>
                      <p className="font-semibold text-gray-800">{s.item_name}</p>
                      <p className="text-xs text-gray-500">{s.shipment_destination || s.supplier || '-'} • {s.reference_number || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{s.quantity} {s.unit}</p>
                      <p className="text-xs text-gray-500">{new Date(s.transaction_date).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Son Hareketler */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-500" /> Son Hareketler</h2>
          </div>
          <div className="p-5">
            {recentActivities.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Henüz hareket yok</p>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-sm">
                    <div className={`w-2 h-2 rounded-full ${a.type === 'production' ? 'bg-blue-500' : a.type === 'entry' ? 'bg-green-500' : a.type === 'exit' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                    <div className="flex-1">
                      <p className="text-gray-800">{a.text}</p>
                    </div>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{new Date(a.date).toLocaleDateString('tr-TR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {(warehouseStats.lowStock > 0 || qcStats.pending > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-bold text-amber-800 flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5" /> Dikkat Edilmesi Gerekenler</h2>
          <div className="space-y-2 text-sm">
            {warehouseStats.lowStock > 0 && (
              <p className="text-amber-700">{warehouseStats.lowStock} kalem stok kritik seviyenin altında</p>
            )}
            {qcStats.pending > 0 && (
              <p className="text-amber-700">{qcStats.pending} adet kalite kontrol onayı bekliyor</p>
            )}
            {machineStats.maintenance > 0 && (
              <p className="text-amber-700">{machineStats.maintenance} tezgah bakımda</p>
            )}
            {machineStats.offline > 0 && (
              <p className="text-amber-700">{machineStats.offline} tezgah devre dışı</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

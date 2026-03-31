'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  BarChart3, Factory, Package, Wallet, Users, Shield, Truck,
  Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

type Period = 'today' | 'week' | 'month' | 'custom'
type ReportTab = 'overview' | 'production' | 'warehouse' | 'finance' | 'quality' | 'employees'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [period, setPeriod] = useState<Period>('month')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  // Data
  const [productionData, setProductionData] = useState<any>({ total: 0, defects: 0, efficiency: 0, byProject: [], byMachine: [], daily: [] })
  const [warehouseData, setWarehouseData] = useState<any>({ entries: 0, exits: 0, scrap: 0, entryValue: 0, exitValue: 0, topItems: [], movements: [] })
  const [financeData, setFinanceData] = useState<any>({ income: 0, expense: 0, balance: 0, receivables: 0, payables: 0, byAccount: [], recentCash: [] })
  const [qcData, setQcData] = useState<any>({ passed: 0, failed: 0, returned: 0, scrap: 0, pending: 0 })
  const [employeeData, setEmployeeData] = useState<any>({ total: 0, active: 0, topProducers: [] })

  useEffect(() => { init() }, [])
  useEffect(() => { if (companyId) loadAll() }, [companyId, dateFrom, dateTo])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    setCompanyId(profile?.company_id || null)
  }

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
    const now = new Date()
    const to = now.toISOString().split('T')[0]
    setDateTo(to)
    if (p === 'today') { setDateFrom(to) }
    else if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]) }
    else if (p === 'month') { const d = new Date(); d.setDate(d.getDate() - 30); setDateFrom(d.toISOString().split('T')[0]) }
  }

  const loadAll = async () => {
    if (!companyId) return
    setLoading(true)
    await Promise.all([
      loadProduction().catch(() => {}),
      loadWarehouse().catch(() => {}),
      loadFinance().catch(() => {}),
      loadQC().catch(() => {}),
      loadEmployees().catch(() => {}),
    ])
    setLoading(false)
  }

  const loadProduction = async () => {
    const { data } = await supabase.from('machine_daily_production')
      .select('actual_production, defect_count, efficiency_rate, production_date, project_id, machine_id')
      .eq('company_id', companyId!)
      .gte('production_date', dateFrom)
      .lte('production_date', dateTo)

    if (!data) return
    const total = data.reduce((s, r) => s + (r.actual_production || 0), 0)
    const defects = data.reduce((s, r) => s + (r.defect_count || 0), 0)
    const avgEff = data.length > 0 ? data.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / data.length : 0

    // Proje bazlı
    const byProject: Record<string, { total: number; defects: number }> = {}
    data.forEach(r => {
      if (!byProject[r.project_id]) byProject[r.project_id] = { total: 0, defects: 0 }
      byProject[r.project_id].total += r.actual_production || 0
      byProject[r.project_id].defects += r.defect_count || 0
    })
    const projectEntries = await Promise.all(Object.entries(byProject).map(async ([pid, stats]) => {
      const { data: p } = await supabase.from('projects').select('project_name').eq('id', pid).maybeSingle()
      return { name: p?.project_name || '?', ...stats }
    }))

    // Tezgah bazlı
    const byMachine: Record<string, { total: number; defects: number }> = {}
    data.forEach(r => {
      if (!byMachine[r.machine_id]) byMachine[r.machine_id] = { total: 0, defects: 0 }
      byMachine[r.machine_id].total += r.actual_production || 0
      byMachine[r.machine_id].defects += r.defect_count || 0
    })
    const machineEntries = await Promise.all(Object.entries(byMachine).map(async ([mid, stats]) => {
      const { data: m } = await supabase.from('machines').select('machine_name').eq('id', mid).maybeSingle()
      return { name: m?.machine_name || '?', ...stats }
    }))

    // Günlük
    const dailyMap: Record<string, { total: number; defects: number }> = {}
    data.forEach(r => {
      if (!dailyMap[r.production_date]) dailyMap[r.production_date] = { total: 0, defects: 0 }
      dailyMap[r.production_date].total += r.actual_production || 0
      dailyMap[r.production_date].defects += r.defect_count || 0
    })
    const daily = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, stats]) => ({ date, ...stats }))

    setProductionData({
      total, defects, efficiency: Math.round(avgEff * 10) / 10,
      byProject: projectEntries.sort((a, b) => b.total - a.total),
      byMachine: machineEntries.sort((a, b) => b.total - a.total),
      daily
    })
  }

  const loadWarehouse = async () => {
    const { data } = await supabase.from('warehouse_transactions')
      .select('type, quantity, item_id')
      .eq('company_id', companyId!)
      .gte('transaction_date', dateFrom)
      .lte('transaction_date', dateTo)

    if (!data) return
    const entries = data.filter(d => d.type === 'entry').reduce((s, d) => s + (d.quantity || 0), 0)
    const exits = data.filter(d => d.type === 'exit').reduce((s, d) => s + (d.quantity || 0), 0)
    const scrap = data.filter(d => d.type === 'scrap').reduce((s, d) => s + (d.quantity || 0), 0)

    // En çok hareket gören ürünler
    const itemCounts: Record<string, { entry: number; exit: number }> = {}
    data.forEach(d => {
      if (!itemCounts[d.item_id]) itemCounts[d.item_id] = { entry: 0, exit: 0 }
      if (d.type === 'entry') itemCounts[d.item_id].entry += d.quantity || 0
      else if (d.type === 'exit') itemCounts[d.item_id].exit += d.quantity || 0
    })
    const topItems = await Promise.all(
      Object.entries(itemCounts).sort((a, b) => (b[1].entry + b[1].exit) - (a[1].entry + a[1].exit)).slice(0, 10)
        .map(async ([iid, stats]) => {
          const { data: item } = await supabase.from('warehouse_items').select('name, code').eq('id', iid).maybeSingle()
          return { name: item?.name || '?', code: item?.code || '', ...stats }
        })
    )

    setWarehouseData({ entries, exits, scrap, entryValue: 0, exitValue: 0, topItems, movements: data.length })
  }

  const loadFinance = async () => {
    const { data: cash } = await supabase.from('cash_transactions')
      .select('transaction_type, amount, cash_account_id')
      .eq('company_id', companyId!)
      .gte('transaction_date', dateFrom + 'T00:00:00')
      .lte('transaction_date', dateTo + 'T23:59:59')

    const income = cash?.filter(c => c.transaction_type === 'income').reduce((s, c) => s + (c.amount || 0), 0) || 0
    const expense = cash?.filter(c => c.transaction_type === 'expense').reduce((s, c) => s + (c.amount || 0), 0) || 0

    // Kasa bazlı
    const byAccountMap: Record<string, { income: number; expense: number }> = {}
    cash?.forEach(c => {
      const aid = c.cash_account_id || 'other'
      if (!byAccountMap[aid]) byAccountMap[aid] = { income: 0, expense: 0 }
      if (c.transaction_type === 'income') byAccountMap[aid].income += c.amount || 0
      else byAccountMap[aid].expense += c.amount || 0
    })

    const { data: accounts } = await supabase.from('cash_accounts').select('id, account_name, current_balance').eq('company_id', companyId!).eq('is_active', true)
    const byAccount = (accounts || []).map(acc => ({
      name: acc.account_name, balance: acc.current_balance,
      income: byAccountMap[acc.id]?.income || 0, expense: byAccountMap[acc.id]?.expense || 0
    }))

    // Cari toplam
    const { data: recv } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', companyId!).eq('transaction_type', 'receivable')
    const { data: pay } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', companyId!).eq('transaction_type', 'payable')
    const receivables = recv?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
    const payables = pay?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0

    setFinanceData({ income, expense, balance: income - expense, receivables, payables, byAccount })
  }

  const loadQC = async () => {
    const { data } = await supabase.from('qc_to_warehouse_transfers')
      .select('quality_result, quantity')
      .eq('company_id', companyId!)
      .gte('requested_at', dateFrom + 'T00:00:00')
      .lte('requested_at', dateTo + 'T23:59:59')

    const passed = data?.filter(d => d.quality_result === 'passed').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const failed = data?.filter(d => d.quality_result === 'failed').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const returned = data?.filter(d => d.quality_result === 'return').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const scrap = data?.filter(d => d.quality_result === 'scrap').reduce((s, d) => s + (d.quantity || 0), 0) || 0

    const { data: qcInv } = await supabase.from('quality_control_inventory').select('current_stock').eq('company_id', companyId!)
    const pending = qcInv?.reduce((s, r) => s + (r.current_stock || 0), 0) || 0

    setQcData({ passed, failed, returned, scrap, pending })
  }

  const loadEmployees = async () => {
    const { data: emps } = await supabase.from('employees').select('id, full_name, status').eq('company_id', companyId!)
    const total = emps?.length || 0
    const active = emps?.filter(e => e.status === 'active').length || 0

    const { data: prodRecords } = await supabase.from('machine_daily_production')
      .select('created_by, actual_production, defect_count')
      .eq('company_id', companyId!)
      .gte('production_date', dateFrom)
      .lte('production_date', dateTo)

    const byUser: Record<string, { total: number; defects: number; count: number }> = {}
    prodRecords?.forEach(r => {
      if (!r.created_by) return
      if (!byUser[r.created_by]) byUser[r.created_by] = { total: 0, defects: 0, count: 0 }
      byUser[r.created_by].total += r.actual_production || 0
      byUser[r.created_by].defects += r.defect_count || 0
      byUser[r.created_by].count++
    })

    const topProducers = await Promise.all(
      Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
        .map(async ([uid, stats]) => {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle()
          return { name: p?.full_name || '?', ...stats }
        })
    )

    setEmployeeData({ total, active, topProducers })
  }

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n)
  const fmtMoney = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

  const tabs: { id: ReportTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Genel Özet', icon: BarChart3 },
    { id: 'production', label: 'Üretim', icon: Factory },
    { id: 'warehouse', label: 'Depo', icon: Package },
    { id: 'finance', label: 'Finans', icon: Wallet },
    { id: 'quality', label: 'Kalite Kontrol', icon: Shield },
    { id: 'employees', label: 'Personel', icon: Users },
  ]

  if (loading && !companyId) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>

  return (
    <PermissionGuard module="reports" permission="view">
      <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Raporlar</h1>
            <p className="text-gray-600">{dateFrom} - {dateTo} arası</p>
          </div>
        </div>

        {/* Period Filter */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center gap-3">
          {[
            { id: 'today' as Period, label: 'Bugün' },
            { id: 'week' as Period, label: 'Son 7 Gün' },
            { id: 'month' as Period, label: 'Son 30 Gün' },
            { id: 'custom' as Period, label: 'Özel Tarih' },
          ].map(p => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              <span className="text-gray-400">-</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </>
          )}
          {loading && <span className="text-sm text-blue-600 animate-pulse">Yükleniyor...</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* GENEL ÖZET */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <Factory className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{fmt(productionData.total)}</p>
                <p className="text-xs text-gray-500">Üretim</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">%{productionData.efficiency}</p>
                <p className="text-xs text-gray-500">Verimlilik</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <ArrowUpRight className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{fmtMoney(financeData.income)}</p>
                <p className="text-xs text-gray-500">Gelen Ödeme</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <ArrowDownRight className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{fmtMoney(financeData.expense)}</p>
                <p className="text-xs text-gray-500">Giden Ödeme</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <Package className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">{fmt(warehouseData.movements)}</p>
                <p className="text-xs text-gray-500">Depo Hareketi</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                <Shield className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{fmt(qcData.passed + qcData.failed)}</p>
                <p className="text-xs text-gray-500">KK İşlemi</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Finans Özet */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Finansal Durum</h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg"><span className="text-green-700">Gelen Ödemeler</span><span className="font-bold text-green-700">{fmtMoney(financeData.income)}</span></div>
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg"><span className="text-red-700">Giden Ödemeler</span><span className="font-bold text-red-700">{fmtMoney(financeData.expense)}</span></div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg"><span className="text-blue-700">Net</span><span className="font-bold text-blue-700">{fmtMoney(financeData.balance)}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg"><span className="text-gray-700">Toplam Alacak</span><span className="font-bold text-green-600">{fmtMoney(financeData.receivables)}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg"><span className="text-gray-700">Toplam Borç</span><span className="font-bold text-red-600">{fmtMoney(financeData.payables)}</span></div>
                </div>
              </div>

              {/* Kalite Özet */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Kalite Kontrol Özeti</h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-yellow-50 rounded-lg"><span className="text-yellow-700">KK Deposunda Bekleyen</span><span className="font-bold text-yellow-700">{fmt(qcData.pending)}</span></div>
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg"><span className="text-green-700">Geçen</span><span className="font-bold text-green-700">{fmt(qcData.passed)}</span></div>
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg"><span className="text-red-700">Kalan (Red)</span><span className="font-bold text-red-700">{fmt(qcData.failed)}</span></div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg"><span className="text-blue-700">İade</span><span className="font-bold text-blue-700">{fmt(qcData.returned)}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg"><span className="text-gray-700">Hurda</span><span className="font-bold text-gray-700">{fmt(qcData.scrap)}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ÜRETİM RAPORU */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-blue-600">{fmt(productionData.total)}</p>
                <p className="text-sm text-gray-500">Toplam Üretim</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-red-600">{fmt(productionData.defects)}</p>
                <p className="text-sm text-gray-500">Toplam Fire</p>
                <p className="text-xs text-gray-400">{productionData.total > 0 ? `%${(productionData.defects / productionData.total * 100).toFixed(1)}` : '0'} fire oranı</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-green-600">%{productionData.efficiency}</p>
                <p className="text-sm text-gray-500">Ortalama Verimlilik</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Proje Bazlı Üretim</h3>
                {productionData.byProject.length === 0 ? <p className="text-gray-400 text-center py-4">Veri yok</p> : (
                  <div className="space-y-2">{productionData.byProject.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-gray-500">{p.defects} fire</p></div>
                      <p className="font-bold text-blue-600">{fmt(p.total)}</p>
                    </div>
                  ))}</div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Tezgah Bazlı Üretim</h3>
                {productionData.byMachine.length === 0 ? <p className="text-gray-400 text-center py-4">Veri yok</p> : (
                  <div className="space-y-2">{productionData.byMachine.map((m: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-semibold text-sm">{m.name}</p><p className="text-xs text-gray-500">{m.defects} fire</p></div>
                      <p className="font-bold text-blue-600">{fmt(m.total)}</p>
                    </div>
                  ))}</div>
                )}
              </div>
            </div>

            {productionData.daily.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Günlük Üretim Trendi</h3>
                <div className="overflow-x-auto">
                  <div className="flex gap-1 min-w-max">{productionData.daily.map((d: any, i: number) => {
                    const maxVal = Math.max(...productionData.daily.map((x: any) => x.total))
                    const height = maxVal > 0 ? Math.max((d.total / maxVal) * 120, 4) : 4
                    return (
                      <div key={i} className="flex flex-col items-center" style={{ minWidth: '30px' }}>
                        <p className="text-[9px] text-gray-500 mb-1">{fmt(d.total)}</p>
                        <div className="w-5 bg-blue-500 rounded-t" style={{ height: `${height}px` }}></div>
                        <p className="text-[8px] text-gray-400 mt-1">{new Date(d.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</p>
                      </div>
                    )
                  })}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEPO RAPORU */}
        {activeTab === 'warehouse' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-green-600">{fmt(warehouseData.entries)}</p>
                <p className="text-sm text-gray-500">Toplam Giriş</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-red-600">{fmt(warehouseData.exits)}</p>
                <p className="text-sm text-gray-500">Toplam Çıkış</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-gray-600">{fmt(warehouseData.scrap)}</p>
                <p className="text-sm text-gray-500">Hurda</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-bold text-gray-800 mb-4">En Çok Hareket Gören Ürünler</h3>
              {warehouseData.topItems.length === 0 ? <p className="text-gray-400 text-center py-4">Veri yok</p> : (
                <div className="space-y-2">{warehouseData.topItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div><p className="font-semibold text-sm">{item.name}</p><p className="text-xs text-gray-500">{item.code}</p></div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 font-medium">+{fmt(item.entry)}</span>
                      <span className="text-red-600 font-medium">-{fmt(item.exit)}</span>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {/* FİNANS RAPORU */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-green-600">{fmtMoney(financeData.income)}</p>
                <p className="text-sm text-gray-500">Gelen Ödemeler</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-red-600">{fmtMoney(financeData.expense)}</p>
                <p className="text-sm text-gray-500">Giden Ödemeler</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className={`text-3xl font-bold ${financeData.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoney(financeData.balance)}</p>
                <p className="text-sm text-gray-500">Net Nakit Akışı</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-bold text-gray-800 mb-4">Kasa Bazlı Durum</h3>
              {financeData.byAccount?.length === 0 ? <p className="text-gray-400 text-center py-4">Kasa yok</p> : (
                <div className="space-y-2">{(financeData.byAccount || []).map((acc: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">{acc.name}</p>
                      <p className="text-xs text-gray-500">Gelen: {fmtMoney(acc.income)} • Giden: {fmtMoney(acc.expense)}</p>
                    </div>
                    <p className={`font-bold ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtMoney(acc.balance)}</p>
                  </div>
                ))}</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                <p className="text-sm text-green-700 mb-1">Toplam Alacak (Kalan)</p>
                <p className="text-2xl font-bold text-green-800">{fmtMoney(financeData.receivables)}</p>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                <p className="text-sm text-red-700 mb-1">Toplam Borç (Kalan)</p>
                <p className="text-2xl font-bold text-red-800">{fmtMoney(financeData.payables)}</p>
              </div>
            </div>
          </div>
        )}

        {/* KALİTE KONTROL RAPORU */}
        {activeTab === 'quality' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center"><p className="text-2xl font-bold text-yellow-700">{fmt(qcData.pending)}</p><p className="text-xs text-yellow-600">KK Bekleyen</p></div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center"><p className="text-2xl font-bold text-green-700">{fmt(qcData.passed)}</p><p className="text-xs text-green-600">Geçen</p></div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center"><p className="text-2xl font-bold text-red-700">{fmt(qcData.failed)}</p><p className="text-xs text-red-600">Kalan (Red)</p></div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center"><p className="text-2xl font-bold text-blue-700">{fmt(qcData.returned)}</p><p className="text-xs text-blue-600">İade</p></div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center"><p className="text-2xl font-bold text-gray-700">{fmt(qcData.scrap)}</p><p className="text-xs text-gray-600">Hurda</p></div>
            </div>
            {(qcData.passed + qcData.failed) > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Geçme Oranı</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full" style={{ width: `${(qcData.passed / (qcData.passed + qcData.failed) * 100)}%` }}></div>
                  </div>
                  <span className="font-bold text-green-600">%{(qcData.passed / (qcData.passed + qcData.failed) * 100).toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PERSONEL RAPORU */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-teal-600">{employeeData.active}</p>
                <p className="text-sm text-gray-500">Aktif Personel</p>
                <p className="text-xs text-gray-400">Toplam: {employeeData.total}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                <p className="text-3xl font-bold text-blue-600">{employeeData.topProducers.length}</p>
                <p className="text-sm text-gray-500">Üretim Yapan Personel</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-bold text-gray-800 mb-4">En Verimli Personeller</h3>
              {employeeData.topProducers.length === 0 ? <p className="text-gray-400 text-center py-4">Veri yok</p> : (
                <div className="space-y-2">{employeeData.topProducers.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div>
                      <div>
                        <p className="font-semibold text-sm">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.count} gün çalıştı • {emp.defects} fire</p>
                      </div>
                    </div>
                    <p className="font-bold text-blue-600">{fmt(emp.total)} adet</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

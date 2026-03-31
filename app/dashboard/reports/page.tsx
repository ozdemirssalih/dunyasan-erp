'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  BarChart3, Factory, Package, Wallet, Users, Shield,
  TrendingUp, ArrowUpRight, ArrowDownRight, FileDown
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Period = 'today' | 'week' | 'month' | 'custom'
type ReportTab = 'overview' | 'production' | 'warehouse' | 'finance' | 'quality' | 'employees'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function ReportsPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [period, setPeriod] = useState<Period>('month')
  const [exporting, setExporting] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  const [productionData, setProductionData] = useState<any>({ total: 0, defects: 0, efficiency: 0, byProject: [], byMachine: [], daily: [] })
  const [warehouseData, setWarehouseData] = useState<any>({ entries: 0, exits: 0, scrap: 0, topItems: [], movements: 0, byType: [] })
  const [financeData, setFinanceData] = useState<any>({ income: 0, expense: 0, balance: 0, receivables: 0, payables: 0, byAccount: [], daily: [] })
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
    const to = new Date().toISOString().split('T')[0]
    setDateTo(to)
    if (p === 'today') setDateFrom(to)
    else if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]) }
    else if (p === 'month') { const d = new Date(); d.setDate(d.getDate() - 30); setDateFrom(d.toISOString().split('T')[0]) }
  }

  const exportPDF = async () => {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      let heightLeft = pdfHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      const tabName = tabs.find(t => t.id === activeTab)?.label || 'Rapor'
      pdf.save(`${tabName}_${dateFrom}_${dateTo}.pdf`)
    } catch (e) { console.error('PDF error:', e); alert('PDF oluşturulamadı') }
    finally { setExporting(false) }
  }

  const loadAll = async () => {
    if (!companyId) return
    setLoading(true)
    await Promise.all([
      loadProduction().catch(() => {}), loadWarehouse().catch(() => {}),
      loadFinance().catch(() => {}), loadQC().catch(() => {}), loadEmployees().catch(() => {}),
    ])
    setLoading(false)
  }

  const loadProduction = async () => {
    const { data } = await supabase.from('machine_daily_production')
      .select('actual_production, defect_count, efficiency_rate, production_date, project_id, machine_id')
      .eq('company_id', companyId!).gte('production_date', dateFrom).lte('production_date', dateTo)
    if (!data) return
    const total = data.reduce((s, r) => s + (r.actual_production || 0), 0)
    const defects = data.reduce((s, r) => s + (r.defect_count || 0), 0)
    const avgEff = data.length > 0 ? data.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / data.length : 0

    const byProjectMap: Record<string, { total: number; defects: number }> = {}
    data.forEach(r => { if (!byProjectMap[r.project_id]) byProjectMap[r.project_id] = { total: 0, defects: 0 }; byProjectMap[r.project_id].total += r.actual_production || 0; byProjectMap[r.project_id].defects += r.defect_count || 0 })
    const byProject = await Promise.all(Object.entries(byProjectMap).map(async ([pid, s]) => { const { data: p } = await supabase.from('projects').select('project_name').eq('id', pid).maybeSingle(); return { name: p?.project_name || '?', ...s } }))

    const byMachineMap: Record<string, { total: number; defects: number }> = {}
    data.forEach(r => { if (!byMachineMap[r.machine_id]) byMachineMap[r.machine_id] = { total: 0, defects: 0 }; byMachineMap[r.machine_id].total += r.actual_production || 0; byMachineMap[r.machine_id].defects += r.defect_count || 0 })
    const byMachine = await Promise.all(Object.entries(byMachineMap).map(async ([mid, s]) => { const { data: m } = await supabase.from('machines').select('machine_name').eq('id', mid).maybeSingle(); return { name: m?.machine_name || '?', ...s } }))

    const dailyMap: Record<string, { total: number; defects: number; efficiency: number; count: number }> = {}
    data.forEach(r => { if (!dailyMap[r.production_date]) dailyMap[r.production_date] = { total: 0, defects: 0, efficiency: 0, count: 0 }; dailyMap[r.production_date].total += r.actual_production || 0; dailyMap[r.production_date].defects += r.defect_count || 0; dailyMap[r.production_date].efficiency += r.efficiency_rate || 0; dailyMap[r.production_date].count++ })
    const daily = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, s]) => ({ date: new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }), Üretim: s.total, Fire: s.defects, Verimlilik: Math.round(s.efficiency / s.count) }))

    setProductionData({ total, defects, efficiency: Math.round(avgEff * 10) / 10, byProject: byProject.sort((a, b) => b.total - a.total), byMachine: byMachine.sort((a, b) => b.total - a.total), daily })
  }

  const loadWarehouse = async () => {
    const { data } = await supabase.from('warehouse_transactions').select('type, quantity, item_id').eq('company_id', companyId!).gte('transaction_date', dateFrom).lte('transaction_date', dateTo)
    if (!data) return
    const entries = data.filter(d => d.type === 'entry').reduce((s, d) => s + (d.quantity || 0), 0)
    const exits = data.filter(d => d.type === 'exit').reduce((s, d) => s + (d.quantity || 0), 0)
    const scrap = data.filter(d => d.type === 'scrap').reduce((s, d) => s + (d.quantity || 0), 0)
    const byType = [{ name: 'Giriş', value: entries }, { name: 'Çıkış', value: exits }, { name: 'Hurda', value: scrap }].filter(d => d.value > 0)

    const itemCounts: Record<string, { entry: number; exit: number }> = {}
    data.forEach(d => { if (!itemCounts[d.item_id]) itemCounts[d.item_id] = { entry: 0, exit: 0 }; if (d.type === 'entry') itemCounts[d.item_id].entry += d.quantity || 0; else if (d.type === 'exit') itemCounts[d.item_id].exit += d.quantity || 0 })
    const topItems = await Promise.all(Object.entries(itemCounts).sort((a, b) => (b[1].entry + b[1].exit) - (a[1].entry + a[1].exit)).slice(0, 10).map(async ([iid, s]) => { const { data: item } = await supabase.from('warehouse_items').select('name, code').eq('id', iid).maybeSingle(); return { name: item?.name || '?', code: item?.code || '', Giriş: s.entry, Çıkış: s.exit } }))

    setWarehouseData({ entries, exits, scrap, topItems, movements: data.length, byType })
  }

  const loadFinance = async () => {
    const { data: cash } = await supabase.from('cash_transactions').select('transaction_type, amount, cash_account_id, transaction_date').eq('company_id', companyId!).gte('transaction_date', dateFrom + 'T00:00:00').lte('transaction_date', dateTo + 'T23:59:59')
    const income = cash?.filter(c => c.transaction_type === 'income').reduce((s, c) => s + (c.amount || 0), 0) || 0
    const expense = cash?.filter(c => c.transaction_type === 'expense').reduce((s, c) => s + (c.amount || 0), 0) || 0

    const dailyMap: Record<string, { income: number; expense: number }> = {}
    cash?.forEach(c => { const d = c.transaction_date.split('T')[0]; if (!dailyMap[d]) dailyMap[d] = { income: 0, expense: 0 }; if (c.transaction_type === 'income') dailyMap[d].income += c.amount || 0; else dailyMap[d].expense += c.amount || 0 })
    const daily = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, s]) => ({ date: new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }), Gelen: s.income, Giden: s.expense }))

    const { data: accounts } = await supabase.from('cash_accounts').select('id, account_name, current_balance').eq('company_id', companyId!).eq('is_active', true)
    const byAccountMap: Record<string, { income: number; expense: number }> = {}
    cash?.forEach(c => { const a = c.cash_account_id || 'other'; if (!byAccountMap[a]) byAccountMap[a] = { income: 0, expense: 0 }; if (c.transaction_type === 'income') byAccountMap[a].income += c.amount || 0; else byAccountMap[a].expense += c.amount || 0 })
    const byAccount = (accounts || []).map(acc => ({ name: acc.account_name, Bakiye: acc.current_balance, Gelen: byAccountMap[acc.id]?.income || 0, Giden: byAccountMap[acc.id]?.expense || 0 }))

    const { data: recv } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', companyId!).eq('transaction_type', 'receivable')
    const { data: pay } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', companyId!).eq('transaction_type', 'payable')
    const receivables = recv?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
    const payables = pay?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0

    setFinanceData({ income, expense, balance: income - expense, receivables, payables, byAccount, daily })
  }

  const loadQC = async () => {
    const { data } = await supabase.from('qc_to_warehouse_transfers').select('quality_result, quantity').eq('company_id', companyId!).gte('requested_at', dateFrom + 'T00:00:00').lte('requested_at', dateTo + 'T23:59:59')
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
    const { data: prodRecords } = await supabase.from('machine_daily_production').select('created_by, actual_production, defect_count').eq('company_id', companyId!).gte('production_date', dateFrom).lte('production_date', dateTo)
    const byUser: Record<string, { total: number; defects: number; count: number }> = {}
    prodRecords?.forEach(r => { if (!r.created_by) return; if (!byUser[r.created_by]) byUser[r.created_by] = { total: 0, defects: 0, count: 0 }; byUser[r.created_by].total += r.actual_production || 0; byUser[r.created_by].defects += r.defect_count || 0; byUser[r.created_by].count++ })
    const topProducers = await Promise.all(Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(async ([uid, s]) => { const { data: p } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(); return { name: p?.full_name || '?', Üretim: s.total, Fire: s.defects, Gün: s.count } }))
    setEmployeeData({ total: emps?.length || 0, active: emps?.filter(e => e.status === 'active').length || 0, topProducers })
  }

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n)
  const fmtM = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

  const tabs: { id: ReportTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Genel Özet', icon: BarChart3 },
    { id: 'production', label: 'Üretim', icon: Factory },
    { id: 'warehouse', label: 'Depo', icon: Package },
    { id: 'finance', label: 'Finans', icon: Wallet },
    { id: 'quality', label: 'Kalite Kontrol', icon: Shield },
    { id: 'employees', label: 'Personel', icon: Users },
  ]

  if (loading && !companyId) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>

  const qcPieData = [
    { name: 'Geçen', value: qcData.passed },
    { name: 'Kalan', value: qcData.failed },
    { name: 'İade', value: qcData.returned },
    { name: 'Hurda', value: qcData.scrap },
  ].filter(d => d.value > 0)

  const financePieData = [
    { name: 'Gelen Ödeme', value: financeData.income },
    { name: 'Giden Ödeme', value: financeData.expense },
  ].filter(d => d.value > 0)

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Raporlar</h1>
            <p className="text-gray-600">{dateFrom} - {dateTo}</p>
          </div>
          <button onClick={exportPDF} disabled={exporting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50">
            <FileDown className="w-5 h-5" /> {exporting ? 'Oluşturuluyor...' : 'PDF İndir'}
          </button>
        </div>

        {/* Period */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center gap-3">
          {[{ id: 'today' as Period, label: 'Bugün' }, { id: 'week' as Period, label: 'Son 7 Gün' }, { id: 'month' as Period, label: 'Son 30 Gün' }, { id: 'custom' as Period, label: 'Özel' }].map(p => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p.label}</button>
          ))}
          {period === 'custom' && <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <span className="text-gray-400">-</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          </>}
          {loading && <span className="text-sm text-blue-600 animate-pulse">Yükleniyor...</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Report Content */}
        <div ref={reportRef}>

        {/* GENEL ÖZET */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Factory className="w-6 h-6 text-blue-600 mx-auto mb-2" /><p className="text-2xl font-bold text-blue-600">{fmt(productionData.total)}</p><p className="text-xs text-gray-500">Üretim</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" /><p className="text-2xl font-bold text-green-600">%{productionData.efficiency}</p><p className="text-xs text-gray-500">Verimlilik</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><ArrowUpRight className="w-6 h-6 text-green-600 mx-auto mb-2" /><p className="text-2xl font-bold text-green-600">{fmtM(financeData.income)}</p><p className="text-xs text-gray-500">Gelen Ödeme</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><ArrowDownRight className="w-6 h-6 text-red-600 mx-auto mb-2" /><p className="text-2xl font-bold text-red-600">{fmtM(financeData.expense)}</p><p className="text-xs text-gray-500">Giden Ödeme</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Package className="w-6 h-6 text-purple-600 mx-auto mb-2" /><p className="text-2xl font-bold text-purple-600">{fmt(warehouseData.movements)}</p><p className="text-xs text-gray-500">Depo Hareketi</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Shield className="w-6 h-6 text-orange-600 mx-auto mb-2" /><p className="text-2xl font-bold text-orange-600">{fmt(qcData.passed + qcData.failed)}</p><p className="text-xs text-gray-500">KK İşlemi</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {productionData.daily.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Günlük Üretim Trendi</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={productionData.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="Üretim" stroke="#3b82f6" fill="#93c5fd" />
                      <Area type="monotone" dataKey="Fire" stroke="#ef4444" fill="#fca5a5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {financePieData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Gelir / Gider Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={financePieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                        {financePieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtM(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ÜRETİM */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-blue-600">{fmt(productionData.total)}</p><p className="text-sm text-gray-500">Toplam Üretim</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{fmt(productionData.defects)}</p><p className="text-sm text-gray-500">Fire ({productionData.total > 0 ? `%${(productionData.defects / productionData.total * 100).toFixed(1)}` : '0'})</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">%{productionData.efficiency}</p><p className="text-sm text-gray-500">Verimlilik</p></div>
            </div>

            {productionData.daily.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Günlük Üretim</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={productionData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Günlük Fire ve Fire Oranı</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={productionData.daily.map((d: any) => ({ ...d, 'Fire Oranı (%)': d.Üretim > 0 ? Math.round(d.Fire / d.Üretim * 1000) / 10 : 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Fire" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Fire Oranı (%)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {productionData.daily.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Verimlilik Trendi (%)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={productionData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Verimlilik" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {productionData.byProject.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Proje Bazlı Üretim</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={productionData.byProject.map((p: any) => ({ name: p.name, value: p.total }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name.substring(0, 15)} %${(percent * 100).toFixed(0)}`}>
                        {productionData.byProject.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {productionData.byProject.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                          <div>
                            <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.defects} fire • %{p.total > 0 ? (p.defects / p.total * 100).toFixed(1) : '0'} fire oranı</p>
                          </div>
                        </div>
                        <p className="font-bold text-blue-600">{fmt(p.total)} adet</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {productionData.byMachine.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Tezgah Bazlı Üretim ({productionData.byMachine.length} tezgah)</h3>
                  <ResponsiveContainer width="100%" height={Math.max(250, productionData.byMachine.length * 35)}>
                    <BarChart data={productionData.byMachine} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#3b82f6" name="Üretim" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEPO */}
        {activeTab === 'warehouse' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">{fmt(warehouseData.entries)}</p><p className="text-sm text-gray-500">Giriş</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{fmt(warehouseData.exits)}</p><p className="text-sm text-gray-500">Çıkış</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-gray-600">{fmt(warehouseData.scrap)}</p><p className="text-sm text-gray-500">Hurda</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {warehouseData.byType.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Hareket Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={warehouseData.byType} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                        <Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#6b7280" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {warehouseData.topItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">En Çok Hareket Gören Ürünler</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={warehouseData.topItems.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Giriş" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Çıkış" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FİNANS */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">{fmtM(financeData.income)}</p><p className="text-sm text-gray-500">Gelen Ödemeler</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{fmtM(financeData.expense)}</p><p className="text-sm text-gray-500">Giden Ödemeler</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className={`text-3xl font-bold ${financeData.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtM(financeData.balance)}</p><p className="text-sm text-gray-500">Net Nakit Akışı</p></div>
            </div>

            {financeData.daily?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Günlük Nakit Akışı</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={financeData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmtM(v)} />
                    <Legend />
                    <Bar dataKey="Gelen" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Giden" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {financeData.byAccount?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Kasa Bakiyeleri</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={financeData.byAccount} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => fmtM(v)} />
                      <Bar dataKey="Bakiye" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Alacak / Borç</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={[{ name: 'Alacak', value: financeData.receivables }, { name: 'Borç', value: financeData.payables }].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                      <Cell fill="#10b981" /><Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtM(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* KALİTE KONTROL */}
        {activeTab === 'quality' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center"><p className="text-2xl font-bold text-yellow-700">{fmt(qcData.pending)}</p><p className="text-xs text-yellow-600">Bekleyen</p></div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center"><p className="text-2xl font-bold text-green-700">{fmt(qcData.passed)}</p><p className="text-xs text-green-600">Geçen</p></div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center"><p className="text-2xl font-bold text-red-700">{fmt(qcData.failed)}</p><p className="text-xs text-red-600">Red</p></div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center"><p className="text-2xl font-bold text-blue-700">{fmt(qcData.returned)}</p><p className="text-xs text-blue-600">İade</p></div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center"><p className="text-2xl font-bold text-gray-700">{fmt(qcData.scrap)}</p><p className="text-xs text-gray-600">Hurda</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {qcPieData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Sonuç Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={qcPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                        {qcPieData.map((_, i) => <Cell key={i} fill={[COLORS[1], COLORS[3], COLORS[0], COLORS[5]][i] || COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {(qcData.passed + qcData.failed) > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-bold text-gray-800 mb-4">Geçme Oranı</h3>
                  <div className="flex flex-col items-center justify-center h-[250px]">
                    <p className="text-6xl font-black text-green-600 mb-4">%{(qcData.passed / (qcData.passed + qcData.failed) * 100).toFixed(1)}</p>
                    <div className="w-full max-w-md bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${(qcData.passed / (qcData.passed + qcData.failed) * 100)}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">{fmt(qcData.passed)} geçen / {fmt(qcData.passed + qcData.failed)} toplam</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PERSONEL */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-teal-600">{employeeData.active}</p><p className="text-sm text-gray-500">Aktif Personel (toplam: {employeeData.total})</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-blue-600">{employeeData.topProducers.length}</p><p className="text-sm text-gray-500">Üretim Yapan</p></div>
            </div>

            {employeeData.topProducers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">En Verimli Personeller</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeData.topProducers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fire" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {employeeData.topProducers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Personel Sıralaması</h3>
                <div className="space-y-2">{employeeData.topProducers.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div>
                      <div><p className="font-semibold text-sm">{emp.name}</p><p className="text-xs text-gray-500">{emp.Gün} gün • {emp.Fire} fire</p></div>
                    </div>
                    <p className="font-bold text-blue-600">{fmt(emp.Üretim)} adet</p>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}

        </div>
    </div>
    </>
  )
}

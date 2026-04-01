'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { BarChart3, Factory, Package, Wallet, Users, Shield, TrendingUp, ArrowUpRight, ArrowDownRight, FileDown } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Period = 'today' | 'week' | 'month' | 'custom'
type Tab = 'overview' | 'production' | 'warehouse' | 'finance' | 'quality' | 'employees'
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function ReportsPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [cid, setCid] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [period, setPeriod] = useState<Period>('month')
  const [exporting, setExporting] = useState(false)
  const [df, setDf] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [dt, setDt] = useState(new Date().toISOString().split('T')[0])

  const [prod, setProd] = useState<any>({ total: 0, defects: 0, eff: 0, byProject: [], byMachine: [], daily: [] })
  const [wh, setWh] = useState<any>({ entries: 0, exits: 0, scrap: 0, topItems: [], moves: 0, byType: [] })
  const [fin, setFin] = useState<any>({ income: 0, expense: 0, bal: 0, recv: 0, pay: 0, byAcc: [], daily: [] })
  const [qc, setQc] = useState<any>({ passed: 0, failed: 0, returned: 0, scrap: 0, pending: 0 })
  const [emp, setEmp] = useState<any>({ total: 0, active: 0, top: [] })

  useEffect(() => { init() }, [])
  useEffect(() => { if (cid) loadAll() }, [cid, df, dt])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    setCid(p?.company_id || null)
  }

  function changePeriod(p: Period) {
    setPeriod(p)
    const to = new Date().toISOString().split('T')[0]
    setDt(to)
    if (p === 'today') setDf(to)
    else if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDf(d.toISOString().split('T')[0]) }
    else if (p === 'month') { const d = new Date(); d.setDate(d.getDate() - 30); setDf(d.toISOString().split('T')[0]) }
  }

  async function exportPDF() {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      // Başlık
      pdf.setFontSize(18)
      pdf.setTextColor(30, 30, 46)
      pdf.text('Dünyasan Üretim Raporu', pageW / 2, 15, { align: 'center' })
      pdf.setFontSize(10)
      pdf.setTextColor(113, 113, 122)
      const dateLabel = df === dt ? df : `${df} - ${dt}`
      pdf.text(dateLabel, pageW / 2, 22, { align: 'center' })
      pdf.setDrawColor(200, 200, 200)
      pdf.line(10, 25, pageW - 10, 25)

      // Rapor içeriği
      const imgW = pageW - 20
      const imgH = (canvas.height * imgW) / canvas.width
      let yPos = 30
      let heightLeft = imgH

      pdf.addImage(imgData, 'PNG', 10, yPos, imgW, imgH)
      heightLeft -= (pageH - yPos)

      while (heightLeft > 0) {
        pdf.addPage()
        yPos = -(imgH - heightLeft) + 10
        pdf.addImage(imgData, 'PNG', 10, yPos, imgW, imgH)
        heightLeft -= pageH
      }

      const tabName = tab === 'overview' ? 'Genel' : tab === 'production' ? 'Üretim' : tab === 'warehouse' ? 'Depo' : tab === 'finance' ? 'Finans' : tab === 'quality' ? 'Kalite' : 'Personel'
      pdf.save(`Dunyasan_${tabName}_Raporu_${df === dt ? df : df + '_' + dt}.pdf`)
    } catch (e) { alert('PDF hatası') }
    finally { setExporting(false) }
  }

  async function loadAll() {
    if (!cid) return
    setLoading(true)
    await Promise.all([loadProd(), loadWh(), loadFin(), loadQc(), loadEmp()].map(p => p.catch(() => {})))
    setLoading(false)
  }

  async function loadProd() {
    const { data } = await supabase.from('machine_daily_production').select('actual_production, defect_count, efficiency_rate, production_date, project_id, machine_id').eq('company_id', cid!).gte('production_date', df).lte('production_date', dt)
    if (!data) return
    const total = data.reduce((s, r) => s + (r.actual_production || 0), 0)
    const defects = data.reduce((s, r) => s + (r.defect_count || 0), 0)
    const eff = data.length > 0 ? Math.round(data.reduce((s, r) => s + (r.efficiency_rate || 0), 0) / data.length * 10) / 10 : 0

    const pm: Record<string, any> = {}
    data.forEach(r => { if (!pm[r.project_id]) pm[r.project_id] = { t: 0, d: 0 }; pm[r.project_id].t += r.actual_production || 0; pm[r.project_id].d += r.defect_count || 0 })
    const byProject = await Promise.all(Object.entries(pm).map(async ([id, s]: any) => { const { data: p } = await supabase.from('projects').select('project_name').eq('id', id).maybeSingle(); return { name: p?.project_name || '?', total: s.t, defects: s.d } }))

    const mm: Record<string, any> = {}
    data.forEach(r => { if (!mm[r.machine_id]) mm[r.machine_id] = { t: 0, d: 0, e: 0, c: 0 }; mm[r.machine_id].t += r.actual_production || 0; mm[r.machine_id].d += r.defect_count || 0; mm[r.machine_id].e += r.efficiency_rate || 0; mm[r.machine_id].c++ })
    const byMachine = await Promise.all(Object.entries(mm).map(async ([id, s]: any) => {
      const { data: m } = await supabase.from('machines').select('machine_name').eq('id', id).maybeSingle()
      const { data: pm } = await supabase.from('project_machines').select('project:projects(project_name)').eq('machine_id', id).maybeSingle()
      return { name: m?.machine_name || '?', total: s.t, defects: s.d, eff: s.c > 0 ? Math.round(s.e / s.c) : 0, project: (pm as any)?.project?.project_name || '-' }
    }))

    const dm: Record<string, any> = {}
    data.forEach(r => { if (!dm[r.production_date]) dm[r.production_date] = { t: 0, d: 0, e: 0, c: 0 }; dm[r.production_date].t += r.actual_production || 0; dm[r.production_date].d += r.defect_count || 0; dm[r.production_date].e += r.efficiency_rate || 0; dm[r.production_date].c++ })
    const daily = Object.entries(dm).sort().map(([date, s]: any) => ({ date: new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }), Üretim: s.t, Fire: s.d, Verimlilik: Math.round(s.e / s.c) }))

    setProd({ total, defects, eff, byProject: byProject.sort((a, b) => b.total - a.total), byMachine: byMachine.sort((a, b) => b.total - a.total), daily })
  }

  async function loadWh() {
    const { data } = await supabase.from('warehouse_transactions').select('type, quantity, item_id').eq('company_id', cid!).gte('transaction_date', df).lte('transaction_date', dt)
    if (!data) return
    const entries = data.filter(d => d.type === 'entry').reduce((s, d) => s + (d.quantity || 0), 0)
    const exits = data.filter(d => d.type === 'exit').reduce((s, d) => s + (d.quantity || 0), 0)
    const scrap = data.filter(d => d.type === 'scrap').reduce((s, d) => s + (d.quantity || 0), 0)
    const byType = [{ name: 'Giriş', value: entries }, { name: 'Çıkış', value: exits }, { name: 'Hurda', value: scrap }].filter(d => d.value > 0)
    const ic: Record<string, any> = {}
    data.forEach(d => { if (!ic[d.item_id]) ic[d.item_id] = { e: 0, x: 0 }; if (d.type === 'entry') ic[d.item_id].e += d.quantity || 0; else if (d.type === 'exit') ic[d.item_id].x += d.quantity || 0 })
    const topItems = await Promise.all(Object.entries(ic).sort((a: any, b: any) => (b[1].e + b[1].x) - (a[1].e + a[1].x)).slice(0, 10).map(async ([id, s]: any) => { const { data: i } = await supabase.from('warehouse_items').select('name, code').eq('id', id).maybeSingle(); return { name: i?.name || '?', Giriş: s.e, Çıkış: s.x } }))
    setWh({ entries, exits, scrap, topItems, moves: data.length, byType })
  }

  async function loadFin() {
    const { data: cash } = await supabase.from('cash_transactions').select('transaction_type, amount, cash_account_id, transaction_date').eq('company_id', cid!).gte('transaction_date', df + 'T00:00:00').lte('transaction_date', dt + 'T23:59:59')
    const income = cash?.filter(c => c.transaction_type === 'income').reduce((s, c) => s + (c.amount || 0), 0) || 0
    const expense = cash?.filter(c => c.transaction_type === 'expense').reduce((s, c) => s + (c.amount || 0), 0) || 0
    const dm: Record<string, any> = {}
    cash?.forEach(c => { const d = c.transaction_date.split('T')[0]; if (!dm[d]) dm[d] = { i: 0, e: 0 }; if (c.transaction_type === 'income') dm[d].i += c.amount || 0; else dm[d].e += c.amount || 0 })
    const daily = Object.entries(dm).sort().map(([date, s]: any) => ({ date: new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }), Gelen: s.i, Giden: s.e }))
    const { data: accs } = await supabase.from('cash_accounts').select('id, account_name, current_balance').eq('company_id', cid!).eq('is_active', true)
    const am: Record<string, any> = {}
    cash?.forEach(c => { const a = c.cash_account_id || 'x'; if (!am[a]) am[a] = { i: 0, e: 0 }; if (c.transaction_type === 'income') am[a].i += c.amount || 0; else am[a].e += c.amount || 0 })
    const byAcc = (accs || []).map(a => ({ name: a.account_name, Bakiye: a.current_balance, Gelen: am[a.id]?.i || 0, Giden: am[a.id]?.e || 0 }))
    const { data: rv } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', cid!).eq('transaction_type', 'receivable')
    const { data: py } = await supabase.from('current_account_transactions').select('amount, paid_amount').eq('company_id', cid!).eq('transaction_type', 'payable')
    const recv = rv?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
    const pay = py?.reduce((s, r) => s + (parseFloat(r.amount || 0) - parseFloat(r.paid_amount || 0)), 0) || 0
    setFin({ income, expense, bal: income - expense, recv, pay, byAcc, daily })
  }

  async function loadQc() {
    const { data } = await supabase.from('qc_to_warehouse_transfers').select('quality_result, quantity').eq('company_id', cid!).gte('requested_at', df + 'T00:00:00').lte('requested_at', dt + 'T23:59:59')
    const passed = data?.filter(d => d.quality_result === 'passed').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const failed = data?.filter(d => d.quality_result === 'failed').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const returned = data?.filter(d => d.quality_result === 'return').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const scrap = data?.filter(d => d.quality_result === 'scrap').reduce((s, d) => s + (d.quantity || 0), 0) || 0
    const { data: qi } = await supabase.from('quality_control_inventory').select('current_stock').eq('company_id', cid!)
    setQc({ passed, failed, returned, scrap, pending: qi?.reduce((s, r) => s + (r.current_stock || 0), 0) || 0 })
  }

  async function loadEmp() {
    const { data: es } = await supabase.from('employees').select('id, status').eq('company_id', cid!)
    const { data: pr } = await supabase.from('machine_daily_production').select('created_by, actual_production, defect_count').eq('company_id', cid!).gte('production_date', df).lte('production_date', dt)
    const bu: Record<string, any> = {}
    pr?.forEach(r => { if (!r.created_by) return; if (!bu[r.created_by]) bu[r.created_by] = { t: 0, d: 0, c: 0 }; bu[r.created_by].t += r.actual_production || 0; bu[r.created_by].d += r.defect_count || 0; bu[r.created_by].c++ })
    const top = await Promise.all(Object.entries(bu).sort((a: any, b: any) => b[1].t - a[1].t).slice(0, 10).map(async ([uid, s]: any) => { const { data: p } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(); return { name: p?.full_name || '?', Üretim: s.t, Fire: s.d, Gün: s.c } }))
    setEmp({ total: es?.length || 0, active: es?.filter(e => e.status === 'active').length || 0, top })
  }

  const f = (n: number) => new Intl.NumberFormat('tr-TR').format(n)
  const fm = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

  if (loading && !cid) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>

  const qcPie = [{ name: 'Geçen', value: qc.passed }, { name: 'Kalan', value: qc.failed }, { name: 'İade', value: qc.returned }, { name: 'Hurda', value: qc.scrap }].filter(d => d.value > 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-gray-600">{df} - {dt}</p>
        </div>
        <button onClick={exportPDF} disabled={exporting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50">
          <FileDown className="w-5 h-5" /> {exporting ? 'Oluşturuluyor...' : 'PDF İndir'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center gap-3">
        {[{ id: 'today' as Period, l: 'Bugün' }, { id: 'week' as Period, l: 'Son 7 Gün' }, { id: 'month' as Period, l: 'Son 30 Gün' }, { id: 'custom' as Period, l: 'Özel' }].map(p => (
          <button key={p.id} onClick={() => changePeriod(p.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p.l}</button>
        ))}
        {period === 'custom' && <><input type="date" value={df} onChange={e => setDf(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" /><span>-</span><input type="date" value={dt} onChange={e => setDt(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" /></>}
        {loading && <span className="text-sm text-blue-600 animate-pulse">Yükleniyor...</span>}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[{ id: 'overview' as Tab, l: 'Genel Özet', I: BarChart3 }, { id: 'production' as Tab, l: 'Üretim', I: Factory }, { id: 'warehouse' as Tab, l: 'Depo', I: Package }, { id: 'finance' as Tab, l: 'Finans', I: Wallet }, { id: 'quality' as Tab, l: 'Kalite Kontrol', I: Shield }, { id: 'employees' as Tab, l: 'Personel', I: Users }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
            <t.I className="w-4 h-4" /> {t.l}
          </button>
        ))}
      </div>

      <div ref={reportRef}>
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Factory className="w-6 h-6 text-blue-600 mx-auto mb-2" /><p className="text-2xl font-bold text-blue-600">{f(prod.total)}</p><p className="text-xs text-gray-500">Üretim</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" /><p className="text-2xl font-bold text-green-600">%{prod.eff}</p><p className="text-xs text-gray-500">Verimlilik</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><ArrowUpRight className="w-6 h-6 text-green-600 mx-auto mb-2" /><p className="text-2xl font-bold text-green-600">{fm(fin.income)}</p><p className="text-xs text-gray-500">Gelen Ödeme</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><ArrowDownRight className="w-6 h-6 text-red-600 mx-auto mb-2" /><p className="text-2xl font-bold text-red-600">{fm(fin.expense)}</p><p className="text-xs text-gray-500">Giden Ödeme</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Package className="w-6 h-6 text-purple-600 mx-auto mb-2" /><p className="text-2xl font-bold text-purple-600">{f(wh.moves)}</p><p className="text-xs text-gray-500">Depo Hareketi</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-4 text-center"><Shield className="w-6 h-6 text-orange-600 mx-auto mb-2" /><p className="text-2xl font-bold text-orange-600">{f(qc.passed + qc.failed)}</p><p className="text-xs text-gray-500">KK İşlemi</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {prod.daily.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Günlük Üretim Trendi</h3><ResponsiveContainer width="100%" height={250}><AreaChart data={prod.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="Üretim" stroke="#3b82f6" fill="#93c5fd" /></AreaChart></ResponsiveContainer></div>}
              {fin.daily.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Nakit Akışı</h3><ResponsiveContainer width="100%" height={250}><BarChart data={fin.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => fm(v)} /><Legend /><Bar dataKey="Gelen" fill="#10b981" /><Bar dataKey="Giden" fill="#ef4444" /></BarChart></ResponsiveContainer></div>}
            </div>
          </div>
        )}

        {tab === 'production' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-blue-600">{f(prod.total)}</p><p className="text-sm text-gray-500">Toplam Üretim</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{f(prod.defects)}</p><p className="text-sm text-gray-500">Fire ({prod.total > 0 ? `%${(prod.defects / prod.total * 100).toFixed(1)}` : '0'})</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">%{prod.eff}</p><p className="text-sm text-gray-500">Verimlilik</p></div>
            </div>
            {prod.daily.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Günlük Üretim ve Fire</h3><ResponsiveContainer width="100%" height={300}><BarChart data={prod.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="Üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="Fire" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
            {prod.daily.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Verimlilik Trendi</h3><ResponsiveContainer width="100%" height={250}><LineChart data={prod.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="Verimlilik" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {prod.byProject.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Proje Bazlı Üretim</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={prod.byProject.map((p: any) => ({ name: p.name, value: p.total }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name.substring(0, 12)} %${(percent * 100).toFixed(0)}`}>{prod.byProject.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="mt-4 space-y-2">{prod.byProject.map((p: any, i: number) => (<div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div><div><p className="font-semibold text-sm" style={{ color: COLORS[i % COLORS.length] }}>{p.name}</p><p className="text-xs text-gray-500">{p.defects} fire • %{p.total > 0 ? (p.defects / p.total * 100).toFixed(1) : '0'}</p></div></div><p className="font-bold text-blue-600">{f(p.total)}</p></div>))}</div></div>}
              {prod.byMachine.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-bold text-gray-800 mb-4">Tezgah Bazlı Üretim ({prod.byMachine.length} tezgah)</h3>
                <ResponsiveContainer width="100%" height={Math.max(300, prod.byMachine.length * 35)}>
                  <BarChart data={prod.byMachine} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#3b82f6" name="Üretim" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {prod.byMachine.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{i + 1}</div>
                        <div>
                          <p className="font-semibold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-500">Proje: <span className="text-blue-600 font-medium">{m.project}</span> • {m.defects} fire</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{f(m.total)}</p>
                          <p className="text-xs text-gray-500">üretim</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${m.eff >= 80 ? 'text-green-600' : m.eff >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>%{m.eff}</p>
                          <p className="text-xs text-gray-500">verimlilik</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          </div>
        )}

        {tab === 'warehouse' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">{f(wh.entries)}</p><p className="text-sm text-gray-500">Giriş</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{f(wh.exits)}</p><p className="text-sm text-gray-500">Çıkış</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-gray-600">{f(wh.scrap)}</p><p className="text-sm text-gray-500">Hurda</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {wh.byType.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Hareket Dağılımı</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={wh.byType} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}><Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#6b7280" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div>}
              {wh.topItems.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">En Çok Hareket Gören</h3><ResponsiveContainer width="100%" height={250}><BarChart data={wh.topItems.slice(0, 6)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="Giriş" fill="#10b981" /><Bar dataKey="Çıkış" fill="#ef4444" /></BarChart></ResponsiveContainer></div>}
            </div>
          </div>
        )}

        {tab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-green-600">{fm(fin.income)}</p><p className="text-sm text-gray-500">Gelen</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-red-600">{fm(fin.expense)}</p><p className="text-sm text-gray-500">Giden</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className={`text-3xl font-bold ${fin.bal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fm(fin.bal)}</p><p className="text-sm text-gray-500">Net</p></div>
            </div>
            {fin.daily?.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Günlük Nakit Akışı</h3><ResponsiveContainer width="100%" height={300}><BarChart data={fin.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => fm(v)} /><Legend /><Bar dataKey="Gelen" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Giden" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {fin.byAcc?.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Kasa Bakiyeleri</h3><ResponsiveContainer width="100%" height={250}><BarChart data={fin.byAcc} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => fm(v)} /><Bar dataKey="Bakiye" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>}
              <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Alacak / Borç</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={[{ name: 'Alacak', value: fin.recv }, { name: 'Borç', value: fin.pay }].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}><Cell fill="#10b981" /><Cell fill="#ef4444" /></Pie><Tooltip formatter={(v: number) => fm(v)} /></PieChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        {tab === 'quality' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center"><p className="text-2xl font-bold text-yellow-700">{f(qc.pending)}</p><p className="text-xs text-yellow-600">Bekleyen</p></div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center"><p className="text-2xl font-bold text-green-700">{f(qc.passed)}</p><p className="text-xs text-green-600">Geçen</p></div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center"><p className="text-2xl font-bold text-red-700">{f(qc.failed)}</p><p className="text-xs text-red-600">Red</p></div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center"><p className="text-2xl font-bold text-blue-700">{f(qc.returned)}</p><p className="text-xs text-blue-600">İade</p></div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center"><p className="text-2xl font-bold text-gray-700">{f(qc.scrap)}</p><p className="text-xs text-gray-600">Hurda</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {qcPie.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Sonuç Dağılımı</h3><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={qcPie} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>{qcPie.map((_, i) => <Cell key={i} fill={[COLORS[1], COLORS[3], COLORS[0], COLORS[5]][i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>}
              {(qc.passed + qc.failed) > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Geçme Oranı</h3><div className="flex flex-col items-center justify-center h-[250px]"><p className="text-6xl font-black text-green-600 mb-4">%{(qc.passed / (qc.passed + qc.failed) * 100).toFixed(1)}</p><div className="w-full max-w-md bg-gray-200 rounded-full h-8 overflow-hidden"><div className="bg-green-500 h-full rounded-full" style={{ width: `${(qc.passed / (qc.passed + qc.failed) * 100)}%` }}></div></div><p className="text-sm text-gray-500 mt-3">{f(qc.passed)} geçen / {f(qc.passed + qc.failed)} toplam</p></div></div>}
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-teal-600">{emp.active}</p><p className="text-sm text-gray-500">Aktif ({emp.total} toplam)</p></div>
              <div className="bg-white rounded-xl shadow-sm border p-5 text-center"><p className="text-3xl font-bold text-blue-600">{emp.top.length}</p><p className="text-sm text-gray-500">Üretim Yapan</p></div>
            </div>
            {emp.top.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">En Verimli Personeller</h3><ResponsiveContainer width="100%" height={300}><BarChart data={emp.top}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="Üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="Fire" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
            {emp.top.length > 0 && <div className="bg-white rounded-xl shadow-sm border p-5"><h3 className="font-bold text-gray-800 mb-4">Sıralama</h3><div className="space-y-2">{emp.top.map((e: any, i: number) => (<div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div><div><p className="font-semibold text-sm">{e.name}</p><p className="text-xs text-gray-500">{e.Gün} gün • {e.Fire} fire</p></div></div><p className="font-bold text-blue-600">{f(e.Üretim)}</p></div>))}</div></div>}
          </div>
        )}
      </div>
    </div>
  )
}

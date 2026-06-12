'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Factory, Plus, X, ChevronRight, CheckCircle2, AlertTriangle, Clock,
  Play, Pause, ArrowRight, GripVertical, Trash2, Edit3, Eye, Layers,
  Package, ShieldCheck, Truck, RefreshCw, Activity, TrendingDown,
  PackageOpen, Settings, ListChecks, Printer, Stamp
} from 'lucide-react'

// =====================================================
// TYPES
// =====================================================
type StepType = 'warehouse_in' | 'qc_incoming' | 'operation' | 'qc_intermediate' | 'qc_final' | 'packaging' | 'shipping' | 'note'
type OrderStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold'
type Priority = 'low' | 'normal' | 'high' | 'urgent'

interface ProductRoute {
  id: string
  company_id: string
  project_id: string | null
  route_name: string
  description: string | null
  is_active: boolean
  created_at: string
  project_name?: string
  step_count?: number
}

interface RouteStep {
  id: string
  route_id: string
  step_order: number
  step_name: string
  step_type: StepType
  station_name: string | null
  is_qc_step: boolean
  expected_duration_minutes: number | null
  notes: string | null
}

interface FlowOrder {
  id: string
  company_id: string
  order_number: string
  project_id: string | null
  route_id: string | null
  customer_id: string | null
  customer_name: string | null
  planned_quantity: number
  warehouse_in_quantity: number
  final_accepted_quantity: number
  total_scrap_quantity: number
  current_step_order: number
  status: OrderStatus
  priority: Priority
  planned_start_date: string | null
  planned_end_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  notes: string | null
  created_at: string
  project_name?: string
  route_name?: string
  // Work-order fields
  parca_no?: string | null
  parca_adi?: string | null
  iem_no?: string | null
  revizyon_no?: string | null
  fai?: string | null
  seri?: string | null
  delta_fai?: string | null
  dosya_no?: string | null
  malzeme?: string | null
  alasim_spec?: string | null
  ekipman?: string | null
  operasyon_no?: string | null
  is_merkezi?: string | null
  uygun_miktar?: number
  ret_miktar?: number
  uygunsuzluk_no?: string | null
  teslim_tarihi?: string | null
  baslama_tarihi?: string | null
  bitis_tarihi?: string | null
  dogrulama?: boolean
  dogrulayan?: string | null
  valid_documents?: ValidDocument[]
}

interface ValidDocument {
  name: string
  doc_no: string
  revision: string
  date: string
}

interface StepLog {
  id: string
  order_id: string
  route_step_id: string | null
  step_order: number
  step_name: string
  step_type: StepType
  station_name: string | null
  in_quantity: number
  accepted_quantity: number
  scrap_quantity: number
  rework_quantity: number
  operator_id: string | null
  operator_name: string | null
  machine_id: string | null
  machine_name: string | null
  status: StepStatus
  started_at: string | null
  completed_at: string | null
  qc_result: 'pass' | 'fail' | 'partial' | null
  scrap_reason: string | null
  scrap_destination: 'warehouse_reject' | 'non_compliant' | null
  notes: string | null
}

// =====================================================
// CONSTANTS
// =====================================================
const STEP_TYPES: { value: StepType; label: string; icon: any; color: string }[] = [
  { value: 'warehouse_in', label: 'Depo Girişi', icon: PackageOpen, color: 'bg-amber-100 text-amber-700' },
  { value: 'qc_incoming', label: 'Giriş Kalite Kontrol', icon: ShieldCheck, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'operation', label: 'Operasyon', icon: Factory, color: 'bg-blue-100 text-blue-700' },
  { value: 'qc_intermediate', label: 'Ara Kontrol', icon: ShieldCheck, color: 'bg-orange-100 text-orange-700' },
  { value: 'qc_final', label: 'Son Kontrol', icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
  { value: 'packaging', label: 'Paketleme', icon: Package, color: 'bg-purple-100 text-purple-700' },
  { value: 'shipping', label: 'Sevkiyat', icon: Truck, color: 'bg-green-100 text-green-700' },
  { value: 'note', label: 'Not', icon: Edit3, color: 'bg-yellow-100 text-yellow-800' },
]

const STATUS_MAP: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  planned: { label: 'Planlandı', bg: 'bg-gray-100', text: 'text-gray-700' },
  in_progress: { label: 'Üretimde', bg: 'bg-blue-100', text: 'text-blue-700' },
  on_hold: { label: 'Beklemede', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Tamamlandı', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'İptal', bg: 'bg-red-100', text: 'text-red-700' },
}

const PRIORITY_MAP: Record<Priority, { label: string; bg: string; text: string }> = {
  low: { label: 'Düşük', bg: 'bg-gray-100', text: 'text-gray-700' },
  normal: { label: 'Normal', bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { label: 'Yüksek', bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { label: 'Acil', bg: 'bg-red-100', text: 'text-red-700' },
}

// Hızlı şablon: B6-154 örneğindeki gibi standart akış
const TEMPLATE_STEPS: { step_name: string; step_type: StepType; station_name?: string; is_qc_step: boolean }[] = [
  { step_name: 'Depo Girişi (Hammadde)', step_type: 'warehouse_in', is_qc_step: false },
  { step_name: 'Giriş Kalite Kontrol', step_type: 'qc_incoming', is_qc_step: true },
  { step_name: 'Freze İşlemi', step_type: 'operation', station_name: 'FR01', is_qc_step: false },
  { step_name: 'Ara Kontrol', step_type: 'qc_intermediate', is_qc_step: true },
  { step_name: 'Broş İşlemi', step_type: 'operation', is_qc_step: false },
  { step_name: 'Giriş Kalite Kontrol', step_type: 'qc_incoming', is_qc_step: true },
  { step_name: 'Freze İşlemi', step_type: 'operation', station_name: 'FR02', is_qc_step: false },
  { step_name: 'Ara Kontrol', step_type: 'qc_intermediate', is_qc_step: true },
  { step_name: 'Freze İşlemi', step_type: 'operation', station_name: 'FR03', is_qc_step: false },
  { step_name: 'Ara Kontrol', step_type: 'qc_intermediate', is_qc_step: true },
  { step_name: 'Tromel', step_type: 'operation', is_qc_step: false },
  { step_name: 'Tesviye', step_type: 'operation', is_qc_step: false },
  { step_name: 'Kumlama', step_type: 'operation', is_qc_step: false },
  { step_name: 'Kaplama', step_type: 'operation', is_qc_step: false },
  { step_name: 'Son Kontrol', step_type: 'qc_final', is_qc_step: true },
  { step_name: 'Paketleme', step_type: 'packaging', is_qc_step: false },
  { step_name: 'Müşteriye Sevk', step_type: 'shipping', is_qc_step: false },
]

// =====================================================
// HELPERS
// =====================================================
const getStepTypeInfo = (type: StepType) => STEP_TYPES.find(t => t.value === type) || STEP_TYPES[2]

const generateOrderNumber = () => {
  const now = new Date()
  const y = now.getFullYear().toString().slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const r = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `IE-${y}${m}${d}-${r}`
}

const generateIemNo = () => {
  const now = new Date()
  const y = now.getFullYear().toString().slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `IEM-${y}${m}${d}-${r}`
}

const generateDosyaNo = () => {
  const now = new Date()
  const y = now.getFullYear().toString().slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `DOS-${y}${m}-${r}`
}

// =====================================================
// PAGE
// =====================================================
export default function ProductionFlowPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'prints' | 'routes'>('dashboard')
  const [printLogs, setPrintLogs] = useState<any[]>([])

  const [routes, setRoutes] = useState<ProductRoute[]>([])
  const [orders, setOrders] = useState<FlowOrder[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<ProductRoute | null>(null)

  // Selected order detail
  const [selectedOrder, setSelectedOrder] = useState<FlowOrder | null>(null)
  const [orderStepLogs, setOrderStepLogs] = useState<StepLog[]>([])
  const [activeStepLogId, setActiveStepLogId] = useState<string | null>(null)

  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all')
  const [orderSearch, setOrderSearch] = useState('')

  // Forms
  const emptyOrderForm = {
    // Parça bilgileri
    parca_no: '', parca_adi: '', iem_no: '', revizyon_no: '',
    fai: '', seri: '', delta_fai: '', dosya_no: '',
    // Proje & Müşteri
    project_id: '', customer_id: '', planned_quantity: '',
    // Malzeme & Teknik (ekipman buradan çıktı)
    malzeme: '', alasim_spec: '',
    // Operasyon & Üretim
    operasyon_no: '', is_merkezi: '', uygun_miktar: '', ret_miktar: '', uygunsuzluk_no: '',
    // Tarihler
    teslim_tarihi: '', baslama_tarihi: '', bitis_tarihi: '',
    // Doğrulama
    dogrulama: false, dogrulayan: '',
    // Notlar
    notes: '',
    // Akış (rota + öncelik + plan tarihleri + ekipman)
    route_id: '', priority: 'normal' as Priority,
    planned_start_date: new Date().toISOString().split('T')[0],
    planned_end_date: '',
    ekipman: '',
    // Geçerli Doküman Listesi
    valid_documents: [] as ValidDocument[],
  }
  const [orderForm, setOrderForm] = useState(emptyOrderForm)
  const [routeForm, setRouteForm] = useState({
    project_id: '', route_name: '', description: '',
    steps: [] as { step_name: string; step_type: StepType; station_name: string; is_qc_step: boolean; expected_duration_minutes: string; notes: string }[],
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      await Promise.all([loadRoutes(profile.company_id), loadOrders(profile.company_id), loadRefs(profile.company_id), loadPrintLogs(profile.company_id)])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const loadRefs = async (cid: string) => {
    const [projRes, custRes, empRes, macRes] = await Promise.all([
      supabase.from('projects').select('id, project_code, project_name').eq('company_id', cid).order('project_name'),
      supabase.from('contacts').select('id, contact_name').eq('company_id', cid).eq('is_active', true).order('contact_name'),
      supabase.from('employees').select('id, full_name, employee_code').eq('company_id', cid).eq('status', 'active').order('full_name'),
      supabase.from('machines').select('id, machine_code, machine_name').eq('company_id', cid).order('machine_code'),
    ])
    setProjects(projRes.data || [])
    setCustomers(custRes.data || [])
    setEmployees(empRes.data || [])
    setMachines(macRes.data || [])
  }

  const loadRoutes = async (cid: string) => {
    const { data: routesData } = await supabase
      .from('product_routes')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    const projectIds = (routesData || []).map(r => r.project_id).filter(Boolean)
    const { data: projs } = projectIds.length > 0
      ? await supabase.from('projects').select('id, project_name, project_code').in('id', projectIds)
      : { data: [] }
    const projMap = new Map((projs || []).map(p => [p.id, p]))

    const { data: stepsCnt } = await supabase
      .from('product_route_steps')
      .select('route_id')
      .in('route_id', (routesData || []).map(r => r.id))

    const countMap: Record<string, number> = {}
    ;(stepsCnt || []).forEach((s: any) => { countMap[s.route_id] = (countMap[s.route_id] || 0) + 1 })

    setRoutes((routesData || []).map(r => ({
      ...r,
      project_name: r.project_id ? (projMap.get(r.project_id) as any)?.project_name : null,
      step_count: countMap[r.id] || 0,
    })))
  }

  const loadOrders = async (cid: string) => {
    const { data: ordersData } = await supabase
      .from('production_flow_orders')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })

    const projectIds = Array.from(new Set((ordersData || []).map(o => o.project_id).filter(Boolean)))
    const routeIds = Array.from(new Set((ordersData || []).map(o => o.route_id).filter(Boolean)))

    const [projsRes, routesRes] = await Promise.all([
      projectIds.length > 0 ? supabase.from('projects').select('id, project_name, project_code').in('id', projectIds) : Promise.resolve({ data: [] }),
      routeIds.length > 0 ? supabase.from('product_routes').select('id, route_name').in('id', routeIds) : Promise.resolve({ data: [] }),
    ])
    const projMap = new Map((projsRes.data || []).map((p: any) => [p.id, p]))
    const routeMap = new Map((routesRes.data || []).map((r: any) => [r.id, r]))

    setOrders((ordersData || []).map(o => ({
      ...o,
      project_name: o.project_id ? (projMap.get(o.project_id) as any)?.project_name : null,
      route_name: o.route_id ? (routeMap.get(o.route_id) as any)?.route_name : null,
    })))
  }

  const loadPrintLogs = async (cid: string) => {
    const { data } = await supabase
      .from('production_flow_print_logs')
      .select('*')
      .eq('company_id', cid)
      .order('printed_at', { ascending: false })
    setPrintLogs(data || [])
  }

  const logPrintEvent = async (order: FlowOrder, values: { iem_no: string; baslama: string; bitis: string; teslim: string }) => {
    if (!companyId) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = user ? await supabase.from('profiles').select('full_name').eq('id', user.id).single() : { data: null }
      await supabase.from('production_flow_print_logs').insert({
        company_id: companyId,
        order_id: order.id,
        order_number: order.order_number,
        project_name: order.project_name || null,
        parca_adi: order.parca_adi || null,
        iem_no: values.iem_no || null,
        baslama_tarihi: values.baslama || null,
        bitis_tarihi: values.bitis || null,
        teslim_tarihi: values.teslim || null,
        printed_by: user?.id || null,
        printed_by_name: (profile as any)?.full_name || null,
      })
      await loadPrintLogs(companyId)
    } catch (err) {
      console.error('Print log error:', err)
    }
  }

  const deletePrintLog = async (logId: string) => {
    if (!confirm('Bu yazdırma kaydını silmek istediğine emin misin?')) return
    try {
      await supabase.from('production_flow_print_logs').delete().eq('id', logId)
      await loadPrintLogs(companyId!)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const loadStepLogs = async (orderId: string) => {
    const { data } = await supabase
      .from('production_flow_step_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('step_order', { ascending: true })
    setOrderStepLogs(data || [])
  }

  // =====================================================
  // ROUTE CRUD
  // =====================================================
  const openNewRoute = () => {
    setEditingRoute(null)
    setRouteForm({
      project_id: '', route_name: '', description: '',
      steps: TEMPLATE_STEPS.map(s => ({
        step_name: s.step_name,
        step_type: s.step_type,
        station_name: s.station_name || '',
        is_qc_step: s.is_qc_step,
        expected_duration_minutes: '',
        notes: '',
      })),
    })
    setShowRouteModal(true)
  }

  const openEditRoute = async (route: ProductRoute) => {
    setEditingRoute(route)
    const { data: steps } = await supabase
      .from('product_route_steps')
      .select('*')
      .eq('route_id', route.id)
      .order('step_order')
    setRouteForm({
      project_id: route.project_id || '',
      route_name: route.route_name,
      description: route.description || '',
      steps: (steps || []).map(s => ({
        step_name: s.step_name,
        step_type: s.step_type,
        station_name: s.station_name || '',
        is_qc_step: s.is_qc_step,
        expected_duration_minutes: s.expected_duration_minutes?.toString() || '',
        notes: s.notes || '',
      })),
    })
    setShowRouteModal(true)
  }

  const saveRoute = async () => {
    if (!routeForm.route_name || !routeForm.project_id || !companyId) return alert('Ürün ve rota adı zorunlu!')
    if (routeForm.steps.length === 0) return alert('En az 1 adım eklemelisin!')

    try {
      let routeId = editingRoute?.id
      if (editingRoute) {
        await supabase.from('product_routes').update({
          project_id: routeForm.project_id,
          route_name: routeForm.route_name,
          description: routeForm.description || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editingRoute.id)
        // Replace steps
        await supabase.from('product_route_steps').delete().eq('route_id', editingRoute.id)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase.from('product_routes').insert({
          company_id: companyId,
          project_id: routeForm.project_id,
          route_name: routeForm.route_name,
          description: routeForm.description || null,
          created_by: user?.id,
        }).select().single()
        if (error) throw error
        routeId = data.id
      }

      const stepsPayload = routeForm.steps.map((s, idx) => ({
        route_id: routeId,
        step_order: idx + 1,
        step_name: s.step_name,
        step_type: s.step_type,
        station_name: s.station_name || null,
        is_qc_step: s.is_qc_step,
        expected_duration_minutes: s.expected_duration_minutes ? parseInt(s.expected_duration_minutes) : null,
        notes: s.notes || null,
      }))
      const { error: stepErr } = await supabase.from('product_route_steps').insert(stepsPayload)
      if (stepErr) throw stepErr

      alert('✅ Rota kaydedildi!')
      setShowRouteModal(false)
      await loadRoutes(companyId)
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  const deleteRoute = async (route: ProductRoute) => {
    if (!confirm(`"${route.route_name}" rotasını silmek istediğine emin misin?`)) return
    try {
      await supabase.from('product_routes').delete().eq('id', route.id)
      await loadRoutes(companyId!)
      alert('Rota silindi.')
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const addStepToRoute = () => {
    setRouteForm({
      ...routeForm,
      steps: [...routeForm.steps, { step_name: '', step_type: 'operation', station_name: '', is_qc_step: false, expected_duration_minutes: '', notes: '' }],
    })
  }
  const removeStepFromRoute = (idx: number) => {
    setRouteForm({ ...routeForm, steps: routeForm.steps.filter((_, i) => i !== idx) })
  }
  const moveStep = (idx: number, dir: -1 | 1) => {
    const newSteps = [...routeForm.steps]
    const target = idx + dir
    if (target < 0 || target >= newSteps.length) return
    ;[newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]]
    setRouteForm({ ...routeForm, steps: newSteps })
  }

  // =====================================================
  // ORDER CRUD
  // =====================================================
  const openNewOrder = () => {
    setOrderForm({
      ...emptyOrderForm,
      // IEM No artık manuel — kullanıcı yazacak
      dosya_no: generateDosyaNo(),
    })
    setShowOrderModal(true)
  }

  // Auto-pick route when project selected
  useEffect(() => {
    if (orderForm.project_id) {
      const matching = routes.find(r => r.project_id === orderForm.project_id && r.is_active)
      if (matching && !orderForm.route_id) {
        setOrderForm(prev => ({ ...prev, route_id: matching.id }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderForm.project_id])

  const saveOrder = async () => {
    if (!orderForm.parca_adi) return alert('Parça adı zorunlu!')
    if (!orderForm.project_id) return alert('Proje seçimi zorunlu!')
    if (!orderForm.route_id) return alert('Rota seçimi zorunlu!')
    if (!orderForm.planned_quantity) return alert('Planlanan miktar zorunlu!')
    if (!companyId) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const customerName = customers.find(c => c.id === orderForm.customer_id)?.contact_name || null

      // Insert order
      const { data: orderData, error: orderErr } = await supabase.from('production_flow_orders').insert({
        company_id: companyId,
        order_number: generateOrderNumber(),
        // Parça bilgileri
        parca_no: orderForm.parca_no || null,
        parca_adi: orderForm.parca_adi || null,
        iem_no: orderForm.iem_no || null,
        revizyon_no: orderForm.revizyon_no || null,
        fai: orderForm.fai || null,
        seri: orderForm.seri || null,
        delta_fai: orderForm.delta_fai || null,
        dosya_no: orderForm.dosya_no || null,
        // Proje & Müşteri
        project_id: orderForm.project_id,
        customer_id: orderForm.customer_id || null,
        customer_name: customerName,
        planned_quantity: parseFloat(orderForm.planned_quantity),
        // Malzeme & Teknik
        malzeme: orderForm.malzeme || null,
        alasim_spec: orderForm.alasim_spec || null,
        ekipman: orderForm.ekipman || null,
        // Operasyon & Üretim
        operasyon_no: orderForm.operasyon_no || null,
        is_merkezi: orderForm.is_merkezi || null,
        uygun_miktar: parseFloat(orderForm.uygun_miktar || '0'),
        ret_miktar: parseFloat(orderForm.ret_miktar || '0'),
        uygunsuzluk_no: orderForm.uygunsuzluk_no || null,
        // Tarihler
        teslim_tarihi: orderForm.teslim_tarihi || null,
        baslama_tarihi: orderForm.baslama_tarihi || null,
        bitis_tarihi: orderForm.bitis_tarihi || null,
        // Doğrulama
        dogrulama: orderForm.dogrulama,
        dogrulayan: orderForm.dogrulayan || null,
        // Notlar
        notes: orderForm.notes || null,
        // Akış
        route_id: orderForm.route_id,
        priority: orderForm.priority,
        planned_start_date: orderForm.planned_start_date || null,
        planned_end_date: orderForm.planned_end_date || null,
        valid_documents: orderForm.valid_documents || [],
        created_by: user?.id,
      }).select().single()
      if (orderErr) throw orderErr

      // Create step logs from route steps
      const { data: routeSteps } = await supabase
        .from('product_route_steps')
        .select('*')
        .eq('route_id', orderForm.route_id)
        .order('step_order')

      const logsPayload = (routeSteps || []).map(rs => ({
        order_id: orderData.id,
        route_step_id: rs.id,
        step_order: rs.step_order,
        step_name: rs.step_name,
        step_type: rs.step_type,
        station_name: rs.station_name,
        notes: rs.notes || null,
        // Note tipi adımlar otomatik tamamlanmış — sadece bilgilendirme amaçlı, akışı bloklamaz
        status: rs.step_type === 'note' ? 'completed' : 'pending',
        created_by: user?.id,
      }))
      if (logsPayload.length > 0) {
        await supabase.from('production_flow_step_logs').insert(logsPayload)
      }

      alert('✅ İş emri oluşturuldu!')
      setShowOrderModal(false)
      await loadOrders(companyId)
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // =====================================================
  // ORDER FLOW ACTIONS
  // =====================================================
  const openOrderDetail = async (order: FlowOrder) => {
    setSelectedOrder(order)
    await loadStepLogs(order.id)
  }

  const deleteOrder = async (order: FlowOrder) => {
    if (!confirm(`"${order.order_number}" iş emrini silmek istediğine emin misin?\n\nTüm adım kayıtları da silinecek. Bu işlem geri alınamaz.`)) return
    try {
      // step logs CASCADE ile DB tarafında silinir (FK ON DELETE CASCADE)
      const { error } = await supabase.from('production_flow_orders').delete().eq('id', order.id)
      if (error) throw error
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null)
        setActiveStepLogId(null)
      }
      await loadOrders(companyId!)
      alert('✅ İş emri silindi.')
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  const startOrder = async (order: FlowOrder) => {
    if (!confirm(`"${order.order_number}" iş emrini başlatmak istiyor musun?\n\n${order.planned_quantity} adet ilk adımdan başlayacak.`)) return
    try {
      // İlk operasyonel adım (note tipi atla)
      const firstLog = orderStepLogs.find(l => l.step_type !== 'note')
      if (!firstLog) return alert('Adım bulunamadı!')

      await supabase.from('production_flow_orders').update({
        status: 'in_progress',
        actual_start_date: new Date().toISOString(),
        warehouse_in_quantity: order.planned_quantity,
        current_step_order: firstLog.step_order,
      }).eq('id', order.id)

      await supabase.from('production_flow_step_logs').update({
        in_quantity: order.planned_quantity,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }).eq('id', firstLog.id)

      await loadOrders(companyId!)
      await loadStepLogs(order.id)
      setSelectedOrder({ ...order, status: 'in_progress' as OrderStatus, warehouse_in_quantity: order.planned_quantity, current_step_order: firstLog.step_order })
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  const completeStep = async (log: StepLog, payload: {
    accepted_quantity: number; scrap_quantity: number; rework_quantity: number;
    operator_id?: string; machine_id?: string; qc_result?: 'pass' | 'fail' | 'partial';
    scrap_reason?: string; scrap_destination?: 'warehouse_reject' | 'non_compliant'; notes?: string;
  }) => {
    if (!selectedOrder) return
    try {
      const total = payload.accepted_quantity + payload.scrap_quantity + payload.rework_quantity
      if (total > log.in_quantity + 0.001) {
        return alert(`Toplam (${total}) giriş miktarını (${log.in_quantity}) aşamaz!`)
      }

      const operatorName = payload.operator_id ? employees.find(e => e.id === payload.operator_id)?.full_name : null
      const machineName = payload.machine_id ? machines.find(m => m.id === payload.machine_id)?.machine_name : null

      await supabase.from('production_flow_step_logs').update({
        accepted_quantity: payload.accepted_quantity,
        scrap_quantity: payload.scrap_quantity,
        rework_quantity: payload.rework_quantity,
        operator_id: payload.operator_id || null,
        operator_name: operatorName || null,
        machine_id: payload.machine_id || null,
        machine_name: machineName || null,
        qc_result: payload.qc_result || null,
        scrap_reason: payload.scrap_reason || null,
        scrap_destination: payload.scrap_destination || null,
        notes: payload.notes || null,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', log.id)

      // Move to next operational step (skip note-type steps)
      const nextLog = orderStepLogs
        .filter(l => l.step_order > log.step_order && l.step_type !== 'note')
        .sort((a, b) => a.step_order - b.step_order)[0]
      if (nextLog) {
        await supabase.from('production_flow_step_logs').update({
          in_quantity: payload.accepted_quantity,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }).eq('id', nextLog.id)

        await supabase.from('production_flow_orders').update({
          current_step_order: nextLog.step_order,
          total_scrap_quantity: (selectedOrder.total_scrap_quantity || 0) + payload.scrap_quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedOrder.id)
      } else {
        // Last step done
        await supabase.from('production_flow_orders').update({
          status: 'completed',
          actual_end_date: new Date().toISOString(),
          final_accepted_quantity: payload.accepted_quantity,
          total_scrap_quantity: (selectedOrder.total_scrap_quantity || 0) + payload.scrap_quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedOrder.id)
      }

      await loadOrders(companyId!)
      await loadStepLogs(selectedOrder.id)
      const updated = (await supabase.from('production_flow_orders').select('*').eq('id', selectedOrder.id).single()).data
      if (updated) setSelectedOrder(updated as any)
      setActiveStepLogId(null)
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // =====================================================
  // STATS
  // =====================================================
  const stats = {
    total: orders.length,
    active: orders.filter(o => o.status === 'in_progress').length,
    planned: orders.filter(o => o.status === 'planned').length,
    completed: orders.filter(o => o.status === 'completed').length,
    totalScrap: orders.reduce((s, o) => s + (o.total_scrap_quantity || 0), 0),
    totalPlanned: orders.reduce((s, o) => s + (o.planned_quantity || 0), 0),
    scrapRate: 0,
  }
  stats.scrapRate = stats.totalPlanned > 0 ? (stats.totalScrap / stats.totalPlanned) * 100 : 0

  const filteredOrders = orders.filter(o => {
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false
    if (orderSearch && !o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) && !(o.project_name || '').toLowerCase().includes(orderSearch.toLowerCase())) return false
    return true
  })

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <PermissionGuard module="production" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Üretim Akışı</h2>
            <p className="text-gray-600">İş emirleri, rota şablonları ve adım bazlı üretim takibi</p>
          </div>
          {activeTab === 'orders' && (
            <button onClick={openNewOrder} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg">
              <Plus className="w-5 h-5" /> Yeni İş Emri
            </button>
          )}
          {activeTab === 'routes' && (
            <button onClick={openNewRoute} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg">
              <Plus className="w-5 h-5" /> Yeni Rota
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex gap-1 flex-wrap">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'orders', label: 'İş Emirleri', icon: ListChecks },
            { id: 'prints', label: 'İş Emri Listesi (Yazdırılanlar)', icon: Printer },
            { id: 'routes', label: 'Rotalar', icon: Layers },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => { setSelectedOrder(null); setActiveTab(tab.id as any) }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* ===== DASHBOARD ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Toplam İş Emri" value={stats.total} icon={Factory} color="blue" />
              <StatCard title="Üretimde" value={stats.active} icon={Play} color="yellow" />
              <StatCard title="Tamamlanan" value={stats.completed} icon={CheckCircle2} color="green" />
              <StatCard title="Hurda Oranı" value={`%${stats.scrapRate.toFixed(2)}`} icon={TrendingDown} color="red" />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Aktif İş Emirleri</h3>
              {orders.filter(o => o.status === 'in_progress').length === 0 ? (
                <p className="text-center text-gray-400 py-8">Aktif iş emri yok</p>
              ) : (
                <div className="space-y-2">
                  {orders.filter(o => o.status === 'in_progress').map(o => (
                    <button
                      key={o.id}
                      onClick={() => { setActiveTab('orders'); openOrderDetail(o) }}
                      className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                    >
                      <div>
                        <div className="font-bold text-gray-800">{o.order_number}</div>
                        <div className="text-sm text-gray-600">{o.project_name || '-'} • {o.planned_quantity} adet</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Adım {o.current_step_order}</div>
                        <ChevronRight className="w-5 h-5 text-blue-600 inline" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== İŞ EMİRLERİ ===== */}
        {activeTab === 'orders' && !selectedOrder && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
              <input
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="İş emri no veya ürün ara..."
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">Tüm Durumlar</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İş Emri</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ürün</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Rota</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Planlanan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Adım</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Hurda</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Öncelik</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map(o => {
                    const st = STATUS_MAP[o.status]
                    const pr = PRIORITY_MAP[o.priority]
                    return (
                      <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openOrderDetail(o)}>
                        <td className="px-4 py-3 font-bold text-gray-800">{o.order_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{o.project_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{o.route_name || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">{o.planned_quantity}</td>
                        <td className="px-4 py-3 text-right text-sm">{o.current_step_order}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-600 font-semibold">{o.total_scrap_quantity || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${pr.bg} ${pr.text}`}>{pr.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openOrderDetail(o)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Detay">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteOrder(o)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Sil">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredOrders.length === 0 && <p className="text-center text-gray-400 py-12">İş emri bulunamadı</p>}
            </div>
          </>
        )}

        {/* ===== İŞ EMRİ DETAY (FLOW VIEW) ===== */}
        {activeTab === 'orders' && selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            stepLogs={orderStepLogs}
            employees={employees}
            machines={machines}
            activeStepLogId={activeStepLogId}
            setActiveStepLogId={setActiveStepLogId}
            onBack={() => { setSelectedOrder(null); setActiveStepLogId(null) }}
            onStart={() => startOrder(selectedOrder)}
            onCompleteStep={completeStep}
            onDelete={() => deleteOrder(selectedOrder)}
            onLogPrint={(vals) => logPrintEvent(selectedOrder, vals)}
          />
        )}

        {/* ===== İŞ EMRİ LİSTESİ (Yazdırılan PDF'ler) ===== */}
        {activeTab === 'prints' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Printer className="w-6 h-6 text-amber-600" />
                <div>
                  <h3 className="font-bold text-amber-900">Yazdırılan İş Emirleri</h3>
                  <p className="text-xs text-amber-700">PDF olarak yazdırılan tüm iş emirlerinin kaydı — IEM No, tarihler ve yazdıran kişi ile</p>
                </div>
              </div>
            </div>

            {printLogs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Printer className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">Henüz yazdırılan iş emri yok</p>
                <p className="text-sm text-gray-400">İş Emirleri'ne git ve "PDF Yazdır" butonunu kullan.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İş Emri No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Parça / Ürün</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">IEM No (Yazdırılan)</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Başlama</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Bitiş</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Teslim</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Yazdıran</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {printLogs.map(log => {
                      const order = orders.find(o => o.id === log.order_id)
                      const fmtD = (d?: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-gray-800">{log.order_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{log.parca_adi || log.project_name || '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono text-blue-700">{log.iem_no || '-'}</td>
                          <td className="px-4 py-3 text-center text-sm">{fmtD(log.baslama_tarihi)}</td>
                          <td className="px-4 py-3 text-center text-sm">{fmtD(log.bitis_tarihi)}</td>
                          <td className="px-4 py-3 text-center text-sm">{fmtD(log.teslim_tarihi)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.printed_by_name || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {order && (
                                <button onClick={() => { setActiveTab('orders'); openOrderDetail(order) }}
                                  className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="İş emrini aç">
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => deletePrintLog(log.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Kayıt sil">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== ROTALAR ===== */}
        {activeTab === 'routes' && (
          <div className="space-y-3">
            {routes.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Layers className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">Henüz rota tanımlanmamış</p>
                <p className="text-sm text-gray-400 mb-4">İş emri açabilmek için önce bir ürün için rota oluştur.</p>
                <button onClick={openNewRoute} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> İlk Rotanı Oluştur
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {routes.map(r => (
                  <div key={r.id} className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{r.route_name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{r.project_name || '— ürün tanımlanmamış —'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditRoute(r)} className="p-2 hover:bg-blue-50 rounded text-blue-600"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteRoute(r)} className="p-2 hover:bg-red-50 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {r.description && <p className="text-sm text-gray-600 mb-3">{r.description}</p>}
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Layers className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold">{r.step_count}</span> adım
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== YENİ İŞ EMRİ MODAL (work-orders form + akış bilgileri) ===== */}
        {showOrderModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowOrderModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Sticky header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
                <h3 className="text-xl font-bold text-gray-800">Yeni İş Emri</h3>
                <button onClick={() => setShowOrderModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Parça Bilgileri (IEM No manuel, Dosya No oto-üretilir) */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">📋 Parça Bilgileri</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Parça No">
                      <input type="text" value={orderForm.parca_no} onChange={e => setOrderForm({ ...orderForm, parca_no: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Parça Adı *">
                      <input type="text" value={orderForm.parca_adi} onChange={e => setOrderForm({ ...orderForm, parca_adi: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="IEM No">
                      <input type="text" value={orderForm.iem_no} onChange={e => setOrderForm({ ...orderForm, iem_no: e.target.value })} placeholder="örn. IEM-2026-001" className={inputCls} />
                    </Field>
                    <Field label="Revizyon No">
                      <input type="text" value={orderForm.revizyon_no} onChange={e => setOrderForm({ ...orderForm, revizyon_no: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="FAI">
                      <input type="text" value={orderForm.fai} onChange={e => setOrderForm({ ...orderForm, fai: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Seri">
                      <input type="text" value={orderForm.seri} onChange={e => setOrderForm({ ...orderForm, seri: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Delta FAI">
                      <input type="text" value={orderForm.delta_fai} onChange={e => setOrderForm({ ...orderForm, delta_fai: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Dosya No (otomatik)">
                      <input type="text" value={orderForm.dosya_no} onChange={e => setOrderForm({ ...orderForm, dosya_no: e.target.value })} className={`${inputCls} bg-gray-50`} />
                    </Field>
                  </div>
                </div>

                {/* Proje & Müşteri */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">🏭 Proje & Müşteri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Proje / Ürün *">
                      <select value={orderForm.project_id} onChange={e => setOrderForm({ ...orderForm, project_id: e.target.value, route_id: '' })} className={inputCls}>
                        <option value="">Seçin...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_code ? `${p.project_code} — ` : ''}{p.project_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Müşteri">
                      <select value={orderForm.customer_id} onChange={e => setOrderForm({ ...orderForm, customer_id: e.target.value })} className={inputCls}>
                        <option value="">Seçin...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.contact_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Planlanan Miktar *">
                      <input type="number" value={orderForm.planned_quantity} onChange={e => setOrderForm({ ...orderForm, planned_quantity: e.target.value })} className={inputCls} placeholder="örn. 1000" />
                    </Field>
                  </div>
                </div>

                {/* Malzeme & Teknik (ekipman çıkarıldı, akış bölümüne taşındı) */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">🧱 Malzeme & Teknik</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Malzeme">
                      <input type="text" value={orderForm.malzeme} onChange={e => setOrderForm({ ...orderForm, malzeme: e.target.value })} placeholder="Örn: Al 7075-T7351" className={inputCls} />
                    </Field>
                    <Field label="Alaşım & Spec">
                      <input type="text" value={orderForm.alasim_spec} onChange={e => setOrderForm({ ...orderForm, alasim_spec: e.target.value })} placeholder="Örn: AMS-QQ-A-250/12" className={inputCls} />
                    </Field>
                  </div>
                </div>

                {/* Operasyon & Üretim */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">⚙️ Operasyon & Üretim</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Operasyon No">
                      <input type="text" value={orderForm.operasyon_no} onChange={e => setOrderForm({ ...orderForm, operasyon_no: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="İş Merkezi">
                      <input type="text" value={orderForm.is_merkezi} onChange={e => setOrderForm({ ...orderForm, is_merkezi: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Uygun Miktar">
                      <input type="number" value={orderForm.uygun_miktar} onChange={e => setOrderForm({ ...orderForm, uygun_miktar: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Ret Miktar">
                      <input type="number" value={orderForm.ret_miktar} onChange={e => setOrderForm({ ...orderForm, ret_miktar: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Uygunsuzluk No">
                      <input type="text" value={orderForm.uygunsuzluk_no} onChange={e => setOrderForm({ ...orderForm, uygunsuzluk_no: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                </div>

                {/* Tarihler */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">📅 Tarihler</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Teslim Tarihi">
                      <input type="date" value={orderForm.teslim_tarihi} onChange={e => setOrderForm({ ...orderForm, teslim_tarihi: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Başlama Tarihi">
                      <input type="date" value={orderForm.baslama_tarihi} onChange={e => setOrderForm({ ...orderForm, baslama_tarihi: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Bitiş Tarihi">
                      <input type="date" value={orderForm.bitis_tarihi} onChange={e => setOrderForm({ ...orderForm, bitis_tarihi: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                </div>

                {/* Notlar */}
                <Field label="Notlar">
                  <textarea value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2} placeholder="Ek notlar..." className={inputCls} />
                </Field>

                {/* ===== GEÇERLİ DOKÜMAN LİSTESİ ===== */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b pb-1">
                    <h4 className="text-sm font-bold text-gray-700">📑 Geçerli Doküman Listesi</h4>
                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, valid_documents: [...orderForm.valid_documents, { name: '', doc_no: '', revision: '', date: '' }] })}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Doküman Ekle
                    </button>
                  </div>
                  {orderForm.valid_documents.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Henüz doküman eklenmedi (teknik resim, FAI belgesi, kalite planı, vb.)</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-500 uppercase">
                        <div className="col-span-4">Doküman Adı</div>
                        <div className="col-span-3">Doküman No</div>
                        <div className="col-span-2">Revizyon</div>
                        <div className="col-span-2">Tarih</div>
                        <div className="col-span-1"></div>
                      </div>
                      {orderForm.valid_documents.map((doc, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2">
                          <input value={doc.name} onChange={e => {
                            const nd = [...orderForm.valid_documents]; nd[idx].name = e.target.value; setOrderForm({ ...orderForm, valid_documents: nd })
                          }} placeholder="Teknik Resim" className="col-span-4 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                          <input value={doc.doc_no} onChange={e => {
                            const nd = [...orderForm.valid_documents]; nd[idx].doc_no = e.target.value; setOrderForm({ ...orderForm, valid_documents: nd })
                          }} placeholder="DR-12345" className="col-span-3 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                          <input value={doc.revision} onChange={e => {
                            const nd = [...orderForm.valid_documents]; nd[idx].revision = e.target.value; setOrderForm({ ...orderForm, valid_documents: nd })
                          }} placeholder="A" className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                          <input type="date" value={doc.date} onChange={e => {
                            const nd = [...orderForm.valid_documents]; nd[idx].date = e.target.value; setOrderForm({ ...orderForm, valid_documents: nd })
                          }} className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                          <button onClick={() => setOrderForm({ ...orderForm, valid_documents: orderForm.valid_documents.filter((_, i) => i !== idx) })}
                            className="col-span-1 p-1.5 text-red-500 hover:bg-red-50 rounded flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ===== AKIŞ BİLGİLERİ (sonda) ===== */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                  <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" /> Üretim Akışı Bilgileri
                  </h4>
                  <p className="text-xs text-blue-700 mb-4">Bu iş emri hangi rotayı izleyecek ve nasıl planlanacak?</p>
                  <div className="space-y-3">
                    <Field label="Rota / İş Akışı *">
                      <select value={orderForm.route_id} onChange={e => setOrderForm({ ...orderForm, route_id: e.target.value })} className={inputCls}>
                        <option value="">Seçin...</option>
                        {routes.filter(r => !orderForm.project_id || r.project_id === orderForm.project_id).map(r => (
                          <option key={r.id} value={r.id}>{r.route_name} ({r.step_count} adım)</option>
                        ))}
                      </select>
                      {orderForm.project_id && routes.filter(r => r.project_id === orderForm.project_id).length === 0 && (
                        <p className="text-xs text-orange-700 mt-1">⚠ Bu ürün için rota tanımlanmamış. Önce Rotalar sekmesinden oluştur.</p>
                      )}
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Planlanan Başlangıç">
                        <input type="date" value={orderForm.planned_start_date} onChange={e => setOrderForm({ ...orderForm, planned_start_date: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Planlanan Bitiş">
                        <input type="date" value={orderForm.planned_end_date} onChange={e => setOrderForm({ ...orderForm, planned_end_date: e.target.value })} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3 rounded-b-2xl">
                <button onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100">İptal</button>
                <button onClick={saveOrder} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">Oluştur</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== ROTA MODAL ===== */}
        {showRouteModal && (
          <Modal title={editingRoute ? 'Rotayı Düzenle' : 'Yeni Rota'} onClose={() => setShowRouteModal(false)} large>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ürün / Parça *">
                  <select value={routeForm.project_id} onChange={e => setRouteForm({ ...routeForm, project_id: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code ? `${p.project_code} — ` : ''}{p.project_name}</option>)}
                  </select>
                </Field>
                <Field label="Rota Adı *">
                  <input value={routeForm.route_name} onChange={e => setRouteForm({ ...routeForm, route_name: e.target.value })} className={inputCls} placeholder="örn. B6-154 Standart Akış" />
                </Field>
              </div>
              <Field label="Açıklama">
                <textarea value={routeForm.description} onChange={e => setRouteForm({ ...routeForm, description: e.target.value })} className={inputCls} rows={2} />
              </Field>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800">Adımlar ({routeForm.steps.length})</h4>
                  <div className="flex gap-2">
                    <button onClick={() => setRouteForm({ ...routeForm, steps: [...routeForm.steps, { step_name: 'NOT', step_type: 'note', station_name: '', is_qc_step: false, expected_duration_minutes: '', notes: '' }] })}
                      className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                      <Edit3 className="w-4 h-4" /> Not Ekle
                    </button>
                    <button onClick={addStepToRoute} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Adım Ekle
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {routeForm.steps.map((step, idx) => {
                    const info = getStepTypeInfo(step.step_type)
                    const Icon = info.icon
                    const isNote = step.step_type === 'note'
                    return (
                      <div key={idx} className={`p-3 rounded-lg border flex items-start gap-2 ${
                        isNote ? 'bg-yellow-50 border-yellow-300 border-dashed' : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex flex-col gap-1 pt-1">
                          <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">▲</button>
                          <span className="text-xs text-gray-500 text-center">{idx + 1}</span>
                          <button onClick={() => moveStep(idx, 1)} disabled={idx === routeForm.steps.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">▼</button>
                        </div>
                        <div className={`p-2 rounded ${info.color}`}><Icon className="w-4 h-4" /></div>
                        <div className="flex-1 space-y-2">
                          {isNote ? (
                            // Sadece not metni
                            <div>
                              <div className="text-xs font-semibold text-yellow-800 mb-1 flex items-center gap-2">
                                📝 Adımlar Arası Not
                                <select value={step.step_type} onChange={e => {
                                  const ns = [...routeForm.steps]
                                  const t = e.target.value as StepType
                                  ns[idx].step_type = t
                                  ns[idx].is_qc_step = t.startsWith('qc_')
                                  setRouteForm({ ...routeForm, steps: ns })
                                }} className="ml-auto px-2 py-0.5 border border-gray-300 rounded text-xs bg-white">
                                  {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              <textarea value={step.notes} onChange={e => {
                                const ns = [...routeForm.steps]; ns[idx].notes = e.target.value; setRouteForm({ ...routeForm, steps: ns })
                              }} placeholder="Notu buraya yaz... (örn. Bu adımdan sonra parça soğutulmalı, fikstür değiştirilmeli vb.)" rows={2}
                                className="w-full px-2 py-1 border border-yellow-300 rounded text-sm bg-white" />
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={step.step_name} onChange={e => {
                                  const ns = [...routeForm.steps]; ns[idx].step_name = e.target.value; setRouteForm({ ...routeForm, steps: ns })
                                }} placeholder="Adım adı" className="px-2 py-1 border border-gray-300 rounded text-sm" />
                                <select value={step.step_type} onChange={e => {
                                  const ns = [...routeForm.steps]
                                  const t = e.target.value as StepType
                                  ns[idx].step_type = t
                                  ns[idx].is_qc_step = t.startsWith('qc_')
                                  setRouteForm({ ...routeForm, steps: ns })
                                }} className="px-2 py-1 border border-gray-300 rounded text-sm">
                                  {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={step.station_name} onChange={e => {
                                  const ns = [...routeForm.steps]; ns[idx].station_name = e.target.value; setRouteForm({ ...routeForm, steps: ns })
                                }} placeholder="İstasyon (örn. FR01)" className="px-2 py-1 border border-gray-300 rounded text-sm" />
                                <input type="number" value={step.expected_duration_minutes} onChange={e => {
                                  const ns = [...routeForm.steps]; ns[idx].expected_duration_minutes = e.target.value; setRouteForm({ ...routeForm, steps: ns })
                                }} placeholder="Süre (dk)" className="px-2 py-1 border border-gray-300 rounded text-sm" />
                              </div>
                              <textarea value={step.notes} onChange={e => {
                                const ns = [...routeForm.steps]; ns[idx].notes = e.target.value; setRouteForm({ ...routeForm, steps: ns })
                              }} placeholder="Adım notu (talimat, dikkat edilecek noktalar, vb.)" rows={2}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-yellow-50/50" />
                            </>
                          )}
                        </div>
                        <button onClick={() => removeStepFromRoute(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowRouteModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveRoute} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingRoute ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </PermissionGuard>
  )
}

// =====================================================
// SUBCOMPONENTS
// =====================================================
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose, large }: { title: string; children: React.ReactNode; onClose: () => void; large?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl p-6 w-full ${large ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    yellow: 'border-yellow-500 text-yellow-600',
    green: 'border-green-500 text-green-600',
    red: 'border-red-500 text-red-600',
  }
  return (
    <div className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <Icon className={`w-12 h-12 ${colorMap[color]}`} />
      </div>
    </div>
  )
}

// =====================================================
// ORDER DETAIL (FLOW VIEW)
// =====================================================
function OrderDetail({
  order, stepLogs, employees, machines, activeStepLogId, setActiveStepLogId, onBack, onStart, onCompleteStep, onDelete, onLogPrint,
}: {
  order: FlowOrder; stepLogs: StepLog[]; employees: any[]; machines: any[];
  activeStepLogId: string | null; setActiveStepLogId: (id: string | null) => void;
  onBack: () => void; onStart: () => void;
  onCompleteStep: (log: StepLog, payload: any) => void;
  onDelete: () => void;
  onLogPrint: (vals: { iem_no: string; baslama: string; bitis: string; teslim: string }) => void;
}) {
  const status = STATUS_MAP[order.status]
  const isStarted = order.status === 'in_progress' || order.status === 'completed'
  const activeStep = stepLogs.find(l => l.status === 'in_progress')

  // PDF tarih + IEM sorgu modal'ı
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printBaslama, setPrintBaslama] = useState(order.baslama_tarihi || order.planned_start_date || '')
  const [printBitis, setPrintBitis] = useState(order.bitis_tarihi || order.planned_end_date || '')
  const [printTeslim, setPrintTeslim] = useState(order.teslim_tarihi || '')
  const [printIemNo, setPrintIemNo] = useState(order.iem_no || '')

  const handlePrint = (override?: { baslama: string; bitis: string; teslim: string; iem_no: string }) => {
    const useBaslama = override?.baslama ?? printBaslama
    const useBitis = override?.bitis ?? printBitis
    const useTeslim = override?.teslim ?? printTeslim
    const useIemNo = override?.iem_no ?? printIemNo
    const printWin = window.open('', '_blank', 'width=1100,height=800')
    if (!printWin) return
    const today = new Date().toLocaleDateString('tr-TR')
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
    const val = (v: any) => (v === null || v === undefined || v === '') ? '-' : v
    const esc = (s: any) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const sectionsHtml = [
      { title: 'Parça Bilgileri', items: [
        ['Parça No', val(order.parca_no)], ['Parça Adı', val(order.parca_adi)],
        ['IEM No', val(useIemNo)], ['Revizyon No', val(order.revizyon_no)],
        ['FAI', val(order.fai)], ['Seri', val(order.seri)],
        ['Delta FAI', val(order.delta_fai)], ['Dosya No', val(order.dosya_no)],
      ]},
      { title: 'Proje & Müşteri', items: [
        ['Proje / Ürün', val(order.project_name)], ['Müşteri', val(order.customer_name)],
        ['Planlanan Miktar', val(order.planned_quantity)],
      ]},
      { title: 'Malzeme & Teknik', items: [
        ['Malzeme', val(order.malzeme)], ['Alaşım & Spec', val(order.alasim_spec)],
      ]},
      // Operasyon & Üretim bölümü çıktıdan kaldırıldı
      { title: 'Tarihler', items: [
        ['Başlama Tarihi', fmtDate(useBaslama)],
        ['Bitiş Tarihi', fmtDate(useBitis)],
        ['Teslim Tarihi', fmtDate(useTeslim)],
      ]},
      // Doğrulama bölümü çıktıdan kaldırıldı
    ].map(sec => `
      <div class="section">
        <h3>${sec.title}</h3>
        <table class="kv">
          <tbody>
            ${sec.items.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${esc(v)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `).join('')

    // Geçerli Doküman Listesi — her zaman görünür, en az 6 satır
    const validDocs = order.valid_documents || []
    const MIN_DOC_ROWS = 6
    const docRows = [
      ...validDocs.map(d => ({ name: esc(d.name) || '', doc_no: esc(d.doc_no) || '', revision: esc(d.revision) || '', date: d.date ? fmtDate(d.date) : '' })),
      ...Array.from({ length: Math.max(0, MIN_DOC_ROWS - validDocs.length) }, () => ({ name: '', doc_no: '', revision: '', date: '' })),
    ]
    const validDocsHtml = `
      <div class="section">
        <h3>📑 Geçerli Doküman Listesi</h3>
        <table class="docs">
          <thead>
            <tr>
              <th>Doküman Adı</th>
              <th>Doküman No</th>
              <th>Revizyon</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            ${docRows.map(d => `
              <tr>
                <td>${d.name || '&nbsp;'}</td>
                <td>${d.doc_no || '&nbsp;'}</td>
                <td>${d.revision || '&nbsp;'}</td>
                <td>${d.date || '&nbsp;'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    // Akış (sadece Rota + Plan Tarihleri — ekipman ve öncelik çıkarıldı)
    const akisHtml = `
      <div class="section">
        <h3>🔄 Üretim Akışı Bilgileri</h3>
        <table class="kv">
          <tbody>
            <tr><td class="k">Rota</td><td class="v">${esc(val(order.route_name))}</td></tr>
            <tr><td class="k">Plan Başlangıç</td><td class="v">${fmtDate(order.planned_start_date)}</td></tr>
            <tr><td class="k">Plan Bitiş</td><td class="v">${fmtDate(order.planned_end_date)}</td></tr>
          </tbody>
        </table>
      </div>
    `

    const stepsHtml = stepLogs.map((log, idx) => {
      const info = STEP_TYPES.find(t => t.value === log.step_type) || STEP_TYPES[2]
      const isCompleted = log.status === 'completed'
      const stepNote = (log as any).notes
      const isNote = log.step_type === 'note'

      // Note tipi adım: tam genişlikte sarı banner satır (operasyonel sütunlar yok)
      if (isNote) {
        return `
          <tr class="note-row">
            <td class="ord">📝</td>
            <td colspan="8" class="note-content">
              <span class="note-label">ADIMLAR ARASI NOT:</span>
              ${esc(stepNote || log.step_name)}
            </td>
          </tr>
        `
      }

      return `
        <tr>
          <td class="ord">${log.step_order}</td>
          <td class="nm">
            <div class="step-name">${esc(log.step_name)}</div>
            ${log.station_name ? `<div class="station">${esc(log.station_name)}</div>` : ''}
            <div class="type-tag">${info.label}</div>
            ${stepNote ? `<div class="step-note">📝 ${esc(stepNote)}</div>` : ''}
          </td>
          <td class="num">${log.in_quantity || '-'}</td>
          <td class="num green">${isCompleted ? log.accepted_quantity : ''}</td>
          <td class="num red">${isCompleted && log.scrap_quantity > 0 ? log.scrap_quantity : ''}</td>
          <td class="num orange">${isCompleted && log.rework_quantity > 0 ? log.rework_quantity : ''}</td>
          <td class="op">${esc(log.operator_name || '')}</td>
          <td class="op">${esc(log.machine_name || '')}</td>
          <td class="kase">
            <div class="kase-box">
              <div class="kase-label">Doğrulama</div>
            </div>
          </td>
        </tr>
      `
    }).join('')

    printWin.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>İş Emri - ${order.order_number}</title>
      <style>
        @page { size: A4; margin: 1cm; }
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica', Arial, sans-serif; color: #111; margin: 0; padding: 0; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { margin: 0; font-size: 20px; color: #1e40af; }
        .header .meta { font-size: 10px; color: #555; text-align: right; line-height: 1.5; }
        .order-num { font-size: 14px; font-weight: 700; color: #1e40af; }
        .status-pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; background: #dbeafe; color: #1e40af; margin-left: 6px; }
        .doc-meta { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
        .doc-no { font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 4px; }
        .dosya-no { font-size: 11px; font-weight: 700; color: #1e40af; background: #dbeafe; padding: 2px 8px; border-radius: 4px; }
        .section { margin-bottom: 12px; page-break-inside: avoid; }
        .section h3 { font-size: 11px; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }
        table.kv { width: 100%; border-collapse: collapse; }
        table.kv td { padding: 3px 6px; border-bottom: 1px dotted #e5e7eb; font-size: 10px; }
        table.kv td.k { font-weight: 600; color: #555; width: 22%; }
        table.kv td.v { color: #111; }
        table.docs { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
        table.docs thead { background: #f1f5f9; }
        table.docs th, table.docs td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
        .flow-title { margin-top: 14px; font-size: 13px; font-weight: 700; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; margin-bottom: 8px; }
        table.flow { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        table.flow thead { background: #1e40af; color: white; }
        table.flow th, table.flow td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: middle; }
        table.flow .num { text-align: center; font-weight: 600; }
        table.flow .green { color: #16a34a; }
        table.flow .red { color: #dc2626; }
        table.flow .orange { color: #ea580c; }
        table.flow .step-name { font-weight: 600; }
        table.flow .station { font-size: 8.5px; color: #555; display: inline-block; padding: 1px 5px; background: #f1f5f9; border-radius: 3px; margin-top: 2px; }
        table.flow .type-tag { font-size: 8px; color: #666; margin-top: 2px; }
        table.flow .step-note { font-size: 8.5px; color: #854d0e; background: #fef9c3; padding: 2px 4px; margin-top: 3px; border-left: 2px solid #fbbf24; border-radius: 2px; }
        table.flow .ord { text-align: center; font-weight: 700; width: 26px; background: #f1f5f9; }
        table.flow .kase { width: 130px; padding: 4px; }
        .kase-box { height: 60px; border: 1.5px dashed #94a3b8; border-radius: 4px; position: relative; background: #fafbfc; }
        .kase-box .kase-label { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); font-size: 7.5px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
        table.flow .note-row td { background: #fef9c3 !important; border-color: #fbbf24; }
        table.flow .note-content { font-size: 10px; color: #713f12; padding: 6px 8px; }
        table.flow .note-label { font-weight: 700; color: #854d0e; margin-right: 6px; letter-spacing: 0.5px; }
        .footer { margin-top: 18px; font-size: 9px; color: #666; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 6px; }
        .notes-block { background: #fef9c3; border: 1px solid #fde047; border-radius: 4px; padding: 6px 8px; margin-top: 10px; font-size: 10px; }
        .notes-block .lbl { font-weight: 700; color: #854d0e; font-size: 9px; }
      </style></head><body>

      <div class="header">
        <div>
          <h1>DÜNYASAN — İŞ EMRİ</h1>
          <div class="order-num">
            ${order.order_number}
            <span class="status-pill">${status.label}</span>
          </div>
          <div class="doc-meta">
            <span class="doc-no">Doküman No: DF03</span>
            ${order.dosya_no ? `<span class="dosya-no">Dosya No: ${esc(order.dosya_no)}</span>` : ''}
          </div>
        </div>
      </div>

      ${sectionsHtml}

      ${akisHtml}

      ${validDocsHtml}

      ${order.notes ? `<div class="notes-block"><div class="lbl">İŞ EMRİ NOTLARI</div>${esc(order.notes)}</div>` : ''}

      <div class="flow-title">ÜRETİM AKIŞI</div>
      <table class="flow">
        <thead>
          <tr>
            <th>#</th>
            <th>Adım / İstasyon / Not</th>
            <th>Giriş</th>
            <th>Kabul</th>
            <th>Hurda</th>
            <th>Yeniden</th>
            <th>Operatör</th>
            <th>Makine</th>
            <th>Doğrulama</th>
          </tr>
        </thead>
        <tbody>${stepsHtml}</tbody>
      </table>

      <div class="footer">
        <div>Hazırlayan: __________________</div>
        <div>Onaylayan: __________________</div>
        <div>Çıktı: ${today}</div>
      </div>

      <script>window.onload = function() { setTimeout(function(){ window.print(); }, 300); };</script>
      </body></html>
    `)
    printWin.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800">
          ← İş Emirleri Listesi
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPrintDialog(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 shadow">
            <Printer className="w-4 h-4" /> PDF Yazdır
          </button>
          <button onClick={onDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow">
            <Trash2 className="w-4 h-4" /> Sil
          </button>
        </div>
      </div>

      {/* PDF Tarih Sorgu Modal */}
      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrintDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Yazdırma Bilgileri</h3>
                <p className="text-xs text-gray-500 mt-0.5">İş emri bu IEM No ve tarihler için yazdırılacak</p>
              </div>
              <button onClick={() => setShowPrintDialog(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">IEM No</label>
                <input type="text" value={printIemNo} onChange={e => setPrintIemNo(e.target.value)}
                  placeholder="örn. IEM-2026-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Başlama Tarihi</label>
                <input type="date" value={printBaslama} onChange={e => setPrintBaslama(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bitiş Tarihi</label>
                <input type="date" value={printBitis} onChange={e => setPrintBitis(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Teslim Tarihi</label>
                <input type="date" value={printTeslim} onChange={e => setPrintTeslim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="text-[11px] text-gray-500 bg-gray-50 rounded p-2">
                💡 Bu değerler PDF çıktısında görünecek. Boş bırakırsan ilgili satır "-" olarak çıkar. Mevcut iş emri kaydı değişmez.
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPrintDialog(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold">İptal</button>
              <button onClick={() => {
                setShowPrintDialog(false)
                const vals = { baslama: printBaslama, bitis: printBitis, teslim: printTeslim, iem_no: printIemNo }
                handlePrint(vals)
                onLogPrint(vals)
              }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Yazdır
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-2xl font-bold text-gray-800">{order.order_number}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
            </div>
            <p className="text-gray-600">{order.parca_adi || order.project_name} • {order.route_name}</p>
            {order.customer_name && <p className="text-sm text-gray-500">Müşteri: {order.customer_name}</p>}
          </div>
          {order.status === 'planned' && (
            <button onClick={onStart} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg">
              <Play className="w-5 h-5" /> Üretime Başla
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Planlanan" value={order.planned_quantity} color="blue" />
          <MiniStat label="Depo Girişi" value={order.warehouse_in_quantity || 0} color="amber" />
          <MiniStat label="Toplam Hurda" value={order.total_scrap_quantity || 0} color="red" />
          <MiniStat label="Kabul Edilen" value={order.final_accepted_quantity || 0} color="green" />
        </div>
      </div>

      {/* İş Emri Detayları — work-orders form düzeninde */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
        <h3 className="text-lg font-bold text-gray-800 mb-2">İş Emri Detayları</h3>

        {/* Parça Bilgileri */}
        <DetailSection title="📋 Parça Bilgileri" items={[
          ['Parça No', order.parca_no],
          ['Parça Adı', order.parca_adi],
          ['IEM No', order.iem_no],
          ['Revizyon No', order.revizyon_no],
          ['FAI', order.fai],
          ['Seri', order.seri],
          ['Delta FAI', order.delta_fai],
          ['Dosya No', order.dosya_no],
        ]} />

        {/* Proje & Müşteri */}
        <DetailSection title="🏭 Proje & Müşteri" items={[
          ['Proje / Ürün', order.project_name],
          ['Müşteri', order.customer_name],
          ['Planlanan Miktar', order.planned_quantity?.toString()],
        ]} />

        {/* Malzeme & Teknik (ekipman akış bölümüne taşındı) */}
        <DetailSection title="🧱 Malzeme & Teknik" items={[
          ['Malzeme', order.malzeme],
          ['Alaşım & Spec', order.alasim_spec],
        ]} />

        {/* Operasyon & Üretim */}
        <DetailSection title="⚙️ Operasyon & Üretim" items={[
          ['Operasyon No', order.operasyon_no],
          ['İş Merkezi', order.is_merkezi],
          ['Uygun Miktar', order.uygun_miktar?.toString()],
          ['Ret Miktar', order.ret_miktar?.toString()],
          ['Uygunsuzluk No', order.uygunsuzluk_no],
        ]} />

        {/* Tarihler */}
        <DetailSection title="📅 Tarihler" items={[
          ['Teslim Tarihi', order.teslim_tarihi ? new Date(order.teslim_tarihi).toLocaleDateString('tr-TR') : null],
          ['Başlama Tarihi', order.baslama_tarihi ? new Date(order.baslama_tarihi).toLocaleDateString('tr-TR') : null],
          ['Bitiş Tarihi', order.bitis_tarihi ? new Date(order.bitis_tarihi).toLocaleDateString('tr-TR') : null],
        ]} />

        {order.notes && (
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Notlar</p>
            <p className="text-sm text-gray-800">{order.notes}</p>
          </div>
        )}

        {/* Geçerli Doküman Listesi */}
        {order.valid_documents && order.valid_documents.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">📑 Geçerli Doküman Listesi</h4>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Doküman Adı</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Doküman No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Revizyon</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.valid_documents.map((doc, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{doc.name || '-'}</td>
                    <td className="px-3 py-2">{doc.doc_no || '-'}</td>
                    <td className="px-3 py-2">{doc.revision || '-'}</td>
                    <td className="px-3 py-2">{doc.date ? new Date(doc.date).toLocaleDateString('tr-TR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Akış Bilgileri (ekipman + öncelik kaldırıldı) */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
          <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2 border-b border-blue-200 pb-1">
            <RefreshCw className="w-4 h-4" /> Üretim Akışı
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <DetailCell label="Rota" value={order.route_name} />
            <DetailCell label="Plan Başlangıç" value={order.planned_start_date ? new Date(order.planned_start_date).toLocaleDateString('tr-TR') : null} />
            <DetailCell label="Plan Bitiş" value={order.planned_end_date ? new Date(order.planned_end_date).toLocaleDateString('tr-TR') : null} />
          </div>
        </div>
      </div>

      {/* Flow Steps */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-500" /> Üretim Akışı
        </h3>
        {stepLogs.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Adım bulunamadı.</p>
        ) : (
          <div className="space-y-2">
            {stepLogs.map((log, idx) => {
              const info = getStepTypeInfo(log.step_type)
              const Icon = info.icon
              const isCompleted = log.status === 'completed'
              const isCurrent = log.status === 'in_progress'
              const isPending = log.status === 'pending'
              const isExpanded = activeStepLogId === log.id
              const isNote = log.step_type === 'note'

              if (isNote) {
                return (
                  <div key={log.id} className="bg-yellow-50 border-2 border-yellow-300 border-dashed rounded-lg p-3 flex items-start gap-3">
                    <Edit3 className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-1">📝 Adım Notu</div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{(log as any).notes || log.step_name}</div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={log.id}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isCompleted ? 'border-green-200 bg-green-50' :
                      isCurrent ? 'border-blue-400 bg-blue-50 shadow-md' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        isCompleted ? 'bg-green-500 text-white' :
                        isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                        'bg-gray-300 text-gray-700'
                      }`}>{log.step_order}</div>
                    </div>
                    <div className={`p-2 rounded ${info.color}`}><Icon className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">
                        {log.step_name}
                        {log.station_name && <span className="ml-2 text-xs px-2 py-0.5 bg-white border border-gray-300 rounded">{log.station_name}</span>}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>Giriş: <b>{log.in_quantity}</b></span>
                        {isCompleted && <>
                          <span className="text-green-600">Kabul: <b>{log.accepted_quantity}</b></span>
                          {log.scrap_quantity > 0 && <span className="text-red-600">Hurda: <b>{log.scrap_quantity}</b></span>}
                          {log.rework_quantity > 0 && <span className="text-orange-600">Yeniden: <b>{log.rework_quantity}</b></span>}
                          {log.operator_name && <span className="text-gray-500">• {log.operator_name}</span>}
                        </>}
                      </div>
                      {(log as any).notes && (
                        <div className="text-[11px] text-yellow-800 bg-yellow-50 border-l-2 border-yellow-400 px-2 py-1 rounded mt-1">
                          📝 {(log as any).notes}
                        </div>
                      )}
                    </div>

                    {/* Doğrulama Alanı */}
                    <div className="hidden md:flex flex-col items-center justify-center min-w-[120px] h-[70px] border-2 border-dashed border-gray-400 rounded-md bg-white px-2 relative">
                      {isCompleted && log.operator_name ? (
                        <div className="text-[10px] text-gray-700 text-center leading-tight">
                          <div className="font-semibold">{log.operator_name}</div>
                          {log.completed_at && <div className="text-gray-500 mt-0.5">{new Date(log.completed_at).toLocaleDateString('tr-TR')}</div>}
                        </div>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-gray-300" />
                      )}
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-1.5 text-[8px] text-gray-400 uppercase tracking-wider">Doğrulama</span>
                    </div>

                    {isCurrent && (
                      <button
                        onClick={() => setActiveStepLogId(isExpanded ? null : log.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                      >
                        {isExpanded ? 'Kapat' : 'Tamamla →'}
                      </button>
                    )}
                    {isCompleted && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  </div>
                  {isExpanded && isCurrent && (
                    <StepCompleteForm
                      log={log}
                      employees={employees}
                      machines={machines}
                      onSubmit={(payload) => onCompleteStep(log, payload)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailSection({ title, items }: { title: string; items: [string, any][] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(([label, value], i) => (
          <DetailCell key={i} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}

function DetailCell({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900 text-sm break-words">{value || '-'}</p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
  }
  return (
    <div className={`rounded-lg p-3 text-center ${colorMap[color]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function StepCompleteForm({
  log, employees, machines, onSubmit,
}: {
  log: StepLog; employees: any[]; machines: any[];
  onSubmit: (payload: any) => void;
}) {
  const [accepted, setAccepted] = useState(log.in_quantity.toString())
  const [scrap, setScrap] = useState('0')
  const [rework, setRework] = useState('0')
  const [operatorId, setOperatorId] = useState('')
  const [machineId, setMachineId] = useState('')
  const [qcResult, setQcResult] = useState<'pass' | 'fail' | 'partial' | ''>('')
  const [scrapReason, setScrapReason] = useState('')
  const [scrapDest, setScrapDest] = useState<'warehouse_reject' | 'non_compliant' | ''>('')
  const [notes, setNotes] = useState('')

  const remaining = log.in_quantity - parseFloat(accepted || '0') - parseFloat(scrap || '0') - parseFloat(rework || '0')

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mt-2 ml-12 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Kabul Edilen (Sonraki adıma)</label>
          <input type="number" value={accepted} onChange={e => setAccepted(e.target.value)} className="w-full px-3 py-2 border border-green-300 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Hurda</label>
          <input type="number" value={scrap} onChange={e => setScrap(e.target.value)} className="w-full px-3 py-2 border border-red-300 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Yeniden İşlem</label>
          <input type="number" value={rework} onChange={e => setRework(e.target.value)} className="w-full px-3 py-2 border border-orange-300 rounded bg-white" />
        </div>
      </div>
      <div className={`text-xs font-semibold ${remaining === 0 ? 'text-green-600' : remaining < 0 ? 'text-red-600' : 'text-orange-600'}`}>
        Giriş: {log.in_quantity} | Toplam dağıtılan: {(parseFloat(accepted || '0') + parseFloat(scrap || '0') + parseFloat(rework || '0')).toFixed(2)} | Kalan: {remaining.toFixed(2)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Operatör</label>
          <select value={operatorId} onChange={e => setOperatorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm">
            <option value="">Seçin...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Makine</label>
          <select value={machineId} onChange={e => setMachineId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm">
            <option value="">Seçin...</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} - {m.machine_name}</option>)}
          </select>
        </div>
      </div>

      {log.step_type.startsWith('qc_') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">QC Sonucu</label>
            <select value={qcResult} onChange={e => setQcResult(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm">
              <option value="">Seçin...</option>
              <option value="pass">Onay (Tümü Kabul)</option>
              <option value="partial">Kısmi (Bir Kısmı Ret)</option>
              <option value="fail">Ret (Tümü Reddedildi)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Hurda Lokasyonu</label>
            <select value={scrapDest} onChange={e => setScrapDest(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm">
              <option value="">—</option>
              <option value="warehouse_reject">Depo Ret Alanı</option>
              <option value="non_compliant">Uygun Olmayan Ürün</option>
            </select>
          </div>
        </div>
      )}

      {parseFloat(scrap || '0') > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Hurda Nedeni</label>
          <input value={scrapReason} onChange={e => setScrapReason(e.target.value)} placeholder="Örn: Boyut hatası, çatlak, vb." className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm" />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Notlar</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm" />
      </div>

      <button
        onClick={() => onSubmit({
          accepted_quantity: parseFloat(accepted || '0'),
          scrap_quantity: parseFloat(scrap || '0'),
          rework_quantity: parseFloat(rework || '0'),
          operator_id: operatorId || undefined,
          machine_id: machineId || undefined,
          qc_result: qcResult || undefined,
          scrap_reason: scrapReason || undefined,
          scrap_destination: scrapDest || undefined,
          notes: notes || undefined,
        })}
        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-5 h-5" /> Adımı Tamamla ve Sonrakine Geç
      </button>
    </div>
  )
}

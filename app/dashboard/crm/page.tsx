'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users, Phone, Mail, Globe, Calendar, MapPin, Plus, X, Edit3,
  Trash2, CheckCircle2, Clock, AlertCircle, Search, Filter,
  Briefcase, ChevronLeft, MessageSquare, ArrowRight, ListChecks,
  Sun, PhoneCall, Video, Send, RefreshCw, DollarSign,
} from 'lucide-react'

// ===========================================
// TYPES
// ===========================================
type CustomerStatus = 'prospect' | 'active' | 'vip' | 'lost' | 'inactive'
type Priority = 'low' | 'normal' | 'high'

interface Customer {
  id: string
  company_id: string
  customer_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  tax_number: string | null
  tax_office: string | null
  sector: string | null
  customer_type: CustomerStatus
  notes: string | null
  source: string | null
  assigned_to: string | null
  estimated_value: number
  is_active: boolean
  created_at: string
}

interface Task {
  id: string
  company_id: string
  customer_id: string | null
  title: string
  description: string | null
  due_date: string | null
  due_time: string | null
  priority: Priority
  completed: boolean
  completed_at: string | null
  assigned_to: string | null
  created_by_name: string | null
  created_at: string
}

// ===========================================
// CONSTANTS
// ===========================================
const STATUS_MAP: Record<CustomerStatus, { label: string; bg: string; text: string }> = {
  prospect: { label: 'Potansiyel', bg: 'bg-blue-100', text: 'text-blue-700' },
  active: { label: 'Aktif', bg: 'bg-green-100', text: 'text-green-700' },
  vip: { label: 'VIP', bg: 'bg-purple-100', text: 'text-purple-700' },
  lost: { label: 'Kaybedildi', bg: 'bg-red-100', text: 'text-red-700' },
  inactive: { label: 'Pasif', bg: 'bg-gray-100', text: 'text-gray-700' },
}

const PRIORITY_MAP: Record<Priority, { label: string; bg: string; text: string }> = {
  low: { label: 'Düşük', bg: 'bg-gray-100', text: 'text-gray-600' },
  normal: { label: 'Normal', bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { label: 'Yüksek', bg: 'bg-red-100', text: 'text-red-700' },
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
const fmtMoney = (n: number) => `₺${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n)}`

// ===========================================
// PAGE
// ===========================================
export default function CRMPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'today' | 'customers' | 'tasks'>('today')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  // Detail
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Filters
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | CustomerStatus>('all')
  const [taskFilter, setTaskFilter] = useState<'today' | 'upcoming' | 'overdue' | 'completed' | 'all'>('upcoming')

  // Forms
  const emptyCustomer = {
    customer_name: '', contact_person: '', phone: '', email: '', website: '',
    address: '', tax_number: '', tax_office: '', sector: '',
    customer_type: 'prospect' as CustomerStatus, notes: '', assigned_to: '',
    estimated_value: '',
  }
  const [customerForm, setCustomerForm] = useState(emptyCustomer)

  const emptyTask = {
    customer_id: '', title: '', description: '', due_date: '', due_time: '',
    priority: 'normal' as Priority, assigned_to: '',
  }
  const [taskForm, setTaskForm] = useState(emptyTask)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('company_id, full_name').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      setUserName(profile.full_name || null)
      await loadAll(profile.company_id)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadAll = async (cid: string) => {
    const [custRes, tasksRes, empRes] = await Promise.all([
      supabase.from('crm_customers').select('*').eq('company_id', cid).eq('is_active', true).order('customer_name'),
      supabase.from('crm_tasks').select('*').eq('company_id', cid).order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', cid).eq('status', 'active').order('full_name'),
    ])
    setCustomers(custRes.data || [])
    setTasks(tasksRes.data || [])
    setEmployees(empRes.data || [])
  }

  // ============= CUSTOMER CRUD =============
  const openNewCustomer = () => { setEditingCustomer(null); setCustomerForm(emptyCustomer); setShowCustomerModal(true) }
  const openEditCustomer = (c: Customer) => {
    setEditingCustomer(c)
    setCustomerForm({
      customer_name: c.customer_name, contact_person: c.contact_person || '',
      phone: c.phone || '', email: c.email || '', website: c.website || '',
      address: c.address || '', tax_number: c.tax_number || '', tax_office: c.tax_office || '',
      sector: c.sector || '', customer_type: c.customer_type, notes: c.notes || '',
      assigned_to: c.assigned_to || '',
      estimated_value: c.estimated_value?.toString() || '',
    })
    setShowCustomerModal(true)
  }
  const saveCustomer = async () => {
    if (!customerForm.customer_name || !companyId) return alert('Müşteri adı zorunlu!')
    try {
      const payload: any = {
        customer_name: customerForm.customer_name,
        contact_person: customerForm.contact_person || null,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        website: customerForm.website || null,
        address: customerForm.address || null,
        tax_number: customerForm.tax_number || null,
        tax_office: customerForm.tax_office || null,
        sector: customerForm.sector || null,
        customer_type: customerForm.customer_type,
        notes: customerForm.notes || null,
        assigned_to: customerForm.assigned_to || null,
        estimated_value: customerForm.estimated_value ? parseFloat(customerForm.estimated_value) : 0,
        updated_at: new Date().toISOString(),
      }
      if (editingCustomer) {
        await supabase.from('crm_customers').update(payload).eq('id', editingCustomer.id)
      } else {
        await supabase.from('crm_customers').insert({ ...payload, company_id: companyId, is_active: true, created_by: userId })
      }
      setShowCustomerModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const deleteCustomer = async (c: Customer) => {
    if (!confirm(`"${c.customer_name}" müşterisini silmek istediğine emin misin?`)) return
    await supabase.from('crm_customers').update({ is_active: false }).eq('id', c.id)
    if (selectedCustomer?.id === c.id) setSelectedCustomer(null)
    await loadAll(companyId!)
  }

  // ============= TASK CRUD =============
  const openNewTask = (customerId?: string) => {
    setEditingTask(null)
    setTaskForm({ ...emptyTask, customer_id: customerId || '', due_date: new Date().toISOString().split('T')[0] })
    setShowTaskModal(true)
  }
  const openEditTask = (t: Task) => {
    setEditingTask(t)
    setTaskForm({
      customer_id: t.customer_id || '', title: t.title, description: t.description || '',
      due_date: t.due_date || '', due_time: t.due_time || '',
      priority: t.priority, assigned_to: t.assigned_to || '',
    })
    setShowTaskModal(true)
  }
  const saveTask = async () => {
    if (!taskForm.title || !companyId) return alert('Konu zorunlu!')
    try {
      const payload: any = {
        title: taskForm.title,
        description: taskForm.description || null,
        customer_id: taskForm.customer_id || null,
        due_date: taskForm.due_date || null,
        due_time: taskForm.due_time || null,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to || null,
        updated_at: new Date().toISOString(),
      }
      if (editingTask) {
        await supabase.from('crm_tasks').update(payload).eq('id', editingTask.id)
      } else {
        await supabase.from('crm_tasks').insert({
          ...payload, company_id: companyId,
          created_by: userId, created_by_name: userName,
        })
      }
      setShowTaskModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const toggleTaskComplete = async (t: Task) => {
    await supabase.from('crm_tasks').update({
      completed: !t.completed,
      completed_at: !t.completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id)
    await loadAll(companyId!)
  }
  const deleteTask = async (t: Task) => {
    if (!confirm('Görevi silmek istediğine emin misin?')) return
    await supabase.from('crm_tasks').delete().eq('id', t.id)
    await loadAll(companyId!)
  }

  // ============= FILTERS =============
  const filteredCustomers = customers.filter(c => {
    if (customerStatusFilter !== 'all' && c.customer_type !== customerStatusFilter) return false
    if (customerSearch) {
      const t = customerSearch.toLowerCase()
      return [c.customer_name, c.contact_person, c.phone, c.email, c.sector, c.tax_number].some(v => v?.toLowerCase().includes(t))
    }
    return true
  })

  const customerTasks = (custId: string) => tasks.filter(t => t.customer_id === custId)

  // Bir müşteriye ait sıradaki (en yakın) açık görev
  const nextTaskFor = (custId: string): Task | null => {
    const list = tasks
      .filter(t => t.customer_id === custId && !t.completed && t.due_date)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    return list[0] || null
  }

  const filteredTasks = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000)
    return tasks.filter(t => {
      const due = t.due_date ? new Date(t.due_date) : null
      switch (taskFilter) {
        case 'today': return due && due >= today && due < tomorrow && !t.completed
        case 'upcoming': return due && due >= today && !t.completed
        case 'overdue': return due && due < today && !t.completed
        case 'completed': return t.completed
        case 'all':
        default: return true
      }
    })
  }, [tasks, taskFilter])

  // Stats
  const todayTasksCount = tasks.filter(t => {
    if (t.completed || !t.due_date) return false
    const d = new Date(t.due_date)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    return d >= today && d < tomorrow
  }).length

  const overdueCount = tasks.filter(t => {
    if (t.completed || !t.due_date) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return new Date(t.due_date) < today
  }).length

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  return (
    <PermissionGuard module="crm" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-600" /> CRM
            </h2>
            <p className="text-gray-600">Müşterilerini ve takip görevlerini tek yerden yönet</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={openNewCustomer} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Müşteri
            </button>
            <button onClick={() => openNewTask(selectedCustomer?.id)} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow font-semibold">
              <Plus className="w-4 h-4" /> Yeni Görev
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Toplam Müşteri" value={customers.length} icon={Users} color="blue" />
          <StatBox label="Aktif Müşteri" value={customers.filter(c => c.customer_type === 'active').length} icon={CheckCircle2} color="green" />
          <StatBox label="Bugünün Görevleri" value={todayTasksCount} icon={Clock} color="orange" />
          <StatBox label="Gecikmiş Görevler" value={overdueCount} icon={AlertCircle} color="red" />
        </div>

        {/* Tabs */}
        {!selectedCustomer && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex gap-1">
            <TabBtn active={activeTab === 'today'} onClick={() => setActiveTab('today')} icon={Sun}>
              Bugün
            </TabBtn>
            <TabBtn active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={Users}>
              Müşteriler ({customers.length})
            </TabBtn>
            <TabBtn active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={ListChecks}>
              Görevler ({tasks.filter(t => !t.completed).length})
            </TabBtn>
          </div>
        )}

        {/* ============== BUGÜN DASHBOARD ============== */}
        {!selectedCustomer && activeTab === 'today' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bugünün görevleri */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" /> Bugünün Görevleri ({todayTasksCount})
                </h4>
                <button onClick={() => openNewTask()} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Yeni
                </button>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {tasks.filter(t => {
                  if (t.completed || !t.due_date) return false
                  const d = new Date(t.due_date)
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
                  return d >= today && d < tomorrow
                }).map(t => (
                  <TaskRow key={t.id} task={t} customer={customers.find(c => c.id === t.customer_id)}
                    onToggle={() => toggleTaskComplete(t)} onEdit={() => openEditTask(t)} onDelete={() => deleteTask(t)}
                    onCustomerClick={(c: Customer) => setSelectedCustomer(c)} />
                ))}
                {todayTasksCount === 0 && <p className="text-sm text-gray-400 text-center py-6">Bugün için görev yok 🎉</p>}
              </div>
            </div>

            {/* Gecikmiş */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" /> Gecikmiş ({overdueCount})
                </h4>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {tasks.filter(t => {
                  if (t.completed || !t.due_date) return false
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  return new Date(t.due_date) < today
                }).map(t => (
                  <TaskRow key={t.id} task={t} customer={customers.find(c => c.id === t.customer_id)}
                    onToggle={() => toggleTaskComplete(t)} onEdit={() => openEditTask(t)} onDelete={() => deleteTask(t)}
                    onCustomerClick={(c: Customer) => setSelectedCustomer(c)} />
                ))}
                {overdueCount === 0 && <p className="text-sm text-gray-400 text-center py-6">Gecikmiş görev yok 🎉</p>}
              </div>
            </div>

            {/* Yakın takip — müşteri bazlı sonraki görevler */}
            <div className="bg-white rounded-xl shadow-md p-5 lg:col-span-2">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" /> Müşteri Takip — Sıradaki Görevler
              </h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {customers.map(c => {
                  const next = nextTaskFor(c.id)
                  if (!next) return null
                  const status = STATUS_MAP[c.customer_type]
                  return (
                    <button key={c.id} onClick={() => setSelectedCustomer(c)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>{status.label}</div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{c.customer_name}</div>
                          <div className="text-xs text-gray-500 truncate">→ {next.title}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-600 font-semibold">📅 {fmtDate(next.due_date)}</div>
                        {c.estimated_value > 0 && <div className="text-[10px] text-green-600">{fmtMoney(c.estimated_value)}</div>}
                      </div>
                    </button>
                  )
                }).filter(Boolean)}
                {customers.every(c => !nextTaskFor(c.id)) && (
                  <p className="text-sm text-gray-400 text-center py-6">Hiçbir müşteri için açık görev yok</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============== MÜŞTERİ DETAY (selected) ============== */}
        {selectedCustomer && (
          <CustomerDetail
            customer={selectedCustomer}
            tasks={customerTasks(selectedCustomer.id)}
            employees={employees}
            onBack={() => setSelectedCustomer(null)}
            onEdit={() => openEditCustomer(selectedCustomer)}
            onDelete={() => deleteCustomer(selectedCustomer)}
            onAddTask={() => openNewTask(selectedCustomer.id)}
            onToggleTask={toggleTaskComplete}
            onEditTask={openEditTask}
            onDeleteTask={deleteTask}
          />
        )}

        {/* ============== MÜŞTERİLER LİSTESİ ============== */}
        {!selectedCustomer && activeTab === 'customers' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Müşteri, telefon, e-posta, VKN..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <select value={customerStatusFilter} onChange={e => setCustomerStatusFilter(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="all">Tüm Durumlar</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">{customerSearch || customerStatusFilter !== 'all' ? 'Müşteri bulunamadı' : 'Henüz müşteri eklemedin'}</p>
                {!customerSearch && customerStatusFilter === 'all' && (
                  <button onClick={openNewCustomer} className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
                    <Plus className="w-4 h-4" /> İlk Müşterini Ekle
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İletişim</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Değer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Sıradaki Görev</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCustomers.map(c => {
                      const status = STATUS_MAP[c.customer_type]
                      const openTasks = customerTasks(c.id).filter(t => !t.completed).length
                      const next = nextTaskFor(c.id)
                      return (
                        <tr key={c.id} onClick={() => setSelectedCustomer(c)} className="hover:bg-gray-50 cursor-pointer">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800">{c.customer_name}</div>
                            {c.contact_person && <div className="text-xs text-gray-600">👤 {c.contact_person}</div>}
                            {c.sector && <div className="text-[11px] text-gray-500">{c.sector}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {c.phone && <div className="flex items-center gap-1 text-gray-700"><Phone className="w-3 h-3" /> {c.phone}</div>}
                            {c.email && <div className="flex items-center gap-1 text-gray-700"><Mail className="w-3 h-3" /> {c.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">
                            {c.estimated_value > 0 ? fmtMoney(c.estimated_value) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {next ? (
                              <div>
                                <div className="text-gray-800 truncate max-w-[220px]">{next.title}</div>
                                <div className="text-[11px] text-gray-500">📅 {fmtDate(next.due_date)}</div>
                              </div>
                            ) : openTasks > 0 ? (
                              <span className="text-xs text-orange-600">{openTasks} açık</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openNewTask(c.id)} className="p-1.5 rounded hover:bg-orange-50 text-orange-600" title="Görev ekle">
                                <Plus className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditCustomer(c)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => deleteCustomer(c)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ============== GÖREVLER LİSTESİ ============== */}
        {!selectedCustomer && activeTab === 'tasks' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-2 flex-wrap items-center">
              {[
                { id: 'today', label: 'Bugün', icon: Clock },
                { id: 'upcoming', label: 'Yaklaşan', icon: Calendar },
                { id: 'overdue', label: 'Gecikmiş', icon: AlertCircle },
                { id: 'completed', label: 'Tamamlanan', icon: CheckCircle2 },
                { id: 'all', label: 'Tümü', icon: ListChecks },
              ].map(f => {
                const Icon = f.icon
                return (
                  <button key={f.id} onClick={() => setTaskFilter(f.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      taskFilter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    <Icon className="w-4 h-4" /> {f.label}
                  </button>
                )
              })}
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {taskFilter === 'today' && 'Bugün için görev yok 🎉'}
                    {taskFilter === 'upcoming' && 'Yaklaşan görev yok'}
                    {taskFilter === 'overdue' && 'Gecikmiş görev yok 🎉'}
                    {taskFilter === 'completed' && 'Henüz tamamlanan görev yok'}
                    {taskFilter === 'all' && 'Henüz görev eklemedin'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map(t => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      customer={customers.find(c => c.id === t.customer_id)}
                      onToggle={() => toggleTaskComplete(t)}
                      onEdit={() => openEditTask(t)}
                      onDelete={() => deleteTask(t)}
                      onCustomerClick={(c: Customer) => setSelectedCustomer(c)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ============== MÜŞTERİ MODAL ============== */}
        {showCustomerModal && (
          <Modal title={editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'} onClose={() => setShowCustomerModal(false)} large>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Müşteri Adı / Firma *">
                  <input value={customerForm.customer_name} onChange={e => setCustomerForm({ ...customerForm, customer_name: e.target.value })} placeholder="Örn: ABC Mühendislik" className={inputCls} />
                </Field>
                <Field label="Yetkili Kişi">
                  <input value={customerForm.contact_person} onChange={e => setCustomerForm({ ...customerForm, contact_person: e.target.value })} placeholder="Ahmet Yılmaz - Satınalma" className={inputCls} />
                </Field>
                <Field label="Telefon">
                  <input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="0532..." className={inputCls} />
                </Field>
                <Field label="E-posta">
                  <input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Web Sitesi">
                  <input value={customerForm.website} onChange={e => setCustomerForm({ ...customerForm, website: e.target.value })} placeholder="https://..." className={inputCls} />
                </Field>
                <Field label="Durum">
                  <select value={customerForm.customer_type} onChange={e => setCustomerForm({ ...customerForm, customer_type: e.target.value as CustomerStatus })} className={inputCls}>
                    {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="Vergi No (VKN)">
                  <input value={customerForm.tax_number} onChange={e => setCustomerForm({ ...customerForm, tax_number: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Vergi Dairesi">
                  <input value={customerForm.tax_office} onChange={e => setCustomerForm({ ...customerForm, tax_office: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Sektör / Kategori">
                  <input value={customerForm.sector} onChange={e => setCustomerForm({ ...customerForm, sector: e.target.value })} placeholder="Örn: Otomotiv" className={inputCls} />
                </Field>
                <Field label="Atanan Kişi">
                  <select value={customerForm.assigned_to} onChange={e => setCustomerForm({ ...customerForm, assigned_to: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Tahmini Değer (₺)">
                  <input type="number" value={customerForm.estimated_value} onChange={e => setCustomerForm({ ...customerForm, estimated_value: e.target.value })} placeholder="0" className={inputCls} />
                </Field>
              </div>
              <Field label="Adres">
                <input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Notlar">
                <textarea value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={3} className={inputCls} />
              </Field>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCustomerModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveCustomer} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">{editingCustomer ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ============== GÖREV MODAL ============== */}
        {showTaskModal && (
          <Modal title={editingTask ? 'Görevi Düzenle' : 'Yeni Görev'} onClose={() => setShowTaskModal(false)}>
            <div className="space-y-4">
              {/* Hızlı şablonlar */}
              {!editingTask && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Hızlı şablon:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: PhoneCall, label: 'Ara', title: 'Müşteriyi ara' },
                      { icon: Video, label: 'Toplantı', title: 'Toplantı yap' },
                      { icon: Send, label: 'Teklif', title: 'Teklif gönder' },
                      { icon: RefreshCw, label: 'Takip', title: 'Takip et' },
                    ].map(t => {
                      const Icon = t.icon
                      return (
                        <button key={t.label} type="button" onClick={() => setTaskForm({ ...taskForm, title: t.title })}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-700">
                          <Icon className="w-4 h-4" />
                          <span className="text-[11px] font-semibold">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <Field label="Konu *">
                <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Örn: ABC'yi ara - teklif takibi" className={inputCls} />
              </Field>
              <Field label="Müşteri">
                <select value={taskForm.customer_id} onChange={e => setTaskForm({ ...taskForm, customer_id: e.target.value })} className={inputCls}>
                  <option value="">— Müşteri yok —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tarih">
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Saat">
                  <input type="time" value={taskForm.due_time} onChange={e => setTaskForm({ ...taskForm, due_time: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Öncelik">
                  <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as Priority })} className={inputCls}>
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="Atanan Kişi">
                  <select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Açıklama">
                <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} className={inputCls} placeholder="Görüşme notları, hatırlatmalar..." />
              </Field>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowTaskModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveTask} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold">{editingTask ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </PermissionGuard>
  )
}

// ===========================================
// SUBCOMPONENTS
// ===========================================
function TabBtn({ active, onClick, icon: Icon, children }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
        active ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
      }`}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose, large }: { title: string; children: React.ReactNode; onClose: () => void; large?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${large ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    green: 'border-green-500 text-green-600',
    orange: 'border-orange-500 text-orange-600',
    red: 'border-red-500 text-red-600',
  }
  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-600 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <Icon className={`w-7 h-7 ${colors[color]}`} />
      </div>
    </div>
  )
}

function TaskRow({ task, customer, onToggle, onEdit, onDelete, onCustomerClick }: any) {
  const priority = PRIORITY_MAP[task.priority as Priority]
  const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) && !task.completed
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      task.completed ? 'bg-gray-50 border-gray-200 opacity-70'
        : isOverdue ? 'bg-red-50 border-red-200'
        : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      <button onClick={onToggle} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
      }`}>
        {task.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1 flex-wrap">
          {task.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
              <Calendar className="w-3 h-3" /> {fmtDate(task.due_date)} {task.due_time && task.due_time.slice(0, 5)}
            </span>
          )}
          {customer && (
            <button onClick={() => onCustomerClick(customer)} className="text-blue-600 hover:underline">
              👤 {customer.customer_name}
            </button>
          )}
          {task.description && <span className="text-gray-400 truncate max-w-[300px]">— {task.description}</span>}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${priority.bg} ${priority.text}`}>{priority.label}</span>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function CustomerDetail({ customer, tasks, employees, onBack, onEdit, onDelete, onAddTask, onToggleTask, onEditTask, onDeleteTask }: any) {
  const status = STATUS_MAP[customer.customer_type as CustomerStatus]
  const openTasks = tasks.filter((t: Task) => !t.completed)
  const completedTasks = tasks.filter((t: Task) => t.completed)
  const assignedEmp = customer.assigned_to ? employees.find((e: any) => e.id === customer.assigned_to) : null
  const nextTask = openTasks
    .filter((t: Task) => t.due_date)
    .sort((a: Task, b: Task) => (a.due_date || '').localeCompare(b.due_date || ''))[0] as Task | undefined

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800">
        <ChevronLeft className="w-4 h-4" /> Müşteri Listesi
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-2xl font-bold text-gray-800">{customer.customer_name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
            </div>
            {customer.contact_person && <p className="text-gray-700 mb-1">👤 {customer.contact_person}</p>}
            {customer.sector && <p className="text-sm text-gray-500">{customer.sector}</p>}
            {nextTask && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 bg-blue-50 border border-blue-200 rounded">
                <Calendar className="w-3 h-3 text-blue-600" />
                <span className="text-blue-700"><b>Sıradaki:</b> {nextTask.title} — {fmtDate(nextTask.due_date)}</span>
              </div>
            )}
            {customer.estimated_value > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 bg-green-50 border border-green-200 rounded ml-2">
                <DollarSign className="w-3 h-3 text-green-600" />
                <span className="text-green-700"><b>Tahmini:</b> {fmtMoney(customer.estimated_value)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onAddTask} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Görev Ekle
            </button>
            <button onClick={onEdit} className="p-2 rounded hover:bg-blue-50 text-blue-600 border border-gray-300"><Edit3 className="w-4 h-4" /></button>
            <button onClick={onDelete} className="p-2 rounded hover:bg-red-50 text-red-600 border border-gray-300"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {customer.phone && <InfoItem icon={Phone} label="Telefon" value={customer.phone} />}
          {customer.email && <InfoItem icon={Mail} label="E-posta" value={customer.email} />}
          {customer.website && <InfoItem icon={Globe} label="Web" value={customer.website} />}
          {customer.address && <InfoItem icon={MapPin} label="Adres" value={customer.address} />}
          {customer.tax_number && <InfoItem icon={Briefcase} label="VKN" value={`${customer.tax_number}${customer.tax_office ? ' - ' + customer.tax_office : ''}`} />}
          {assignedEmp && <InfoItem icon={Users} label="Atanan Kişi" value={assignedEmp.full_name} />}
        </div>

        {customer.notes && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
            <p className="text-xs font-semibold text-yellow-800 mb-1">📝 NOTLAR</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-orange-500" /> Görevler ({tasks.length})
        </h4>

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">Bu müşteriye henüz görev eklenmedi</p>
            <button onClick={onAddTask} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              <Plus className="w-4 h-4" /> İlk Görevi Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {openTasks.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase mt-2">Açık ({openTasks.length})</p>
                {openTasks.map((t: Task) => (
                  <TaskRow key={t.id} task={t} customer={null} onToggle={() => onToggleTask(t)} onEdit={() => onEditTask(t)} onDelete={() => onDeleteTask(t)} onCustomerClick={() => {}} />
                ))}
              </>
            )}
            {completedTasks.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase mt-4">Tamamlanan ({completedTasks.length})</p>
                {completedTasks.map((t: Task) => (
                  <TaskRow key={t.id} task={t} customer={null} onToggle={() => onToggleTask(t)} onEdit={() => onEditTask(t)} onDelete={() => onDeleteTask(t)} onCustomerClick={() => {}} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-500 uppercase">{label}</p>
        <p className="text-sm text-gray-800 truncate">{value}</p>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Briefcase, Users, Phone, Mail, Calendar, Target, TrendingUp, Award,
  Plus, X, Edit3, Trash2, CheckCircle2, Clock, ArrowRight, ChevronRight,
  PhoneCall, Video, MessageSquare, FileText, Eye, Activity, Filter,
  Search, BarChart3, PieChart, DollarSign, AlertCircle, Star, Layers,
  UserPlus, Handshake, Trophy, Frown, RefreshCw, MoreVertical, Send,
} from 'lucide-react'

// ===========================================
// TYPES
// ===========================================
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'
type DealStatus = 'open' | 'won' | 'lost'
type ActivityType = 'call' | 'meeting' | 'email' | 'task' | 'note'

interface Stage {
  id: string
  company_id: string
  name: string
  display_order: number
  color: string
  win_probability: number
  is_won: boolean
  is_lost: boolean
  is_active: boolean
}

interface Lead {
  id: string
  company_id: string
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  position: string | null
  source: string | null
  status: LeadStatus
  notes: string | null
  contact_id: string | null
  assigned_to: string | null
  estimated_value: number
  currency: string
  expected_close_date: string | null
  created_at: string
}

interface Deal {
  id: string
  company_id: string
  deal_name: string
  lead_id: string | null
  contact_id: string | null
  contact_name: string | null
  stage_id: string | null
  value: number
  currency: string
  expected_close_date: string | null
  actual_close_date: string | null
  status: DealStatus
  loss_reason: string | null
  source: string | null
  assigned_to: string | null
  project_id: string | null
  description: string | null
  created_at: string
  stage_name?: string
  stage_color?: string
}

interface ActivityItem {
  id: string
  company_id: string
  activity_type: ActivityType
  subject: string
  description: string | null
  lead_id: string | null
  deal_id: string | null
  contact_id: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  outcome: string | null
  assigned_to: string | null
  created_by_name: string | null
  created_at: string
}

// ===========================================
// CONSTANTS
// ===========================================
const LEAD_SOURCES = [
  { value: 'web', label: '🌐 Web Sitesi' },
  { value: 'referral', label: '🤝 Referans' },
  { value: 'fair', label: '🎪 Fuar' },
  { value: 'cold_call', label: '📞 Soğuk Arama' },
  { value: 'social', label: '📱 Sosyal Medya' },
  { value: 'email_campaign', label: '✉️ E-posta Kampanyası' },
  { value: 'partner', label: '🤲 İş Ortağı' },
  { value: 'other', label: '📌 Diğer' },
]

const LEAD_STATUS_MAP: Record<LeadStatus, { label: string; bg: string; text: string }> = {
  new: { label: 'Yeni', bg: 'bg-blue-100', text: 'text-blue-700' },
  contacted: { label: 'İletişim Kuruldu', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  qualified: { label: 'Nitelikli', bg: 'bg-purple-100', text: 'text-purple-700' },
  unqualified: { label: 'Niteliksiz', bg: 'bg-gray-100', text: 'text-gray-700' },
  converted: { label: 'Dönüştürüldü', bg: 'bg-green-100', text: 'text-green-700' },
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: any; color: string }[] = [
  { value: 'call', label: 'Telefon', icon: PhoneCall, color: 'bg-blue-100 text-blue-700' },
  { value: 'meeting', label: 'Toplantı', icon: Video, color: 'bg-purple-100 text-purple-700' },
  { value: 'email', label: 'E-posta', icon: Mail, color: 'bg-pink-100 text-pink-700' },
  { value: 'task', label: 'Görev', icon: CheckCircle2, color: 'bg-orange-100 text-orange-700' },
  { value: 'note', label: 'Not', icon: MessageSquare, color: 'bg-yellow-100 text-yellow-700' },
]

const STAGE_COLORS = ['blue', 'purple', 'pink', 'orange', 'yellow', 'green', 'red', 'gray']
const STAGE_COLOR_MAP: Record<string, { bg: string; bgLight: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-300' },
  orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  green: { bg: 'bg-green-500', bgLight: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  red: { bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  gray: { bg: 'bg-gray-500', bgLight: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300' },
}

const DEFAULT_STAGES = [
  { name: 'Yeni Fırsat', color: 'blue', win_probability: 10, is_won: false, is_lost: false },
  { name: 'İletişim Kuruldu', color: 'purple', win_probability: 25, is_won: false, is_lost: false },
  { name: 'Toplantı / Demo', color: 'pink', win_probability: 40, is_won: false, is_lost: false },
  { name: 'Teklif Verildi', color: 'orange', win_probability: 60, is_won: false, is_lost: false },
  { name: 'Müzakere', color: 'yellow', win_probability: 80, is_won: false, is_lost: false },
  { name: 'Kazanıldı', color: 'green', win_probability: 100, is_won: true, is_lost: false },
  { name: 'Kaybedildi', color: 'red', win_probability: 0, is_won: false, is_lost: true },
]

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"

// ===========================================
// HELPERS
// ===========================================
const fmtMoney = (n: number, currency: string = 'TRY') => {
  const sym = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' '
  return `${sym}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`
}
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString('tr-TR') : '-'

// ===========================================
// PAGE
// ===========================================
export default function CRMPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'dashboard' | 'pipeline' | 'leads' | 'customers' | 'deals' | 'activities' | 'reports'>('dashboard')

  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  // Modals
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [showDealModal, setShowDealModal] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null)
  const [showStageModal, setShowStageModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('')

  // Selected for detail panel
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  // Filters
  const [leadSearch, setLeadSearch] = useState('')
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | LeadStatus>('all')
  const [dealSearch, setDealSearch] = useState('')
  const [dealStatusFilter, setDealStatusFilter] = useState<'all' | DealStatus>('open')
  const [activityFilter, setActivityFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('upcoming')

  // Forms
  const emptyLead = {
    full_name: '', company_name: '', email: '', phone: '', position: '',
    source: '', status: 'new' as LeadStatus, notes: '', assigned_to: '',
    estimated_value: '', currency: 'TRY', expected_close_date: '',
  }
  const [leadForm, setLeadForm] = useState(emptyLead)

  const emptyDeal = {
    deal_name: '', lead_id: '', contact_id: '', stage_id: '', value: '',
    currency: 'TRY', expected_close_date: '', source: '', assigned_to: '',
    description: '',
  }
  const [dealForm, setDealForm] = useState(emptyDeal)

  const emptyActivity = {
    activity_type: 'call' as ActivityType, subject: '', description: '',
    lead_id: '', deal_id: '', contact_id: '', due_date: '', assigned_to: '',
  }
  const [activityForm, setActivityForm] = useState(emptyActivity)

  const emptyStage = { name: '', color: 'blue', win_probability: 0, is_won: false, is_lost: false }
  const [stageForm, setStageForm] = useState(emptyStage)

  const emptyCustomer = {
    contact_name: '', phone: '', email: '', address: '',
    tax_number: '', tax_office: '', sector: '',
  }
  const [customerForm, setCustomerForm] = useState(emptyCustomer)

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
    const [stagesRes, leadsRes, dealsRes, actsRes, contactsRes, empRes] = await Promise.all([
      supabase.from('crm_pipeline_stages').select('*').eq('company_id', cid).order('display_order'),
      supabase.from('crm_leads').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      supabase.from('crm_deals').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      supabase.from('crm_activities').select('*').eq('company_id', cid).order('due_date', { ascending: true }),
      supabase.from('contacts').select('*').eq('company_id', cid).eq('is_active', true).order('contact_name'),
      supabase.from('employees').select('id, full_name').eq('company_id', cid).eq('status', 'active').order('full_name'),
    ])

    // Default stages otomatik oluştur (ilk kullanımda)
    let stageList = stagesRes.data || []
    if (stageList.length === 0) {
      const payload = DEFAULT_STAGES.map((s, idx) => ({ ...s, company_id: cid, display_order: idx }))
      const { data: created } = await supabase.from('crm_pipeline_stages').insert(payload).select()
      stageList = created || []
    }
    setStages(stageList)
    setLeads(leadsRes.data || [])
    setContacts(contactsRes.data || [])
    setEmployees(empRes.data || [])
    setActivities(actsRes.data || [])

    // Deals'a stage adı/rengi attach et
    const stageMap = new Map(stageList.map((s: any) => [s.id, s]))
    setDeals((dealsRes.data || []).map((d: any) => ({
      ...d,
      stage_name: d.stage_id ? (stageMap.get(d.stage_id) as any)?.name : null,
      stage_color: d.stage_id ? (stageMap.get(d.stage_id) as any)?.color : null,
    })))
  }

  // ============= LEAD CRUD =============
  const openNewLead = () => { setEditingLead(null); setLeadForm(emptyLead); setShowLeadModal(true) }
  const openEditLead = (l: Lead) => {
    setEditingLead(l)
    setLeadForm({
      full_name: l.full_name, company_name: l.company_name || '', email: l.email || '',
      phone: l.phone || '', position: l.position || '', source: l.source || '',
      status: l.status, notes: l.notes || '', assigned_to: l.assigned_to || '',
      estimated_value: l.estimated_value?.toString() || '', currency: l.currency || 'TRY',
      expected_close_date: l.expected_close_date || '',
    })
    setShowLeadModal(true)
  }
  const saveLead = async () => {
    if (!leadForm.full_name || !companyId) return alert('Ad soyad zorunlu!')
    try {
      const payload = {
        company_id: companyId,
        full_name: leadForm.full_name,
        company_name: leadForm.company_name || null,
        email: leadForm.email || null,
        phone: leadForm.phone || null,
        position: leadForm.position || null,
        source: leadForm.source || null,
        status: leadForm.status,
        notes: leadForm.notes || null,
        assigned_to: leadForm.assigned_to || null,
        estimated_value: leadForm.estimated_value ? parseFloat(leadForm.estimated_value) : 0,
        currency: leadForm.currency,
        expected_close_date: leadForm.expected_close_date || null,
        updated_at: new Date().toISOString(),
      }
      if (editingLead) {
        await supabase.from('crm_leads').update(payload).eq('id', editingLead.id)
      } else {
        await supabase.from('crm_leads').insert({ ...payload, created_by: userId })
      }
      setShowLeadModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const deleteLead = async (l: Lead) => {
    if (!confirm(`"${l.full_name}" lead'ini silmek istediğine emin misin?`)) return
    await supabase.from('crm_leads').delete().eq('id', l.id)
    await loadAll(companyId!)
  }
  const convertLeadToDeal = (l: Lead) => {
    setEditingDeal(null)
    setDealForm({
      ...emptyDeal,
      deal_name: `${l.company_name || l.full_name} — Fırsat`,
      lead_id: l.id,
      contact_id: '',
      stage_id: stages[0]?.id || '',
      value: l.estimated_value?.toString() || '',
      currency: l.currency || 'TRY',
      expected_close_date: l.expected_close_date || '',
      source: l.source || '',
      assigned_to: l.assigned_to || '',
      description: l.notes || '',
    })
    setShowDealModal(true)
  }

  // ============= DEAL CRUD =============
  const openNewDeal = () => {
    setEditingDeal(null)
    setDealForm({ ...emptyDeal, stage_id: stages[0]?.id || '' })
    setShowDealModal(true)
  }
  const openEditDeal = (d: Deal) => {
    setEditingDeal(d)
    setDealForm({
      deal_name: d.deal_name, lead_id: d.lead_id || '', contact_id: d.contact_id || '',
      stage_id: d.stage_id || '', value: d.value?.toString() || '', currency: d.currency,
      expected_close_date: d.expected_close_date || '', source: d.source || '',
      assigned_to: d.assigned_to || '', description: d.description || '',
    })
    setShowDealModal(true)
  }
  const saveDeal = async () => {
    if (!dealForm.deal_name || !companyId) return alert('Fırsat adı zorunlu!')
    const stage = stages.find(s => s.id === dealForm.stage_id)
    const status: DealStatus = stage?.is_won ? 'won' : stage?.is_lost ? 'lost' : 'open'
    try {
      const contactName = dealForm.contact_id ? contacts.find(c => c.id === dealForm.contact_id)?.contact_name : null
      const payload = {
        company_id: companyId,
        deal_name: dealForm.deal_name,
        lead_id: dealForm.lead_id || null,
        contact_id: dealForm.contact_id || null,
        contact_name: contactName,
        stage_id: dealForm.stage_id || null,
        value: dealForm.value ? parseFloat(dealForm.value) : 0,
        currency: dealForm.currency,
        expected_close_date: dealForm.expected_close_date || null,
        actual_close_date: status !== 'open' ? new Date().toISOString().split('T')[0] : null,
        status,
        source: dealForm.source || null,
        assigned_to: dealForm.assigned_to || null,
        description: dealForm.description || null,
        updated_at: new Date().toISOString(),
      }
      if (editingDeal) {
        await supabase.from('crm_deals').update(payload).eq('id', editingDeal.id)
      } else {
        await supabase.from('crm_deals').insert({ ...payload, created_by: userId })
      }
      setShowDealModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const deleteDeal = async (d: Deal) => {
    if (!confirm(`"${d.deal_name}" fırsatını silmek istediğine emin misin?`)) return
    await supabase.from('crm_deals').delete().eq('id', d.id)
    await loadAll(companyId!)
  }
  const moveDealToStage = async (dealId: string, stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    const status: DealStatus = stage?.is_won ? 'won' : stage?.is_lost ? 'lost' : 'open'
    await supabase.from('crm_deals').update({
      stage_id: stageId,
      status,
      actual_close_date: status !== 'open' ? new Date().toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString(),
    }).eq('id', dealId)
    await loadAll(companyId!)
  }

  // ============= ACTIVITY CRUD =============
  const openNewActivity = (presetDealId?: string, presetLeadId?: string) => {
    setEditingActivity(null)
    setActivityForm({
      ...emptyActivity,
      deal_id: presetDealId || '',
      lead_id: presetLeadId || '',
      due_date: new Date().toISOString().slice(0, 16),
    })
    setShowActivityModal(true)
  }
  const saveActivity = async () => {
    if (!activityForm.subject || !companyId) return alert('Konu zorunlu!')
    try {
      const payload = {
        company_id: companyId,
        activity_type: activityForm.activity_type,
        subject: activityForm.subject,
        description: activityForm.description || null,
        lead_id: activityForm.lead_id || null,
        deal_id: activityForm.deal_id || null,
        contact_id: activityForm.contact_id || null,
        due_date: activityForm.due_date || null,
        assigned_to: activityForm.assigned_to || null,
        created_by: userId,
        created_by_name: userName,
        updated_at: new Date().toISOString(),
      }
      if (editingActivity) {
        await supabase.from('crm_activities').update(payload).eq('id', editingActivity.id)
      } else {
        await supabase.from('crm_activities').insert(payload)
      }
      setShowActivityModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const toggleActivityComplete = async (a: ActivityItem) => {
    await supabase.from('crm_activities').update({
      completed: !a.completed,
      completed_at: !a.completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', a.id)
    await loadAll(companyId!)
  }
  const deleteActivity = async (a: ActivityItem) => {
    if (!confirm('Aktiviteyi silmek istediğine emin misin?')) return
    await supabase.from('crm_activities').delete().eq('id', a.id)
    await loadAll(companyId!)
  }

  // ============= STAGE CRUD =============
  const saveStage = async () => {
    if (!stageForm.name || !companyId) return alert('Aşama adı zorunlu!')
    await supabase.from('crm_pipeline_stages').insert({
      ...stageForm,
      company_id: companyId,
      display_order: stages.length,
    })
    setShowStageModal(false)
    setStageForm(emptyStage)
    await loadAll(companyId)
  }

  // ============= CUSTOMER CRUD =============
  const openNewCustomer = () => { setEditingCustomer(null); setCustomerForm(emptyCustomer); setShowCustomerModal(true) }
  const openEditCustomer = (c: any) => {
    setEditingCustomer(c)
    setCustomerForm({
      contact_name: c.contact_name || '', phone: c.phone || '', email: c.email || '',
      address: c.address || '', tax_number: c.tax_number || '', tax_office: c.tax_office || '',
      sector: c.sector || '',
    })
    setShowCustomerModal(true)
  }
  const saveCustomer = async () => {
    if (!customerForm.contact_name || !companyId) return alert('Firma/kişi adı zorunlu!')
    try {
      const payload: any = {
        contact_name: customerForm.contact_name,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        address: customerForm.address || null,
        tax_number: customerForm.tax_number || null,
        tax_office: customerForm.tax_office || null,
        sector: customerForm.sector || null,
      }
      if (editingCustomer) {
        await supabase.from('contacts').update(payload).eq('id', editingCustomer.id)
      } else {
        await supabase.from('contacts').insert({ ...payload, company_id: companyId, is_active: true })
      }
      setShowCustomerModal(false)
      await loadAll(companyId)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }
  const deleteCustomer = async (c: any) => {
    if (!confirm(`"${c.contact_name}" müşterisini silmek istediğine emin misin?\n\n(Geçmiş kayıtlar etkilenmeyecek, sadece pasife alınacak.)`)) return
    await supabase.from('contacts').update({ is_active: false }).eq('id', c.id)
    await loadAll(companyId!)
  }

  // ============= FILTERS =============
  const filteredLeads = leads.filter(l => {
    if (leadStatusFilter !== 'all' && l.status !== leadStatusFilter) return false
    if (leadSearch) {
      const t = leadSearch.toLowerCase()
      return [l.full_name, l.company_name, l.email, l.phone].some(v => v?.toLowerCase().includes(t))
    }
    return true
  })

  const filteredCustomers = contacts.filter(c => {
    if (!customerSearch) return true
    const t = customerSearch.toLowerCase()
    return [c.contact_name, c.phone, c.email, c.tax_number, c.sector].some(v => v?.toLowerCase().includes(t))
  })

  const filteredDeals = deals.filter(d => {
    if (dealStatusFilter !== 'all' && d.status !== dealStatusFilter) return false
    if (dealSearch) {
      const t = dealSearch.toLowerCase()
      return [d.deal_name, d.contact_name, d.stage_name].some(v => v?.toLowerCase().includes(t))
    }
    return true
  })

  const filteredActivities = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000)
    return activities.filter(a => {
      const due = a.due_date ? new Date(a.due_date) : null
      switch (activityFilter) {
        case 'today': return due && due >= today && due < tomorrow && !a.completed
        case 'upcoming': return due && due >= now && !a.completed
        case 'overdue': return due && due < now && !a.completed
        case 'completed': return a.completed
        case 'all':
        default: return true
      }
    })
  }, [activities, activityFilter])

  // ============= KPIs =============
  const kpis = useMemo(() => {
    const openDeals = deals.filter(d => d.status === 'open')
    const wonDeals = deals.filter(d => d.status === 'won')
    const lostDeals = deals.filter(d => d.status === 'lost')
    const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0)
    const wonValue = wonDeals.reduce((s, d) => s + d.value, 0)
    const totalDealsClosed = wonDeals.length + lostDeals.length
    const winRate = totalDealsClosed > 0 ? (wonDeals.length / totalDealsClosed) * 100 : 0

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000)
    const todayActivities = activities.filter(a => {
      const d = a.due_date ? new Date(a.due_date) : null
      return d && d >= todayStart && d < tomorrowStart && !a.completed
    })
    const overdueCount = activities.filter(a => {
      const d = a.due_date ? new Date(a.due_date) : null
      return d && d < today && !a.completed
    }).length

    return {
      totalLeads: leads.length,
      openDeals: openDeals.length,
      totalPipeline,
      wonValue,
      winRate,
      todayActivities: todayActivities.length,
      overdueCount,
      newLeadsThisMonth: leads.filter(l => {
        const d = new Date(l.created_at)
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
      }).length,
    }
  }, [leads, deals, activities])

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-600">Yükleniyor...</div></div>

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'pipeline', label: 'Pipeline', icon: Layers },
    { id: 'leads', label: "Lead'ler", icon: UserPlus },
    { id: 'customers', label: 'Müşteriler', icon: Users },
    { id: 'deals', label: 'Fırsatlar', icon: Handshake },
    { id: 'activities', label: 'Aktiviteler', icon: Calendar },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
  ]

  return (
    <PermissionGuard module="crm" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-600" /> CRM
            </h2>
            <p className="text-gray-600">Müşteri ilişkileri, satış pipeline ve aktivite takibi</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={openNewCustomer} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow">
              <Users className="w-4 h-4" /> Yeni Müşteri
            </button>
            <button onClick={openNewLead} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow">
              <UserPlus className="w-4 h-4" /> Yeni Lead
            </button>
            <button onClick={openNewDeal} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow">
              <Plus className="w-4 h-4" /> Yeni Fırsat
            </button>
            <button onClick={() => openNewActivity()} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow">
              <Calendar className="w-4 h-4" /> Aktivite
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex gap-1 flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* ===== DASHBOARD ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Toplam Lead" value={kpis.totalLeads} icon={UserPlus} color="purple" subtitle={`${kpis.newLeadsThisMonth} bu ay`} />
              <KPICard title="Açık Fırsat" value={kpis.openDeals} icon={Handshake} color="blue" subtitle={fmtMoney(kpis.totalPipeline)} />
              <KPICard title="Kazanılan" value={fmtMoney(kpis.wonValue)} icon={Trophy} color="green" subtitle={`%${kpis.winRate.toFixed(1)} win rate`} />
              <KPICard title="Bugün Aktivite" value={kpis.todayActivities} icon={Calendar} color="orange"
                subtitle={kpis.overdueCount > 0 ? `${kpis.overdueCount} gecikmiş` : 'Hepsi planlı'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline mini */}
              <div className="bg-white rounded-xl shadow-md p-5">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Target className="w-5 h-5 text-blue-500" /> Pipeline Özeti</h3>
                <div className="space-y-2">
                  {stages.filter(s => !s.is_won && !s.is_lost).map(s => {
                    const stageDeals = deals.filter(d => d.stage_id === s.id && d.status === 'open')
                    const total = stageDeals.reduce((sum, d) => sum + d.value, 0)
                    const colors = STAGE_COLOR_MAP[s.color] || STAGE_COLOR_MAP.gray
                    return (
                      <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg ${colors.bgLight} border ${colors.border}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded ${colors.bg}`}></div>
                          <div>
                            <div className={`font-semibold text-sm ${colors.text}`}>{s.name}</div>
                            <div className="text-xs text-gray-500">{stageDeals.length} fırsat</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-800">{fmtMoney(total)}</div>
                          <div className="text-[10px] text-gray-500">%{s.win_probability}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Gecikmiş + bugünkü aktiviteler */}
              <div className="bg-white rounded-xl shadow-md p-5">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-500" /> Bugün & Gecikmiş</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredActivities.length === 0 && activityFilter !== 'all' && (
                    <p className="text-center text-gray-400 py-8 text-sm">Bekleyen aktivite yok 🎉</p>
                  )}
                  {activities.filter(a => {
                    const d = a.due_date ? new Date(a.due_date) : null
                    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
                    return d && d <= tomorrow && !a.completed
                  }).slice(0, 8).map(a => <ActivityRow key={a.id} a={a} onToggle={toggleActivityComplete} compact />)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== PIPELINE (KANBAN) ===== */}
        {activeTab === 'pipeline' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm border p-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Toplam: <b>{deals.filter(d => d.status === 'open').length}</b> açık fırsat — değer: <b>{fmtMoney(kpis.totalPipeline)}</b>
              </div>
              <button onClick={() => setShowStageModal(true)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Aşama Ekle
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-3">
              {stages.map(s => {
                const stageDeals = deals.filter(d => d.stage_id === s.id)
                const total = stageDeals.reduce((sum, d) => sum + d.value, 0)
                const colors = STAGE_COLOR_MAP[s.color] || STAGE_COLOR_MAP.gray
                return (
                  <div key={s.id} className="min-w-[280px] flex-shrink-0">
                    <div className={`rounded-t-lg p-3 ${colors.bgLight} border-b-2 ${colors.border}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-bold ${colors.text}`}>{s.name}</div>
                          <div className="text-xs text-gray-600">{stageDeals.length} fırsat · {fmtMoney(total)}</div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded ${colors.bg} text-white font-bold`}>%{s.win_probability}</div>
                      </div>
                    </div>
                    <div className={`bg-gray-50 p-2 rounded-b-lg min-h-[400px] space-y-2 border ${colors.border} border-t-0`}>
                      {stageDeals.map(d => (
                        <DealCard key={d.id} deal={d} stages={stages} onEdit={openEditDeal} onDelete={deleteDeal} onMove={moveDealToStage} />
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-xs">Bu aşamada fırsat yok</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== LEAD'LER ===== */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Ad, şirket, e-posta ara..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <select value={leadStatusFilter} onChange={e => setLeadStatusFilter(e.target.value as any)} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">Tüm Durumlar</option>
                {Object.entries(LEAD_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İsim / Şirket</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İletişim</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Kaynak</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Tahmini Değer</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Tarih</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLeads.map(l => {
                    const stat = LEAD_STATUS_MAP[l.status]
                    return (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{l.full_name}</div>
                          {l.company_name && <div className="text-xs text-gray-500">{l.company_name} {l.position && `• ${l.position}`}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {l.email && <div className="flex items-center gap-1 text-gray-700"><Mail className="w-3 h-3" /> {l.email}</div>}
                          {l.phone && <div className="flex items-center gap-1 text-gray-700"><Phone className="w-3 h-3" /> {l.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{LEAD_SOURCES.find(s => s.value === l.source)?.label || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stat.bg} ${stat.text}`}>{stat.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">{l.estimated_value > 0 ? fmtMoney(l.estimated_value, l.currency) : '-'}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(l.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => convertLeadToDeal(l)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Fırsata Dönüştür">
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button onClick={() => openNewActivity(undefined, l.id)} className="p-1.5 rounded hover:bg-orange-50 text-orange-600" title="Aktivite Ekle">
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditLead(l)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => deleteLead(l)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredLeads.length === 0 && <p className="text-center text-gray-400 py-12">Lead bulunamadı</p>}
            </div>
          </div>
        )}

        {/* ===== MÜŞTERİLER ===== */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Müşteri, telefon, VKN, sektör ara..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="text-sm text-gray-500">{filteredCustomers.length} / {contacts.length} müşteri</div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">İletişim</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vergi Bilgileri</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Sektör</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Açık Fırsat</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCustomers.map(c => {
                    const openDealsForCustomer = deals.filter(d => d.contact_id === c.id && d.status === 'open')
                    const openValue = openDealsForCustomer.reduce((s, d) => s + d.value, 0)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{c.contact_name}</div>
                          {c.address && <div className="text-xs text-gray-500 truncate max-w-[200px]">{c.address}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.phone && <div className="flex items-center gap-1 text-gray-700"><Phone className="w-3 h-3" /> {c.phone}</div>}
                          {c.email && <div className="flex items-center gap-1 text-gray-700"><Mail className="w-3 h-3" /> {c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {c.tax_number && <div>VKN: {c.tax_number}</div>}
                          {c.tax_office && <div className="text-xs text-gray-500">{c.tax_office}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">{c.sector ? <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{c.sector}</span> : '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {openDealsForCustomer.length > 0 ? (
                            <div>
                              <div className="font-bold text-blue-700">{openDealsForCustomer.length}</div>
                              <div className="text-[10px] text-gray-500">{fmtMoney(openValue)}</div>
                            </div>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => {
                              setEditingDeal(null)
                              setDealForm({ ...emptyDeal, contact_id: c.id, deal_name: `${c.contact_name} — Fırsat`, stage_id: stages[0]?.id || '' })
                              setShowDealModal(true)
                            }} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Yeni Fırsat">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => {
                              setActivityForm({ ...emptyActivity, contact_id: c.id, due_date: new Date().toISOString().slice(0, 16) })
                              setEditingActivity(null)
                              setShowActivityModal(true)
                            }} className="p-1.5 rounded hover:bg-orange-50 text-orange-600" title="Aktivite Ekle">
                              <Calendar className="w-4 h-4" />
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
              {filteredCustomers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">{customerSearch ? 'Müşteri bulunamadı' : 'Henüz müşteri eklenmedi'}</p>
                  {!customerSearch && (
                    <button onClick={openNewCustomer} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <Plus className="w-4 h-4" /> İlk Müşterini Ekle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== FIRSATLAR (LIST) ===== */}
        {activeTab === 'deals' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={dealSearch} onChange={e => setDealSearch(e.target.value)} placeholder="Fırsat, müşteri, aşama ara..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <select value={dealStatusFilter} onChange={e => setDealStatusFilter(e.target.value as any)} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">Tümü</option>
                <option value="open">Açık</option>
                <option value="won">Kazanıldı</option>
                <option value="lost">Kaybedildi</option>
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Fırsat</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Aşama</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Değer</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Kapanış</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDeals.map(d => {
                    const colors = STAGE_COLOR_MAP[d.stage_color || 'gray']
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">{d.deal_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{d.contact_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${colors.bgLight} ${colors.text}`}>{d.stage_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtMoney(d.value, d.currency)}</td>
                        <td className="px-4 py-3 text-center text-sm">{fmtDate(d.expected_close_date)}</td>
                        <td className="px-4 py-3 text-center">
                          {d.status === 'won' && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Kazanıldı 🏆</span>}
                          {d.status === 'lost' && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Kaybedildi</span>}
                          {d.status === 'open' && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Açık</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openNewActivity(d.id)} className="p-1.5 rounded hover:bg-orange-50 text-orange-600" title="Aktivite Ekle">
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditDeal(d)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => deleteDeal(d)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredDeals.length === 0 && <p className="text-center text-gray-400 py-12">Fırsat bulunamadı</p>}
            </div>
          </div>
        )}

        {/* ===== AKTİVİTELER ===== */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-2 flex-wrap items-center">
              {[
                { id: 'today', label: 'Bugün', icon: Clock },
                { id: 'upcoming', label: 'Yaklaşan', icon: Calendar },
                { id: 'overdue', label: 'Gecikmiş', icon: AlertCircle },
                { id: 'completed', label: 'Tamamlanan', icon: CheckCircle2 },
                { id: 'all', label: 'Tümü', icon: Activity },
              ].map(f => {
                const Icon = f.icon
                return (
                  <button key={f.id} onClick={() => setActivityFilter(f.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      activityFilter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    <Icon className="w-4 h-4" /> {f.label}
                  </button>
                )
              })}
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              {filteredActivities.length === 0 ? (
                <p className="text-center text-gray-400 py-12">Aktivite bulunamadı</p>
              ) : (
                <div className="space-y-2">
                  {filteredActivities.map(a => <ActivityRow key={a.id} a={a} onToggle={toggleActivityComplete} onEdit={(ai) => { setEditingActivity(ai); setActivityForm({ activity_type: ai.activity_type, subject: ai.subject, description: ai.description || '', lead_id: ai.lead_id || '', deal_id: ai.deal_id || '', contact_id: ai.contact_id || '', due_date: ai.due_date?.slice(0, 16) || '', assigned_to: ai.assigned_to || '' }); setShowActivityModal(true) }} onDelete={deleteActivity} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== RAPORLAR ===== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard title="Win Rate" value={`%${kpis.winRate.toFixed(1)}`} icon={Trophy} color="green" subtitle="Kazanma oranı" />
              <KPICard title="Pipeline Değeri" value={fmtMoney(kpis.totalPipeline)} icon={Target} color="blue" subtitle={`${kpis.openDeals} açık fırsat`} />
              <KPICard title="Kazanılan" value={fmtMoney(kpis.wonValue)} icon={Award} color="purple" subtitle={`${deals.filter(d => d.status === 'won').length} fırsat`} />
            </div>

            {/* Source breakdown */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><PieChart className="w-5 h-5 text-purple-500" /> Lead Kaynak Dağılımı</h3>
              <div className="space-y-2">
                {LEAD_SOURCES.map(src => {
                  const count = leads.filter(l => l.source === src.value).length
                  const pct = leads.length > 0 ? (count / leads.length) * 100 : 0
                  if (count === 0) return null
                  return (
                    <div key={src.value}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span>{src.label}</span>
                        <span className="font-semibold">{count} (%{pct.toFixed(0)})</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stage breakdown */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500" /> Aşamaya Göre Fırsat Değeri</h3>
              <div className="space-y-2">
                {stages.map(s => {
                  const stageDeals = deals.filter(d => d.stage_id === s.id)
                  const total = stageDeals.reduce((sum, d) => sum + d.value, 0)
                  const maxTotal = Math.max(...stages.map(st => deals.filter(d => d.stage_id === st.id).reduce((sum, d) => sum + d.value, 0))) || 1
                  const pct = (total / maxTotal) * 100
                  const colors = STAGE_COLOR_MAP[s.color] || STAGE_COLOR_MAP.gray
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className={`${colors.text} font-semibold`}>{s.name} ({stageDeals.length})</span>
                        <span className="font-bold">{fmtMoney(total)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bg}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== LEAD MODAL ===== */}
        {showLeadModal && (
          <Modal title={editingLead ? "Lead'i Düzenle" : 'Yeni Lead'} onClose={() => setShowLeadModal(false)} large>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Ad Soyad *"><input value={leadForm.full_name} onChange={e => setLeadForm({ ...leadForm, full_name: e.target.value })} className={inputCls} /></Field>
                <Field label="Şirket / Firma"><input value={leadForm.company_name} onChange={e => setLeadForm({ ...leadForm, company_name: e.target.value })} className={inputCls} /></Field>
                <Field label="Pozisyon"><input value={leadForm.position} onChange={e => setLeadForm({ ...leadForm, position: e.target.value })} className={inputCls} placeholder="Örn: Satınalma Müdürü" /></Field>
                <Field label="E-posta"><input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className={inputCls} /></Field>
                <Field label="Telefon"><input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} className={inputCls} placeholder="0532..." /></Field>
                <Field label="Kaynak">
                  <select value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Durum">
                  <select value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value as LeadStatus })} className={inputCls}>
                    {Object.entries(LEAD_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="Atanan Kişi">
                  <select value={leadForm.assigned_to} onChange={e => setLeadForm({ ...leadForm, assigned_to: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Tahmini Değer">
                  <div className="flex gap-2">
                    <input type="number" value={leadForm.estimated_value} onChange={e => setLeadForm({ ...leadForm, estimated_value: e.target.value })} className={inputCls} placeholder="0" />
                    <select value={leadForm.currency} onChange={e => setLeadForm({ ...leadForm, currency: e.target.value })} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                    </select>
                  </div>
                </Field>
                <Field label="Beklenen Kapanış">
                  <input type="date" value={leadForm.expected_close_date} onChange={e => setLeadForm({ ...leadForm, expected_close_date: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Notlar"><textarea value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} rows={3} className={inputCls} /></Field>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLeadModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveLead} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">{editingLead ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ===== DEAL MODAL ===== */}
        {showDealModal && (
          <Modal title={editingDeal ? 'Fırsatı Düzenle' : 'Yeni Fırsat'} onClose={() => setShowDealModal(false)} large>
            <div className="space-y-4">
              <Field label="Fırsat Adı *"><input value={dealForm.deal_name} onChange={e => setDealForm({ ...dealForm, deal_name: e.target.value })} className={inputCls} placeholder="Örn: ABC Şirketi - Yıllık Bakım Kontratı" /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Müşteri (Cari)">
                  <select value={dealForm.contact_id} onChange={e => setDealForm({ ...dealForm, contact_id: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.contact_name}</option>)}
                  </select>
                </Field>
                <Field label="Pipeline Aşaması *">
                  <select value={dealForm.stage_id} onChange={e => setDealForm({ ...dealForm, stage_id: e.target.value })} className={inputCls}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name} (%{s.win_probability})</option>)}
                  </select>
                </Field>
                <Field label="Değer">
                  <div className="flex gap-2">
                    <input type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} className={inputCls} placeholder="0" />
                    <select value={dealForm.currency} onChange={e => setDealForm({ ...dealForm, currency: e.target.value })} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                    </select>
                  </div>
                </Field>
                <Field label="Beklenen Kapanış"><input type="date" value={dealForm.expected_close_date} onChange={e => setDealForm({ ...dealForm, expected_close_date: e.target.value })} className={inputCls} /></Field>
                <Field label="Kaynak">
                  <select value={dealForm.source} onChange={e => setDealForm({ ...dealForm, source: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Atanan Kişi">
                  <select value={dealForm.assigned_to} onChange={e => setDealForm({ ...dealForm, assigned_to: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Açıklama"><textarea value={dealForm.description} onChange={e => setDealForm({ ...dealForm, description: e.target.value })} rows={3} className={inputCls} /></Field>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDealModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveDeal} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">{editingDeal ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ===== ACTIVITY MODAL ===== */}
        {showActivityModal && (
          <Modal title={editingActivity ? 'Aktivite Düzenle' : 'Yeni Aktivite'} onClose={() => setShowActivityModal(false)}>
            <div className="space-y-4">
              <Field label="Aktivite Tipi">
                <div className="grid grid-cols-5 gap-2">
                  {ACTIVITY_TYPES.map(t => {
                    const Icon = t.icon
                    const selected = activityForm.activity_type === t.value
                    return (
                      <button key={t.value} onClick={() => setActivityForm({ ...activityForm, activity_type: t.value })}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${selected ? `${t.color} border-current` : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Konu *"><input value={activityForm.subject} onChange={e => setActivityForm({ ...activityForm, subject: e.target.value })} className={inputCls} placeholder="Örn: Demo görüşmesi" /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="İlişkili Fırsat">
                  <select value={activityForm.deal_id} onChange={e => setActivityForm({ ...activityForm, deal_id: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.deal_name}</option>)}
                  </select>
                </Field>
                <Field label="İlişkili Lead">
                  <select value={activityForm.lead_id} onChange={e => setActivityForm({ ...activityForm, lead_id: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.full_name} {l.company_name && `(${l.company_name})`}</option>)}
                  </select>
                </Field>
                <Field label="Tarih ve Saat"><input type="datetime-local" value={activityForm.due_date} onChange={e => setActivityForm({ ...activityForm, due_date: e.target.value })} className={inputCls} /></Field>
                <Field label="Atanan Kişi">
                  <select value={activityForm.assigned_to} onChange={e => setActivityForm({ ...activityForm, assigned_to: e.target.value })} className={inputCls}>
                    <option value="">Seçin...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Açıklama / Notlar"><textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} rows={3} className={inputCls} /></Field>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowActivityModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveActivity} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold">{editingActivity ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ===== CUSTOMER MODAL ===== */}
        {showCustomerModal && (
          <Modal title={editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'} onClose={() => setShowCustomerModal(false)} large>
            <div className="space-y-4">
              <Field label="Firma / Kişi Adı *">
                <input value={customerForm.contact_name} onChange={e => setCustomerForm({ ...customerForm, contact_name: e.target.value })} placeholder="Örn: ABC Mühendislik Ltd. Şti." className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Telefon">
                  <input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="0532..." className={inputCls} />
                </Field>
                <Field label="E-posta">
                  <input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="info@..." className={inputCls} />
                </Field>
              </div>
              <Field label="Adres">
                <input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Vergi No (VKN)">
                  <input value={customerForm.tax_number} onChange={e => setCustomerForm({ ...customerForm, tax_number: e.target.value })} placeholder="VKN" className={inputCls} />
                </Field>
                <Field label="Vergi Dairesi">
                  <input value={customerForm.tax_office} onChange={e => setCustomerForm({ ...customerForm, tax_office: e.target.value })} placeholder="Örn: Kadıköy" className={inputCls} />
                </Field>
              </div>
              <Field label="Sektör / Kategori">
                <input value={customerForm.sector} onChange={e => setCustomerForm({ ...customerForm, sector: e.target.value })} placeholder="Örn: Otomotiv, Savunma Sanayi" className={inputCls} />
              </Field>
              <div className="text-[11px] text-gray-500 bg-gray-50 rounded p-2">
                💡 Bu müşteri "Cari Hesaplar" modülüyle ortak — orada da görünür, banka bilgileri sonra eklenebilir.
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCustomerModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveCustomer} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">{editingCustomer ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ===== STAGE MODAL ===== */}
        {showStageModal && (
          <Modal title="Yeni Pipeline Aşaması" onClose={() => setShowStageModal(false)}>
            <div className="space-y-4">
              <Field label="Aşama Adı *"><input value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} className={inputCls} placeholder="Örn: Kontrat Hazırlanıyor" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Renk">
                  <select value={stageForm.color} onChange={e => setStageForm({ ...stageForm, color: e.target.value })} className={inputCls}>
                    {STAGE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Kazanma İhtimali (%)"><input type="number" min="0" max="100" value={stageForm.win_probability} onChange={e => setStageForm({ ...stageForm, win_probability: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={stageForm.is_won} onChange={e => setStageForm({ ...stageForm, is_won: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm">Kazanma aşaması</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={stageForm.is_lost} onChange={e => setStageForm({ ...stageForm, is_lost: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm">Kaybedilen aşaması</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowStageModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={saveStage} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Kaydet</button>
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

function KPICard({ title, value, icon: Icon, color, subtitle }: { title: string; value: any; icon: any; color: string; subtitle?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50 text-blue-600',
    purple: 'border-purple-500 bg-purple-50 text-purple-600',
    green: 'border-green-500 bg-green-50 text-green-600',
    orange: 'border-orange-500 bg-orange-50 text-orange-600',
    red: 'border-red-500 bg-red-50 text-red-600',
  }
  const c = colors[color] || colors.blue
  return (
    <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${c.split(' ')[0]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${c.split(' ')[1]}`}>
          <Icon className={`w-6 h-6 ${c.split(' ')[2]}`} />
        </div>
      </div>
    </div>
  )
}

function DealCard({ deal, stages, onEdit, onDelete, onMove }: { deal: Deal; stages: Stage[]; onEdit: (d: Deal) => void; onDelete: (d: Deal) => void; onMove: (id: string, stageId: string) => void }) {
  const [showMove, setShowMove] = useState(false)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-800">{deal.deal_name}</div>
          {deal.contact_name && <div className="text-[11px] text-gray-500 mt-0.5">{deal.contact_name}</div>}
        </div>
        <div className="relative">
          <button onClick={() => setShowMove(!showMove)} className="p-1 hover:bg-gray-100 rounded"><MoreVertical className="w-3 h-3 text-gray-500" /></button>
          {showMove && (
            <div className="absolute right-0 top-6 bg-white shadow-lg border rounded-lg z-10 min-w-[160px]">
              <div className="px-3 py-2 text-[10px] text-gray-500 uppercase font-semibold border-b">Taşı</div>
              {stages.map(s => (
                <button key={s.id} onClick={() => { onMove(deal.id, s.id); setShowMove(false) }}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${s.id === deal.stage_id ? 'bg-blue-50 text-blue-700 font-semibold' : ''}`}>
                  {s.name}
                </button>
              ))}
              <div className="border-t mt-1 pt-1">
                <button onClick={() => { setShowMove(false); onEdit(deal) }} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-blue-600">Düzenle</button>
                <button onClick={() => { setShowMove(false); onDelete(deal) }} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600">Sil</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="font-bold text-gray-900 text-sm">{fmtMoney(deal.value, deal.currency)}</div>
        {deal.expected_close_date && (
          <div className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(deal.expected_close_date)}</div>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ a, onToggle, onEdit, onDelete, compact }: { a: ActivityItem; onToggle: (a: ActivityItem) => void; onEdit?: (a: ActivityItem) => void; onDelete?: (a: ActivityItem) => void; compact?: boolean }) {
  const type = ACTIVITY_TYPES.find(t => t.value === a.activity_type) || ACTIVITY_TYPES[0]
  const Icon = type.icon
  const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !a.completed
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      a.completed ? 'bg-gray-50 border-gray-200 opacity-70' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      <button onClick={() => onToggle(a)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        a.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
      }`}>
        {a.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>
      <div className={`p-1.5 rounded ${type.color}`}><Icon className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${a.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{a.subject}</div>
        {!compact && a.description && <div className="text-xs text-gray-500 truncate">{a.description}</div>}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
          {a.due_date && <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>📅 {fmtDateTime(a.due_date)}</span>}
          {a.created_by_name && <span>• {a.created_by_name}</span>}
        </div>
      </div>
      {!compact && (
        <div className="flex items-center gap-1">
          {onEdit && <button onClick={() => onEdit(a)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>}
          {onDelete && <button onClick={() => onDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      )}
    </div>
  )
}

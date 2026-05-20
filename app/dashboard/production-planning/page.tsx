'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { Plus, X, Calendar, Factory, Package, ArrowRight, Clock, CheckCircle2, AlertTriangle, Trash2, Edit3 } from 'lucide-react'

interface PlanItem {
  id: string
  project_id: string | null
  project_name: string
  product_name: string
  product_code: string
  quantity: number
  completed_quantity: number
  machine_id: string | null
  machine_name: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  start_date: string
  end_date: string | null
  notes: string | null
  created_at: string
}

const PRIORITY_MAP = {
  low: { label: 'Düşük', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  normal: { label: 'Normal', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  high: { label: 'Yüksek', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  urgent: { label: 'Acil', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
}

const STATUS_MAP = {
  planned: { label: 'Planlandı', bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
  in_progress: { label: 'Üretimde', bg: 'bg-blue-100', text: 'text-blue-700', icon: Factory },
  completed: { label: 'Tamamlandı', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'İptal', bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
}

export default function ProductionPlanningPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')

  // Operasyonlar
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null)
  const [operations, setOperations] = useState<any[]>([])
  const [showOpsPanel, setShowOpsPanel] = useState(false)
  const [showAddOp, setShowAddOp] = useState(false)
  const [opForm, setOpForm] = useState({ operation_name: '', machine_id: '', responsible: '', estimated_duration: '', notes: '' })
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  const [form, setForm] = useState({
    project_id: '', product_name: '', product_code: '', quantity: '',
    machine_id: '', priority: 'normal', status: 'planned',
    start_date: new Date().toISOString().split('T')[0], end_date: '', notes: ''
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [plansRes, projRes, machRes] = await Promise.all([
        supabase.from('production_plans').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, project_name').eq('company_id', profile.company_id).order('project_name'),
        supabase.from('machines').select('id, machine_code, machine_name').eq('company_id', profile.company_id).order('machine_code'),
      ])

      setPlans(plansRes.data || [])
      setProjects(projRes.data || [])
      setMachines(machRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!form.product_name || !companyId) return alert('Ürün adı zorunludur!')
    try {
      const projectName = projects.find(p => p.id === form.project_id)?.project_name || ''
      const machineName = machines.find(m => m.id === form.machine_id)?.machine_name || ''
      const machineCode = machines.find(m => m.id === form.machine_id)?.machine_code || ''

      const payload = {
        company_id: companyId,
        project_id: form.project_id || null,
        project_name: projectName,
        product_name: form.product_name,
        product_code: form.product_code || null,
        quantity: parseInt(form.quantity) || 0,
        completed_quantity: 0,
        machine_id: form.machine_id || null,
        machine_name: machineCode ? `${machineCode} - ${machineName}` : '',
        priority: form.priority,
        status: form.status,
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes || null,
      }

      if (editingId) {
        const { error } = await supabase.from('production_plans').update(payload).eq('id', editingId)
        if (error) { alert('Güncelleme hatası: ' + error.message); return }
        alert('Plan güncellendi!')
      } else {
        const { error } = await supabase.from('production_plans').insert(payload)
        if (error) { alert('Kayıt hatası: ' + error.message); return }
        alert('Plan oluşturuldu!')
      }

      setShowModal(false)
      setEditingId(null)
      resetForm()
      init()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleEdit = (plan: PlanItem) => {
    setEditingId(plan.id)
    setForm({
      project_id: plan.project_id || '', product_name: plan.product_name,
      product_code: plan.product_code, quantity: plan.quantity.toString(),
      machine_id: plan.machine_id || '', priority: plan.priority, status: plan.status,
      start_date: plan.start_date, end_date: plan.end_date || '', notes: plan.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu planı silmek istediğinizden emin misiniz?')) return
    await supabase.from('production_plans').delete().eq('id', id)
    init()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('production_plans').update({ status }).eq('id', id)
    init()
  }

  // Operasyon fonksiyonları
  const openOperations = async (plan: PlanItem) => {
    setSelectedPlan(plan)
    const { data } = await supabase.from('production_operations').select('*').eq('plan_id', plan.id).order('sira')
    setOperations(data || [])
    setShowOpsPanel(true)
  }

  const handleAddOperation = async () => {
    if (!opForm.operation_name || !selectedPlan || !companyId) return alert('Operasyon adı zorunlu!')
    const sira = operations.length + 1
    const machineName = machines.find(m => m.id === opForm.machine_id)
    const { error } = await supabase.from('production_operations').insert({
      company_id: companyId, plan_id: selectedPlan.id, sira,
      operation_name: opForm.operation_name,
      machine_id: opForm.machine_id || null,
      machine_name: machineName ? `${machineName.machine_code} - ${machineName.machine_name}` : null,
      responsible: opForm.responsible || null,
      estimated_duration: opForm.estimated_duration ? parseInt(opForm.estimated_duration) : null,
      notes: opForm.notes || null, status: 'pending',
    })
    if (error) return alert('Hata: ' + error.message)
    setOpForm({ operation_name: '', machine_id: '', responsible: '', estimated_duration: '', notes: '' })
    setShowAddOp(false)
    openOperations(selectedPlan)
  }

  const handleOpStatus = async (opId: string, status: string) => {
    const now = new Date().toISOString()
    const update: any = { status }
    if (status === 'in_progress') update.started_at = now
    if (status === 'completed') update.completed_at = now
    await supabase.from('production_operations').update(update).eq('id', opId)
    if (selectedPlan) openOperations(selectedPlan)
  }

  const handleDeleteOp = async (opId: string) => {
    if (!confirm('Bu operasyonu silmek istediğinizden emin misiniz?')) return
    await supabase.from('production_operations').delete().eq('id', opId)
    if (selectedPlan) openOperations(selectedPlan)
  }

  const resetForm = () => setForm({
    project_id: '', product_name: '', product_code: '', quantity: '',
    machine_id: '', priority: 'normal', status: 'planned',
    start_date: new Date().toISOString().split('T')[0], end_date: '', notes: ''
  })

  const filtered = plans.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterPriority !== 'all' && p.priority !== filterPriority) return false
    return true
  })

  const planned = filtered.filter(p => p.status === 'planned')
  const inProgress = filtered.filter(p => p.status === 'in_progress')
  const completed = filtered.filter(p => p.status === 'completed')

  if (loading) return (
    <PermissionGuard module="planning" permission="view">
      <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
    </PermissionGuard>
  )

  const PlanCard = ({ plan }: { plan: PlanItem }) => {
    const pr = PRIORITY_MAP[plan.priority] || PRIORITY_MAP.normal
    const st = STATUS_MAP[plan.status] || STATUS_MAP.planned
    const progress = plan.quantity > 0 ? Math.round((plan.completed_quantity / plan.quantity) * 100) : 0

    return (
      <div className={`bg-white rounded-xl border-2 ${pr.border} p-4 shadow-sm hover:shadow-md transition-all`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 text-sm">{plan.product_name}</h4>
            {plan.product_code && <p className="text-xs text-gray-400 font-mono">{plan.product_code}</p>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => openOperations(plan)} className="p-1 rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600" title="Operasyonlar"><Factory className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleEdit(plan)} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDelete(plan.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {plan.project_name && (
          <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
            <Package className="w-3 h-3" /> {plan.project_name}
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pr.bg} ${pr.text}`}>{pr.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
        </div>

        {plan.quantity > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{plan.completed_quantity} / {plan.quantity} adet</span>
              <span className="font-semibold text-gray-700">%{progress}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(plan.start_date).toLocaleDateString('tr-TR')}
            {plan.end_date && <><ArrowRight className="w-3 h-3" />{new Date(plan.end_date).toLocaleDateString('tr-TR')}</>}
          </div>
          {plan.machine_name && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{plan.machine_name}</span>}
        </div>

        {/* Hızlı durum değiştirme */}
        {plan.status !== 'completed' && plan.status !== 'cancelled' && (
          <div className="flex gap-1 mt-3 pt-3 border-t">
            {plan.status === 'planned' && (
              <button onClick={() => handleStatusChange(plan.id, 'in_progress')} className="flex-1 text-xs py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-semibold">Üretime Al</button>
            )}
            {plan.status === 'in_progress' && (
              <button onClick={() => handleStatusChange(plan.id, 'completed')} className="flex-1 text-xs py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-semibold">Tamamla</button>
            )}
            <button onClick={() => handleStatusChange(plan.id, 'cancelled')} className="text-xs py-1.5 px-3 bg-gray-50 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600">İptal</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <PermissionGuard module="planning" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Üretim Planlama</h2>
            <p className="text-gray-600">Üretim şeması ve iş emirlerini yönetin</p>
          </div>
          <div className="flex gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('board')} className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${viewMode === 'board' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Kanban</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Liste</button>
            </div>
            <button onClick={() => { setEditingId(null); resetForm(); setShowModal(true) }}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
              <Plus className="w-4 h-4" /> Yeni Plan
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-500">Planlandı</p>
            <p className="text-2xl font-bold text-gray-600">{plans.filter(p => p.status === 'planned').length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">Üretimde</p>
            <p className="text-2xl font-bold text-blue-600">{plans.filter(p => p.status === 'in_progress').length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Tamamlanan</p>
            <p className="text-2xl font-bold text-green-600">{plans.filter(p => p.status === 'completed').length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500">Toplam</p>
            <p className="text-2xl font-bold text-purple-600">{plans.length}</p>
          </div>
        </div>

        {/* Filtreler */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">Tüm Durumlar</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">Tüm Öncelikler</option>
            {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Kanban Board */}
        {viewMode === 'board' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Planlandı */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-gray-700">Planlandı</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{planned.length}</span>
              </div>
              <div className="space-y-3">
                {planned.map(p => <PlanCard key={p.id} plan={p} />)}
                {planned.length === 0 && <div className="text-center py-8 text-gray-300 text-sm">Planlanmış iş yok</div>}
              </div>
            </div>

            {/* Üretimde */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Factory className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-blue-700">Üretimde</h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{inProgress.length}</span>
              </div>
              <div className="space-y-3">
                {inProgress.map(p => <PlanCard key={p.id} plan={p} />)}
                {inProgress.length === 0 && <div className="text-center py-8 text-gray-300 text-sm">Üretimde iş yok</div>}
              </div>
            </div>

            {/* Tamamlandı */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-green-700">Tamamlandı</h3>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-semibold">{completed.length}</span>
              </div>
              <div className="space-y-3">
                {completed.map(p => <PlanCard key={p.id} plan={p} />)}
                {completed.length === 0 && <div className="text-center py-8 text-gray-300 text-sm">Tamamlanan iş yok</div>}
              </div>
            </div>
          </div>
        )}

        {/* Liste */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ürün</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Proje</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tezgah</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Miktar</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Öncelik</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tarih</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => {
                  const pr = PRIORITY_MAP[p.priority]; const st = STATUS_MAP[p.status]
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-semibold text-sm text-gray-900">{p.product_name}</div><div className="text-xs text-gray-400 font-mono">{p.product_code}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.project_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.machine_name || '-'}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold">{p.completed_quantity}/{p.quantity}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pr.bg} ${pr.text}`}>{pr.label}</span></td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.start_date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(p)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Plan bulunamadı</div>}
          </div>
        )}

        {/* Modal */}
        {/* Operasyon Paneli */}
        {showOpsPanel && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowOpsPanel(false)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Üretim Şeması</h3>
                  <p className="text-sm text-gray-500">{selectedPlan.product_name} {selectedPlan.product_code && `(${selectedPlan.product_code})`}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddOp(true); setOpForm({ operation_name: '', machine_id: '', responsible: '', estimated_duration: '', notes: '' }) }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"><Plus className="w-4 h-4 inline mr-1" />Operasyon Ekle</button>
                  <button onClick={() => setShowOpsPanel(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
              </div>

              <div className="p-6">
                {/* Proje Bilgisi */}
                {selectedPlan.project_name && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Proje: {selectedPlan.project_name}</span>
                    <span className="text-xs text-blue-500 ml-auto">{operations.length} operasyon</span>
                  </div>
                )}

                {/* Hızlı Operasyon Ekleme — Her zaman görünür */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-5">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">OPERASYON ADI *</label>
                      <input type="text" value={opForm.operation_name} onChange={e => setOpForm({...opForm, operation_name: e.target.value})}
                        onKeyDown={e => { if (e.key === 'Enter' && opForm.operation_name) handleAddOperation() }}
                        placeholder="Ör: Tornalama, Frezeleme, Kalite Kontrol..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" autoFocus />
                    </div>
                    <div className="w-36">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">TEZGAH</label>
                      <select value={opForm.machine_id} onChange={e => setOpForm({...opForm, machine_id: e.target.value})} className="w-full px-2 py-2 border rounded-lg text-xs">
                        <option value="">Seçin...</option>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code}</option>)}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">SORUMLU</label>
                      <input type="text" value={opForm.responsible} onChange={e => setOpForm({...opForm, responsible: e.target.value})}
                        placeholder="İsim" className="w-full px-2 py-2 border rounded-lg text-xs" />
                    </div>
                    <div className="w-20">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">SÜRE (dk)</label>
                      <input type="number" value={opForm.estimated_duration} onChange={e => setOpForm({...opForm, estimated_duration: e.target.value})}
                        placeholder="0" className="w-full px-2 py-2 border rounded-lg text-xs" />
                    </div>
                    <button onClick={handleAddOperation} disabled={!opForm.operation_name}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap">
                      + Ekle
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Enter ile hızlı ekle — operasyonlar sırayla numaralanır</p>
                </div>

                {/* Operasyon Şeması */}
                {operations.length > 0 ? (
                  <div className="space-y-0">
                    {operations.map((op, i) => {
                      const isLast = i === operations.length - 1
                      const isPending = op.status === 'pending'
                      const isActive = op.status === 'in_progress'
                      const isDone = op.status === 'completed'
                      return (
                        <div key={op.id}>
                          <div className={`flex gap-4 p-4 rounded-xl border-2 transition-all ${isActive ? 'border-blue-400 bg-blue-50 shadow-md' : isDone ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                            {/* Sıra numarası */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}>
                              {isDone ? '✓' : op.sira}
                            </div>
                            {/* Detay */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-900 text-sm">{op.operation_name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isDone ? 'bg-green-100 text-green-700' : isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {isDone ? 'Tamamlandı' : isActive ? 'Devam Ediyor' : 'Bekliyor'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                {op.machine_name && <span>🔧 {op.machine_name}</span>}
                                {op.responsible && <span>👤 {op.responsible}</span>}
                                {op.estimated_duration && <span>⏱ {op.estimated_duration} dk</span>}
                                {op.started_at && <span>▶ {new Date(op.started_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                                {op.completed_at && <span>✅ {new Date(op.completed_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                              </div>
                              {op.notes && <p className="text-xs text-gray-400 mt-1">{op.notes}</p>}
                            </div>
                            {/* Aksiyonlar */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isPending && <button onClick={() => handleOpStatus(op.id, 'in_progress')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold hover:bg-blue-200">Başlat</button>}
                              {isActive && <button onClick={() => handleOpStatus(op.id, 'completed')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold hover:bg-green-200">Bitir</button>}
                              <button onClick={() => handleDeleteOp(op.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          {/* Bağlantı çizgisi */}
                          {!isLast && (
                            <div className="flex items-center justify-center py-1">
                              <div className={`w-0.5 h-6 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`}></div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Henüz operasyon eklenmemiş</p>
                    <p className="text-sm mt-1">Operasyon ekleyerek üretim şemasını oluşturun</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Planı Düzenle' : 'Yeni Üretim Planı'}</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Ürün Adı *</label>
                    <input type="text" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="Ürün adı" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Ürün Kodu</label>
                    <input type="text" value={form.product_code} onChange={e => setForm({...form, product_code: e.target.value})} placeholder="Kod" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Proje</label>
                    <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">Seçin...</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tezgah</label>
                    <select value={form.machine_id} onChange={e => setForm({...form, machine_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">Seçin...</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} - {m.machine_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Miktar</label>
                    <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Öncelik</label>
                    <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Durum</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Başlangıç</label>
                    <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bitiş</label>
                    <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notlar</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Ek notlar..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50">İptal</button>
                  <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">{editingId ? 'Güncelle' : 'Oluştur'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

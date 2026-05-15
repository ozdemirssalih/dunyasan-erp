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
        await supabase.from('production_plans').update(payload).eq('id', editingId)
        alert('Plan güncellendi!')
      } else {
        await supabase.from('production_plans').insert(payload)
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

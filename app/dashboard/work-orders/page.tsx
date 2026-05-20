'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { FileText, Plus, X, Edit3, Trash2, Search, CheckCircle2, Clock, Eye, ChevronLeft, FolderOpen } from 'lucide-react'

interface WorkOrder {
  id: string; parca_no: string; parca_adi: string; project_name: string; iem_no: string; revizyon_no: string;
  fai: string; seri: string; delta_fai: string; customer_name: string; dosya_no: string; planlanan_miktar: number;
  teslim_tarihi: string; malzeme: string; alasim_spec: string; operasyon_no: string; is_merkezi: string;
  uygun_miktar: number; ret_miktar: number; uygunsuzluk_no: string; ekipman: string; baslama_tarihi: string;
  bitis_tarihi: string; dogrulama: boolean; dogrulayan: string; status: string; notes: string; created_at: string;
  project_id: string; customer_id: string;
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"

const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
  </div>
)

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Taslak', bg: 'bg-gray-100', text: 'text-gray-700' },
  active: { label: 'Aktif', bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { label: 'Uretimde', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Tamamlandi', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Iptal', bg: 'bg-red-100', text: 'text-red-700' },
}

export default function WorkOrdersPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState<WorkOrder | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectSearch, setProjectSearch] = useState('')

  const emptyForm = {
    parca_no: '', parca_adi: '', project_id: '', iem_no: '', revizyon_no: '', fai: '', seri: '', delta_fai: '',
    customer_id: '', dosya_no: '', planlanan_miktar: '', teslim_tarihi: '', malzeme: '', alasim_spec: '',
    operasyon_no: '', is_merkezi: '', uygun_miktar: '', ret_miktar: '', uygunsuzluk_no: '', ekipman: '',
    baslama_tarihi: '', bitis_tarihi: '', dogrulama: false, dogrulayan: '', status: 'draft', notes: ''
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [ordersRes, projRes, custRes] = await Promise.all([
        supabase.from('work_orders').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, project_name').eq('company_id', profile.company_id).order('project_name'),
        supabase.from('contacts').select('id, contact_name').eq('company_id', profile.company_id).eq('is_active', true).order('contact_name'),
      ])
      setOrders(ordersRes.data || [])
      setProjects(projRes.data || [])
      setCustomers(custRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!form.parca_adi || !companyId) return alert('Parca adi zorunludur!')
    const projectId = selectedProjectId || form.project_id
    if (!projectId) return alert('Proje secimi zorunludur!')
    try {
      const projectName = projects.find(p => p.id === projectId)?.project_name || ''
      const customerName = customers.find(c => c.id === form.customer_id)?.contact_name || ''
      const payload = {
        company_id: companyId, parca_no: form.parca_no || null, parca_adi: form.parca_adi,
        project_id: projectId, project_name: projectName,
        iem_no: form.iem_no || null, revizyon_no: form.revizyon_no || null,
        fai: form.fai || null, seri: form.seri || null, delta_fai: form.delta_fai || null,
        customer_id: form.customer_id || null, customer_name: customerName,
        dosya_no: form.dosya_no || null, planlanan_miktar: parseInt(form.planlanan_miktar as string) || 0,
        teslim_tarihi: form.teslim_tarihi || null, malzeme: form.malzeme || null,
        alasim_spec: form.alasim_spec || null, operasyon_no: form.operasyon_no || null,
        is_merkezi: form.is_merkezi || null, uygun_miktar: parseInt(form.uygun_miktar as string) || 0,
        ret_miktar: parseInt(form.ret_miktar as string) || 0, uygunsuzluk_no: form.uygunsuzluk_no || null,
        ekipman: form.ekipman || null, baslama_tarihi: form.baslama_tarihi || null,
        bitis_tarihi: form.bitis_tarihi || null, dogrulama: form.dogrulama,
        dogrulayan: form.dogrulayan || null, status: form.status, notes: form.notes || null,
      }
      if (editingId) {
        const { error } = await supabase.from('work_orders').update(payload).eq('id', editingId)
        if (error) return alert('Hata: ' + error.message)
        alert('Is emri guncellendi!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('work_orders').insert({ ...payload, created_by: user?.id })
        if (error) return alert('Hata: ' + error.message)
        alert('Is emri olusturuldu!')
      }
      setShowModal(false); setEditingId(null); setForm(emptyForm); init()
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleEdit = (wo: WorkOrder) => {
    setEditingId(wo.id)
    setForm({
      parca_no: wo.parca_no || '', parca_adi: wo.parca_adi || '', project_id: wo.project_id || '',
      iem_no: wo.iem_no || '', revizyon_no: wo.revizyon_no || '', fai: wo.fai || '', seri: wo.seri || '',
      delta_fai: wo.delta_fai || '', customer_id: wo.customer_id || '', dosya_no: wo.dosya_no || '',
      planlanan_miktar: wo.planlanan_miktar?.toString() || '', teslim_tarihi: wo.teslim_tarihi || '',
      malzeme: wo.malzeme || '', alasim_spec: wo.alasim_spec || '', operasyon_no: wo.operasyon_no || '',
      is_merkezi: wo.is_merkezi || '', uygun_miktar: wo.uygun_miktar?.toString() || '',
      ret_miktar: wo.ret_miktar?.toString() || '', uygunsuzluk_no: wo.uygunsuzluk_no || '',
      ekipman: wo.ekipman || '', baslama_tarihi: wo.baslama_tarihi || '', bitis_tarihi: wo.bitis_tarihi || '',
      dogrulama: wo.dogrulama || false, dogrulayan: wo.dogrulayan || '', status: wo.status || 'draft', notes: wo.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu is emrini silmek istediginizden emin misiniz?')) return
    await supabase.from('work_orders').delete().eq('id', id)
    init()
  }

  // Project-based grouping
  const getProjectOrders = (projectId: string) => orders.filter(o => o.project_id === projectId)
  const getProjectStats = (projectId: string) => {
    const pOrders = getProjectOrders(projectId)
    return {
      total: pOrders.length,
      completed: pOrders.filter(o => o.status === 'completed').length,
      inProgress: pOrders.filter(o => o.status === 'in_progress').length,
      active: pOrders.filter(o => o.status === 'active').length,
    }
  }

  // Selected project's orders with filters
  const projectOrders = selectedProjectId ? getProjectOrders(selectedProjectId) : []
  const filtered = projectOrders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      return [o.parca_no, o.parca_adi, o.iem_no, o.customer_name, o.malzeme, o.operasyon_no]
        .some(f => f?.toLowerCase().includes(t))
    }
    return true
  })

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  // Filter projects by search
  const filteredProjects = projects.filter(p =>
    !projectSearch || p.project_name?.toLowerCase().includes(projectSearch.toLowerCase())
  )

  if (loading) return <PermissionGuard module="production" permission="view"><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></PermissionGuard>

  return (
    <PermissionGuard module="production" permission="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><FileText className="w-8 h-8 text-blue-600" /> Is Emirleri</h2>
            <p className="text-gray-600">Proje bazli is emirlerini olusturun ve takip edin</p>
          </div>
        </div>

        {/* Genel Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl shadow-sm border p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{orders.filter(o => o.status === k).length}</p>
              <p className={`text-xs font-semibold ${v.text}`}>{v.label}</p>
            </div>
          ))}
        </div>

        {!selectedProjectId ? (
          /* ===== PROJE LISTESI ===== */
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Proje ara..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <p className="text-sm text-gray-500">{projects.length} proje</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const stats = getProjectStats(project.id)
                const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                return (
                  <div key={project.id}
                    onClick={() => { setSelectedProjectId(project.id); setSearchTerm(''); setFilterStatus('all') }}
                    className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <FolderOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{project.project_name}</h3>
                          <p className="text-xs text-gray-500">{stats.total} is emri</p>
                        </div>
                      </div>
                    </div>

                    {stats.total > 0 ? (
                      <>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="flex gap-3 text-xs">
                          {stats.active > 0 && <span className="text-blue-600 font-semibold">{stats.active} Aktif</span>}
                          {stats.inProgress > 0 && <span className="text-yellow-600 font-semibold">{stats.inProgress} Uretimde</span>}
                          {stats.completed > 0 && <span className="text-green-600 font-semibold">{stats.completed} Tamamlandi</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Henuz is emri yok</p>
                    )}
                  </div>
                )
              })}
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {projectSearch ? 'Proje bulunamadi' : 'Henuz proje olusturulmamis'}
              </div>
            )}
          </div>
        ) : (
          /* ===== SECILI PROJENIN IS EMIRLERI ===== */
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedProjectId(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedProject?.project_name}</h3>
                  <p className="text-xs text-gray-500">{projectOrders.length} is emri</p>
                </div>
              </div>
              <button onClick={() => { setEditingId(null); setForm({ ...emptyForm, project_id: selectedProjectId }); setShowModal(true) }}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
                <Plus className="w-4 h-4" /> Yeni Is Emri
              </button>
            </div>

            {/* Filtreler */}
            <div className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Parca no, ad, IEM no, musteri ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="all">Tum Durumlar</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Proje bazli stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl shadow-sm border p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{projectOrders.filter(o => o.status === k).length}</p>
                  <p className={`text-xs font-semibold ${v.text}`}>{v.label}</p>
                </div>
              ))}
            </div>

            {/* Liste */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">IEM No</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Parca No</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Parca Adi</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Musteri</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Miktar</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Uygun/Ret</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Teslim</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Durum</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Dogrulama</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Islem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(wo => {
                      const st = STATUS_MAP[wo.status] || STATUS_MAP.draft
                      return (
                        <tr key={wo.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 font-mono font-bold text-blue-700">{wo.iem_no || '-'}</td>
                          <td className="px-3 py-3 font-mono text-gray-600">{wo.parca_no || '-'}</td>
                          <td className="px-3 py-3 font-semibold text-gray-900">{wo.parca_adi}</td>
                          <td className="px-3 py-3 text-gray-600">{wo.customer_name || '-'}</td>
                          <td className="px-3 py-3 text-center font-bold">{wo.planlanan_miktar}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-green-600 font-semibold">{wo.uygun_miktar}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-red-600 font-semibold">{wo.ret_miktar}</span>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{wo.teslim_tarihi ? new Date(wo.teslim_tarihi).toLocaleDateString('tr-TR') : '-'}</td>
                          <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                          <td className="px-3 py-3 text-center">{wo.dogrulama ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <Clock className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => setShowDetail(wo)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => handleEdit(wo)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(wo.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Bu projede is emri bulunamadi</div>}
              </div>
            </div>
          </div>
        )}

        {/* Detay Modal */}
        {showDetail && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Is Emri Detayi -- {showDetail.iem_no || showDetail.parca_adi}</h3>
                <button onClick={() => setShowDetail(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {[
                  ['Parca No', showDetail.parca_no], ['Parca Adi', showDetail.parca_adi], ['Proje', showDetail.project_name],
                  ['IEM No', showDetail.iem_no], ['Revizyon No', showDetail.revizyon_no], ['FAI', showDetail.fai],
                  ['Seri', showDetail.seri], ['Delta FAI', showDetail.delta_fai], ['Musteri', showDetail.customer_name],
                  ['Dosya No', showDetail.dosya_no], ['Planlanan Miktar', showDetail.planlanan_miktar], ['Teslim Tarihi', showDetail.teslim_tarihi ? new Date(showDetail.teslim_tarihi).toLocaleDateString('tr-TR') : '-'],
                  ['Malzeme', showDetail.malzeme], ['Alasim & Spec', showDetail.alasim_spec], ['Operasyon No', showDetail.operasyon_no],
                  ['Is Merkezi', showDetail.is_merkezi], ['Uygun Miktar', showDetail.uygun_miktar], ['Ret Miktar', showDetail.ret_miktar],
                  ['Uygunsuzluk No', showDetail.uygunsuzluk_no], ['Ekipman', showDetail.ekipman],
                  ['Baslama', showDetail.baslama_tarihi ? new Date(showDetail.baslama_tarihi).toLocaleDateString('tr-TR') : '-'],
                  ['Bitis', showDetail.bitis_tarihi ? new Date(showDetail.bitis_tarihi).toLocaleDateString('tr-TR') : '-'],
                  ['Dogrulama', showDetail.dogrulama ? 'Dogrulandi' : 'Bekliyor'], ['Dogrulayan', showDetail.dogrulayan],
                ].map(([label, value], i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="font-semibold text-gray-900">{value || '-'}</p>
                  </div>
                ))}
              </div>
              {showDetail.notes && <div className="mt-4 bg-yellow-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-0.5">Notlar</p><p className="text-sm text-gray-800">{showDetail.notes}</p></div>}
            </div>
          </div>
        )}

        {/* Olustur/Duzenle Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingId ? 'Is Emri Duzenle' : 'Yeni Is Emri'}
                  {selectedProject && <span className="text-blue-600 ml-2">- {selectedProject.project_name}</span>}
                </h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-5">
                {/* Parca Bilgileri */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Parca Bilgileri</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <F label="Parca No"><input type="text" value={form.parca_no} onChange={e => setForm({...form, parca_no: e.target.value})} className={inp} /></F>
                    <F label="Parca Adi *"><input type="text" value={form.parca_adi} onChange={e => setForm({...form, parca_adi: e.target.value})} className={inp} /></F>
                    <F label="IEM No"><input type="text" value={form.iem_no} onChange={e => setForm({...form, iem_no: e.target.value})} className={inp} /></F>
                    <F label="Revizyon No"><input type="text" value={form.revizyon_no} onChange={e => setForm({...form, revizyon_no: e.target.value})} className={inp} /></F>
                    <F label="FAI"><input type="text" value={form.fai} onChange={e => setForm({...form, fai: e.target.value})} className={inp} /></F>
                    <F label="Seri"><input type="text" value={form.seri} onChange={e => setForm({...form, seri: e.target.value})} className={inp} /></F>
                    <F label="Delta FAI"><input type="text" value={form.delta_fai} onChange={e => setForm({...form, delta_fai: e.target.value})} className={inp} /></F>
                    <F label="Dosya No"><input type="text" value={form.dosya_no} onChange={e => setForm({...form, dosya_no: e.target.value})} className={inp} /></F>
                  </div>
                </div>

                {/* Proje & Musteri */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Proje & Musteri</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <F label="Proje">
                      <select value={form.project_id || selectedProjectId || ''} onChange={e => setForm({...form, project_id: e.target.value})} className={inp} disabled={!!selectedProjectId}>
                        <option value="">Secin...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </F>
                    <F label="Musteri"><select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className={inp}><option value="">Secin...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.contact_name}</option>)}</select></F>
                    <F label="Planlanan Miktar"><input type="number" value={form.planlanan_miktar} onChange={e => setForm({...form, planlanan_miktar: e.target.value})} className={inp} /></F>
                  </div>
                </div>

                {/* Malzeme */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Malzeme & Teknik</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <F label="Malzeme"><input type="text" value={form.malzeme} onChange={e => setForm({...form, malzeme: e.target.value})} placeholder="Or: Al 7075-T7351" className={inp} /></F>
                    <F label="Alasim & Spec"><input type="text" value={form.alasim_spec} onChange={e => setForm({...form, alasim_spec: e.target.value})} placeholder="Or: AMS-QQ-A-250/12" className={inp} /></F>
                    <F label="Ekipman"><input type="text" value={form.ekipman} onChange={e => setForm({...form, ekipman: e.target.value})} className={inp} /></F>
                  </div>
                </div>

                {/* Operasyon */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Operasyon & Uretim</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <F label="Operasyon No"><input type="text" value={form.operasyon_no} onChange={e => setForm({...form, operasyon_no: e.target.value})} className={inp} /></F>
                    <F label="Is Merkezi"><input type="text" value={form.is_merkezi} onChange={e => setForm({...form, is_merkezi: e.target.value})} className={inp} /></F>
                    <F label="Uygun Miktar"><input type="number" value={form.uygun_miktar} onChange={e => setForm({...form, uygun_miktar: e.target.value})} className={inp} /></F>
                    <F label="Ret Miktar"><input type="number" value={form.ret_miktar} onChange={e => setForm({...form, ret_miktar: e.target.value})} className={inp} /></F>
                    <F label="Uygunsuzluk No"><input type="text" value={form.uygunsuzluk_no} onChange={e => setForm({...form, uygunsuzluk_no: e.target.value})} className={inp} /></F>
                  </div>
                </div>

                {/* Tarihler */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Tarihler & Durum</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <F label="Teslim Tarihi"><input type="date" value={form.teslim_tarihi} onChange={e => setForm({...form, teslim_tarihi: e.target.value})} className={inp} /></F>
                    <F label="Baslama Tarihi"><input type="date" value={form.baslama_tarihi} onChange={e => setForm({...form, baslama_tarihi: e.target.value})} className={inp} /></F>
                    <F label="Bitis Tarihi"><input type="date" value={form.bitis_tarihi} onChange={e => setForm({...form, bitis_tarihi: e.target.value})} className={inp} /></F>
                    <F label="Durum"><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>{Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></F>
                  </div>
                </div>

                {/* Dogrulama */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Dogrulama</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={form.dogrulama} onChange={e => setForm({...form, dogrulama: e.target.checked})} className="w-5 h-5 text-green-600 rounded" />
                      <span className="text-sm font-medium text-gray-700">Dogrulandi</span>
                    </div>
                    <F label="Dogrulayan"><input type="text" value={form.dogrulayan} onChange={e => setForm({...form, dogrulayan: e.target.value})} placeholder="Isim" className={inp} /></F>
                  </div>
                </div>

                {/* Notlar */}
                <F label="Notlar"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Ek notlar..." className={inp} /></F>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3 rounded-b-2xl">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100">Iptal</button>
                <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">{editingId ? 'Guncelle' : 'Olustur'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

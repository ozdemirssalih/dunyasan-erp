'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { TrendingUp, Plus, Calendar, Factory, Filter, Edit, Trash2 } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'

interface DailyProduction {
  id: string
  company_id: string
  project_id: string
  machine_id: string
  production_date: string
  capacity_target: number
  actual_production: number
  defect_count: number
  efficiency_rate: number
  shift?: string
  notes?: string
  created_at: string
  machine?: {
    id: string
    machine_code: string
    machine_name: string
  }
  project?: {
    id: string
    project_code: string
    project_name: string
  }
}

interface Project {
  id: string
  project_code: string
  project_name: string
}

interface Machine {
  id: string
  machine_code: string
  machine_name: string
}

export default function DailyProductionPage() {
  const [productions, setProductions] = useState<DailyProduction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [allMachines, setAllMachines] = useState<Machine[]>([]) // Tüm tezgahlar (filtre için)
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filters
  const [filterProject, setFilterProject] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    project_id: '',
    machine_id: '',
    production_date: new Date().toISOString().split('T')[0],
    capacity_target: '',
    actual_production: '',
    defect_count: '',
    shift: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)

      // Load projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .eq('company_id', fetchedCompanyId)
        .order('project_name', { ascending: true })

      setProjects(projectsData || [])

      // Load machines (tüm tezgahlar - filtre için)
      const { data: machinesData } = await supabase
        .from('machines')
        .select('id, machine_code, machine_name')
        .eq('company_id', fetchedCompanyId)
        .order('machine_name', { ascending: true })

      setAllMachines(machinesData || [])
      setMachines([]) // Başlangıçta boş, proje seçilince dolacak

      // Load production records
      await loadProductions(fetchedCompanyId)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectMachines = async (projectId: string) => {
    if (!projectId) {
      setMachines([])
      return
    }

    try {
      // Proje için ara tezgahları yükle (project_machines)
      const { data: projectMachinesData } = await supabase
        .from('project_machines')
        .select('machine_id, machine:machines(id, machine_code, machine_name)')
        .eq('project_id', projectId)
        .order('sequence_order')

      console.log('✅ Project machines loaded:', projectMachinesData)

      // machine bilgilerini çıkar
      const projectMachines = (projectMachinesData || [])
        .map(pm => pm.machine)
        .filter(m => m !== null) as Machine[]

      setMachines(projectMachines)
    } catch (error) {
      console.error('Error loading project machines:', error)
      setMachines([])
    }
  }

  const loadProductions = async (cId?: string) => {
    const finalCompanyId = cId || companyId
    if (!finalCompanyId) return

    try {
      let query = supabase
        .from('machine_daily_production')
        .select(`
          *,
          machine:machines(id, machine_code, machine_name),
          project:projects(id, project_code, project_name)
        `)
        .eq('company_id', finalCompanyId)

      // Apply filters
      if (filterProject) {
        query = query.eq('project_id', filterProject)
      }
      if (filterMachine) {
        query = query.eq('machine_id', filterMachine)
      }
      if (filterStartDate) {
        query = query.gte('production_date', filterStartDate)
      }
      if (filterEndDate) {
        query = query.lte('production_date', filterEndDate)
      }

      const { data } = await query.order('production_date', { ascending: false })

      setProductions(data || [])
    } catch (error) {
      console.error('Error loading productions:', error)
    }
  }

  const handleSubmit = async () => {
    if (!formData.project_id || !formData.machine_id || !formData.production_date || !formData.capacity_target || !formData.actual_production) {
      alert('Lütfen gerekli tüm alanları doldurun!')
      return
    }

    try {
      const productionData = {
        company_id: companyId,
        project_id: formData.project_id,
        machine_id: formData.machine_id,
        production_date: formData.production_date,
        capacity_target: parseInt(formData.capacity_target),
        actual_production: parseInt(formData.actual_production),
        defect_count: formData.defect_count ? parseInt(formData.defect_count) : 0,
        shift: formData.shift || null,
        notes: formData.notes || null
      }

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('machine_daily_production')
          .update(productionData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('machine_daily_production')
          .insert(productionData)

        if (error) throw error
      }

      // Reset and reload
      resetForm()
      await loadProductions()
    } catch (error: any) {
      console.error('Error saving production:', error)
      alert(`Hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleEdit = (production: DailyProduction) => {
    setEditingId(production.id)
    setFormData({
      project_id: production.project_id,
      machine_id: production.machine_id,
      production_date: production.production_date,
      capacity_target: production.capacity_target.toString(),
      actual_production: production.actual_production.toString(),
      defect_count: production.defect_count.toString(),
      shift: production.shift || '',
      notes: production.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu üretim kaydını silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('machine_daily_production')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadProductions()
    } catch (error: any) {
      console.error('Error deleting production:', error)
      alert(`Silme hatası!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const resetForm = () => {
    setFormData({
      project_id: '',
      machine_id: '',
      production_date: new Date().toISOString().split('T')[0],
      capacity_target: '',
      actual_production: '',
      defect_count: '',
      shift: '',
      notes: ''
    })
    setEditingId(null)
    setShowModal(false)
  }

  // Calculate statistics
  const totalProduction = productions.reduce((sum, p) => sum + p.actual_production, 0)
  const totalDefects = productions.reduce((sum, p) => sum + p.defect_count, 0)
  const avgEfficiency = productions.length > 0
    ? productions.reduce((sum, p) => sum + p.efficiency_rate, 0) / productions.length
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <PermissionGuard module="production" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Günlük Üretim Takibi</h2>
            <p className="text-gray-600">Tezgah bazlı günlük üretim performansı ve verimlilik takibi</p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Yeni Kayıt</span>
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
            <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
            <div className="text-3xl font-bold text-gray-900">{totalProduction.toLocaleString()}</div>
            <div className="text-gray-600">Toplam Üretim</div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 border-l-4 border-red-500">
            <Factory className="w-8 h-8 text-red-600 mb-2" />
            <div className="text-3xl font-bold text-gray-900">{totalDefects.toLocaleString()}</div>
            <div className="text-gray-600">Toplam Fire</div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
            <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
            <div className="text-3xl font-bold text-gray-900">{avgEfficiency.toFixed(1)}%</div>
            <div className="text-gray-600">Ortalama Verimlilik</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-bold text-gray-800">Filtreler</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Proje</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Tüm Projeler</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tezgah</label>
              <select
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Tüm Tezgahlar</option>
                {allMachines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.machine_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Başlangıç Tarihi</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bitiş Tarihi</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => loadProductions()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Filtrele
            </button>
          </div>
        </div>

        {/* Production Records */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Calendar className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-bold text-gray-800">Üretim Kayıtları</h3>
          </div>

          {productions.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {productions.map((production) => (
                <div key={production.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{production.machine?.machine_name}</div>
                      <div className="text-sm text-gray-600">{production.machine?.machine_code}</div>
                      <div className="text-sm text-blue-600 font-semibold mt-1">
                        {production.project?.project_name} ({production.project?.project_code})
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(production.production_date).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {production.shift && ` - ${production.shift}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          production.efficiency_rate >= 80 ? 'text-green-600' :
                          production.efficiency_rate >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {production.efficiency_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">Verimlilik</div>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => handleEdit(production)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(production.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Hedef</div>
                      <div className="text-sm font-bold text-gray-900">{production.capacity_target}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Üretilen</div>
                      <div className="text-sm font-bold text-blue-600">{production.actual_production}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Fire</div>
                      <div className="text-sm font-bold text-red-600">{production.defect_count}</div>
                    </div>
                  </div>

                  {production.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600 italic">{production.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-24 h-24 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Henüz üretim kaydı yok</p>
              <p className="text-gray-400 text-sm mb-6">İlk günlük üretim kaydınızı ekleyerek başlayın</p>
              <button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Yeni Kayıt Ekle</span>
              </button>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">
                  {editingId ? 'Üretim Kaydını Düzenle' : 'Yeni Üretim Kaydı'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Project and Machine */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Proje <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => {
                        const newProjectId = e.target.value
                        setFormData({ ...formData, project_id: newProjectId, machine_id: '' })
                        loadProjectMachines(newProjectId)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Proje Seçiniz</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                    {formData.project_id && machines.length === 0 && (
                      <p className="text-xs text-orange-600 mt-1">⚠️ Bu projeye henüz ara tezgah atanmamış</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tezgah <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.machine_id}
                      onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Tezgah Seçiniz</option>
                      {machines.map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.machine_name} ({machine.machine_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Production Date and Shift */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Üretim Tarihi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.production_date}
                      onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Vardiya
                    </label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Vardiya Seçiniz</option>
                      <option value="Gündüz">Gündüz</option>
                      <option value="Gece">Gece</option>
                      <option value="1. Vardiya">1. Vardiya</option>
                      <option value="2. Vardiya">2. Vardiya</option>
                      <option value="3. Vardiya">3. Vardiya</option>
                    </select>
                  </div>
                </div>

                {/* Capacity, Production, Defects */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kapasite Hedefi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.capacity_target}
                      onChange={(e) => setFormData({ ...formData, capacity_target: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Örn: 1000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gerçekleşen Üretim <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.actual_production}
                      onChange={(e) => setFormData({ ...formData, actual_production: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Örn: 950"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fire Sayısı
                    </label>
                    <input
                      type="number"
                      value={formData.defect_count}
                      onChange={(e) => setFormData({ ...formData, defect_count: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Örn: 10"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notlar
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Ek notlar veya açıklamalar..."
                  />
                </div>

                {/* Efficiency Preview */}
                {formData.capacity_target && formData.actual_production && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Verimlilik Önizlemesi:</div>
                    <div className={`text-3xl font-bold ${
                      (parseInt(formData.actual_production) / parseInt(formData.capacity_target) * 100) >= 80 ? 'text-green-600' :
                      (parseInt(formData.actual_production) / parseInt(formData.capacity_target) * 100) >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {((parseInt(formData.actual_production) / parseInt(formData.capacity_target)) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={!formData.project_id || !formData.machine_id || !formData.production_date || !formData.capacity_target || !formData.actual_production}
                >
                  {editingId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { Factory, TrendingUp, Clock, Package, Activity, Settings, Wrench, AlertCircle, FolderKanban, Eye } from 'lucide-react'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  machine_type: string | null
  model: string | null
  status: 'active' | 'maintenance' | 'offline'
  daily_capacity: number | null
  efficiency_rate: number
  working_hours: number
  project_id?: string | null
  project?: { project_name: string } | null
  created_at: string
  production_count?: number
  material_assignments_count?: number
  last_production_date?: string
  calculated_efficiency?: number
  total_given?: number
  total_produced?: number
  total_defects?: number
  assigned_project?: { project_name: string } | null
}

export default function MachinesPage() {
  const router = useRouter()
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])

  const [formData, setFormData] = useState<{
    machine_code: string
    machine_name: string
    machine_type: string
    model: string
    status: 'active' | 'maintenance' | 'offline'
    daily_capacity: number
    efficiency_rate: number
    working_hours: number
    project_id: string
  }>({
    machine_code: '',
    machine_name: '',
    machine_type: '',
    model: '',
    status: 'active',
    daily_capacity: 0,
    efficiency_rate: 0,
    working_hours: 0,
    project_id: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadMachines()
    loadProjects()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('machines_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
        loadMachines()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      const { data } = await supabase
        .from('projects')
        .select('id, project_name, project_code, status')
        .eq('company_id', profile.company_id)
        .in('status', ['planning', 'in_progress'])
        .order('project_name', { ascending: true })

      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadMachines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      if (!finalCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          await supabase
            .from('profiles')
            .update({ company_id: finalCompanyId })
            .eq('id', user.id)
        } else {
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            await supabase
              .from('profiles')
              .update({ company_id: finalCompanyId })
              .eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) {
        console.error('No company found')
        setLoading(false)
        return
      }

      setCompanyId(finalCompanyId)

      const { data, error } = await supabase
        .from('machines')
        .select('*, project:projects(project_name)')
        .eq('company_id', finalCompanyId)
        .order('machine_code', { ascending: true })

      if (error) throw error

      // Her tezgah için günlük üretim istatistiklerini çek
      const machinesWithStats = await Promise.all(
        (data || []).map(async (machine) => {
          // Günlük üretim kayıtları (machine_daily_production)
          const { data: dailyProductions } = await supabase
            .from('machine_daily_production')
            .select('actual_production, capacity_target, defect_count, production_date, efficiency_rate')
            .eq('machine_id', machine.id)
            .order('production_date', { ascending: false })

          // Üretim sayısı (günlük kayıt sayısı)
          const productionCount = dailyProductions?.length || 0

          // Son üretim tarihi
          const lastProductionDate = dailyProductions?.[0]?.production_date || null

          // Toplam üretim ve hedef
          const totalProduced = dailyProductions?.reduce((sum, item) => sum + (item.actual_production || 0), 0) || 0
          const totalTarget = dailyProductions?.reduce((sum, item) => sum + (item.capacity_target || 0), 0) || 0
          const totalDefects = dailyProductions?.reduce((sum, item) => sum + (item.defect_count || 0), 0) || 0

          // Verimlilik hesaplama
          // Verimlilik = (Toplam Üretim / Toplam Hedef) × 100
          const calculatedEfficiency = totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 0

          // Alternatif: Ortalama verimlilik (günlük kayıtlarda varsa)
          const avgEfficiencyFromRecords = dailyProductions && dailyProductions.length > 0
            ? dailyProductions.reduce((sum, item) => sum + (item.efficiency_rate || 0), 0) / dailyProductions.length
            : 0

          // En yüksek verimliliği kullan
          const finalEfficiency = Math.max(calculatedEfficiency, avgEfficiencyFromRecords)

          // Proje ataması (project_machines tablosundan)
          const { data: machineAssignment } = await supabase
            .from('project_machines')
            .select('project_id, project:projects(project_name)')
            .eq('machine_id', machine.id)
            .maybeSingle()

          return {
            ...machine,
            production_count: productionCount,
            material_assignments_count: 0,
            last_production_date: lastProductionDate,
            total_given: totalTarget,
            total_produced: totalProduced,
            total_defects: totalDefects,
            calculated_efficiency: finalEfficiency,
            assigned_project: machineAssignment?.project || null
          }
        })
      )

      setMachines(machinesWithStats)
    } catch (error) {
      console.error('Error loading machines:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!companyId) return

    setIsSubmitting(true)
    try {
      if (editingMachine) {
        // Update existing machine
        const { error } = await supabase
          .from('machines')
          .update({
            machine_code: formData.machine_code,
            machine_name: formData.machine_name,
            machine_type: formData.machine_type,
            model: formData.model,
            status: formData.status,
            daily_capacity: formData.daily_capacity,
            efficiency_rate: formData.efficiency_rate,
            working_hours: formData.working_hours,
            project_id: formData.project_id || null,
          })
          .eq('id', editingMachine.id)

        if (error) throw error
      } else {
        // Create new machine
        const { error } = await supabase
          .from('machines')
          .insert({
            company_id: companyId,
            machine_code: formData.machine_code,
            machine_name: formData.machine_name,
            machine_type: formData.machine_type,
            model: formData.model,
            status: formData.status,
            daily_capacity: formData.daily_capacity,
            efficiency_rate: formData.efficiency_rate,
            working_hours: formData.working_hours,
            project_id: formData.project_id || null,
          })

        if (error) throw error
      }

      // Reset form and close modal
      setFormData({
        machine_code: '',
        machine_name: '',
        machine_type: '',
        model: '',
        status: 'active',
        daily_capacity: 0,
        efficiency_rate: 0,
        working_hours: 0,
        project_id: '',
      })
      setEditingMachine(null)
      setShowModal(false)
      loadMachines()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine)
    setFormData({
      machine_code: machine.machine_code,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type || '',
      model: machine.model || '',
      status: machine.status as 'active' | 'maintenance' | 'offline',
      daily_capacity: machine.daily_capacity || 0,
      efficiency_rate: machine.efficiency_rate,
      working_hours: machine.working_hours,
      project_id: machine.project_id || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu tezgahı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadMachines()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      maintenance: 'bg-orange-100 text-orange-700',
      offline: 'bg-red-100 text-red-700',
    }
    const labels = {
      active: 'Çalışıyor',
      maintenance: 'Bakımda',
      offline: 'Çalışmıyor',
    }
    const icons = {
      active: <Activity className="w-4 h-4" />,
      maintenance: <Wrench className="w-4 h-4" />,
      offline: <AlertCircle className="w-4 h-4" />,
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getEfficiencyColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-600'
    if (rate >= 60) return 'bg-blue-600'
    if (rate >= 40) return 'bg-orange-600'
    return 'bg-red-600'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  const activeMachines = machines.filter(m => m.status === 'active').length
  const totalCapacity = machines.reduce((sum, m) => sum + (m.daily_capacity || 0), 0)
  const avgEfficiency = machines.length > 0
    ? Math.round(machines.reduce((sum, m) => sum + m.efficiency_rate, 0) / machines.length)
    : 0

  return (
    <PermissionGuard module="machines" permission="view">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Tezgah Yönetimi</h2>
          <p className="text-gray-600">CNC tezgahlarını yönetin ve izleyin</p>
        </div>
        <button
          onClick={() => {
            setEditingMachine(null)
            setFormData({
              machine_code: '',
              machine_name: '',
              machine_type: '',
              model: '',
              status: 'active',
              daily_capacity: 0,
              efficiency_rate: 0,
              working_hours: 0,
              project_id: '',
            })
            setShowModal(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
        >
          <Factory className="w-5 h-5" />
          Yeni Tezgah
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Aktif Tezgahlar</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{activeMachines} / {machines.length}</p>
            </div>
            <Activity className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {machines.length > 0 ? (
          machines.map((machine) => (
            <div key={machine.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              {/* Machine Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{machine.machine_code}</h3>
                  <p className="text-sm text-gray-600">{machine.machine_name}</p>
                </div>
                {getStatusBadge(machine.status)}
              </div>

              {/* Machine Details */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    Tip:
                  </span>
                  <span className="font-semibold text-gray-800">{machine.machine_type || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-semibold text-gray-800">{machine.model || '-'}</span>
                </div>
                {(machine.project || machine.assigned_project) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      Atanan Proje:
                    </span>
                    <span className="font-semibold text-blue-600">{machine.assigned_project?.project_name || machine.project?.project_name || '-'}</span>
                  </div>
                )}
              </div>

              {/* Production Stats */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 space-y-2">
                <p className="text-xs font-semibold text-blue-900 mb-2">Üretim İstatistikleri (Günlük Kayıtlar)</p>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Günlük Kayıt:</span>
                  <span className="font-bold text-blue-900">{machine.production_count || 0} gün</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Toplam Üretim:</span>
                  <span className="font-bold text-blue-900">{machine.total_produced?.toFixed(0) || 0} adet</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Toplam Hedef:</span>
                  <span className="font-bold text-blue-900">{machine.total_given?.toFixed(0) || 0} adet</span>
                </div>
                {machine.last_production_date && (
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-700">Son Üretim:</span>
                    <span className="font-bold text-blue-900">
                      {new Date(machine.last_production_date).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Efficiency Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Verimlilik Oranı</span>
                  <span className="text-sm font-semibold text-gray-800">%{machine.calculated_efficiency?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${getEfficiencyColor(machine.calculated_efficiency || 0)}`}
                    style={{ width: `${Math.min(machine.calculated_efficiency || 0, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Hedef: {machine.total_given?.toFixed(0) || '0'} adet</span>
                  <span>Üretim: {machine.total_produced?.toFixed(0) || '0'} adet</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => router.push(`/dashboard/machines/${machine.id}`)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Detayları Görüntüle
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(machine)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDelete(machine.id)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            Henüz tezgah bulunmuyor. Yeni tezgah ekleyin.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingMachine ? 'Tezgahı Düzenle' : 'Yeni Tezgah'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Kodu</label>
                <input
                  type="text"
                  value={formData.machine_code}
                  onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="T-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Adı</label>
                <input
                  type="text"
                  value={formData.machine_name}
                  onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="CNC Torna 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Tipi</label>
                <input
                  type="text"
                  value={formData.machine_type}
                  onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="CNC Torna 3 Eksen"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Fanuc 0i-TF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">Çalışıyor</option>
                  <option value="maintenance">Bakımda</option>
                  <option value="offline">Çalışmıyor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Çalıştığı Proje</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Proje Seçiniz (Opsiyonel)</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.project_name} {project.project_code ? `(${project.project_code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Bu tezgah hangi proje için çalışıyor?</p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'İşlem yapılıyor...' : (editingMachine ? 'Güncelle' : 'Oluştur')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingMachine(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { FolderKanban, Plus, Eye, Trash2 } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'

interface Project {
  id: string
  project_name: string
  project_code?: string
  status: string
  start_date: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    project_name: '',
    project_code: '',
    description: '',
    status: 'planning',
    start_date: '',
    target_quantity: '',
    unit: 'adet'
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Machine selection
  const [machines, setMachines] = useState<any[]>([])
  const [processMachines, setProcessMachines] = useState<{
    machine_id: string
    sequence_order: number
    daily_capacity_target: string
    notes: string
  }[]>([])

  useEffect(() => {
    loadProjects()
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

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)

      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('created_at', { ascending: false })

      setProjects(data || [])

      // Load machines for selection
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('machine_name', { ascending: true })

      setMachines(machinesData || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!formData.project_name || !companyId) {
      alert('Proje adı zorunludur!')
      return
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Kullanıcı oturumu bulunamadı!')
        return
      }

      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          company_id: companyId,
          created_by: user.id,
          project_name: formData.project_name,
          project_code: formData.project_code || null,
          description: formData.description || null,
          status: formData.status,
          start_date: formData.start_date || new Date().toISOString().split('T')[0],
          target_quantity: formData.target_quantity ? parseFloat(formData.target_quantity) : null,
          unit: formData.unit
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      // Insert process machines if any
      if (processMachines.length > 0 && newProject) {
        const processInserts = processMachines.map((pm) => ({
          company_id: companyId,
          project_id: newProject.id,
          machine_id: pm.machine_id,
          sequence_order: pm.sequence_order,
          daily_capacity_target: pm.daily_capacity_target ? parseInt(pm.daily_capacity_target) : null,
          notes: pm.notes || null
        }))

        const { error: processError } = await supabase
          .from('project_machines')
          .insert(processInserts)

        if (processError) {
          console.error('❌ Error inserting process machines:', processError)
          // Continue anyway - project is created
        }
      }

      // Reset form and close modal
      setFormData({
        project_name: '',
        project_code: '',
        description: '',
        status: 'planning',
        start_date: '',
        target_quantity: '',
        unit: 'adet'
      })
      setProcessMachines([])
      setShowModal(false)

      // Reload projects
      await loadProjects()
    } catch (error: any) {
      console.error('❌ Error creating project:', error)
      alert(`Proje oluşturulurken hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleAddProcessMachine = () => {
    setProcessMachines([
      ...processMachines,
      {
        machine_id: '',
        sequence_order: processMachines.length + 1,
        daily_capacity_target: '',
        notes: ''
      }
    ])
  }

  const handleRemoveProcessMachine = (index: number) => {
    const newProcessMachines = processMachines.filter((_, i) => i !== index)
    // Re-sequence
    newProcessMachines.forEach((pm, i) => {
      pm.sequence_order = i + 1
    })
    setProcessMachines(newProcessMachines)
  }

  const handleUpdateProcessMachine = (index: number, field: string, value: any) => {
    const newProcessMachines = [...processMachines]
    newProcessMachines[index] = { ...newProcessMachines[index], [field]: value }
    setProcessMachines(newProcessMachines)
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`"${projectName}" projesini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve projeye ait tüm parçalar da silinecektir!`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      alert('✅ Proje başarıyla silindi!')
      await loadProjects()
    } catch (error: any) {
      console.error('Error deleting project:', error)
      alert(`❌ Proje silinirken hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <PermissionGuard module="projects" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Proje Yönetimi</h2>
          <p className="text-gray-600">Projelerinizi yönetin ve takip edin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Yeni Proje</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{project.project_name}</h3>
                <p className="text-sm text-gray-600">{project.project_code || 'Kod yok'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                project.status === 'completed' ? 'bg-green-100 text-green-800' :
                project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status === 'planning' ? 'Planlama' :
                 project.status === 'in_progress' ? 'Devam Ediyor' :
                 project.status === 'completed' ? 'Tamamlandı' :
                 project.status === 'on_hold' ? 'Beklemede' : project.status}
              </span>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Detay
              </Link>
              <button
                onClick={() => handleDeleteProject(project.id, project.project_name)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Kaldır
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Yeni Proje Oluştur</h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({
                    project_name: '',
                    project_code: '',
                    description: '',
                    status: 'planning',
                    start_date: '',
                    target_quantity: '',
                    unit: 'adet'
                  })
                  setProcessMachines([])
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Proje Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: Savunma Projesi A"
                />
              </div>

              {/* Project Code */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Proje Kodu
                </label>
                <input
                  type="text"
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: PRJ-2024-001"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Proje hakkında detaylı bilgi..."
                />
              </div>

              {/* Status and Start Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Durum
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="planning">Planlama</option>
                    <option value="in_progress">Devam Ediyor</option>
                    <option value="on_hold">Beklemede</option>
                    <option value="completed">Tamamlandı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Machine Configuration */}
              <div className="border-t-2 border-gray-200 pt-4 mt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Tezgahlar</h4>

                {/* Machines */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Proje Tezgahları
                    </label>
                    <button
                      type="button"
                      onClick={handleAddProcessMachine}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      + Tezgah Ekle
                    </button>
                  </div>

                  {processMachines.length > 0 && (
                    <div className="space-y-3">
                      {processMachines.map((pm, index) => (
                        <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-blue-700">Sıra: {pm.sequence_order}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProcessMachine(index)}
                              className="text-red-600 hover:text-red-800 text-sm font-semibold"
                            >
                              Kaldır
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Tezgah
                              </label>
                              <select
                                value={pm.machine_id}
                                onChange={(e) => handleUpdateProcessMachine(index, 'machine_id', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Tezgah seçiniz</option>
                                {machines.map((machine) => (
                                  <option key={machine.id} value={machine.id}>
                                    {machine.machine_name} ({machine.machine_code})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Günlük Kapasite
                              </label>
                              <input
                                type="number"
                                value={pm.daily_capacity_target}
                                onChange={(e) => handleUpdateProcessMachine(index, 'daily_capacity_target', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Örn: 1000"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Notlar
                              </label>
                              <input
                                type="text"
                                value={pm.notes}
                                onChange={(e) => handleUpdateProcessMachine(index, 'notes', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Opsiyonel notlar"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Quantity and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hedef Miktar
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_quantity}
                    onChange={(e) => setFormData({ ...formData, target_quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: 1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Birim
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="adet">Adet</option>
                    <option value="kg">Kilogram</option>
                    <option value="ton">Ton</option>
                    <option value="m">Metre</option>
                    <option value="m2">Metrekare</option>
                    <option value="m3">Metreküp</option>
                    <option value="litre">Litre</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({
                    project_name: '',
                    project_code: '',
                    description: '',
                    status: 'planning',
                    start_date: '',
                    target_quantity: '',
                    unit: 'adet'
                  })
                  setProcessMachines([])
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!formData.project_name}
              >
                Proje Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PermissionGuard>
  )
}

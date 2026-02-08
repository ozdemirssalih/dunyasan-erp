'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { FolderKanban, Plus, Eye, Factory, Package, X } from 'lucide-react'

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
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Detail modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [machines, setMachines] = useState<any[]>([])
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])

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

      const finalCompanyId = profile?.company_id
      setCompanyId(finalCompanyId)

      if (!finalCompanyId) return

      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false })

      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (project: Project) => {
    console.log('🔵 Opening detail for:', project.project_name)
    setSelectedProject(project)
    setShowDetailModal(true)
    setDetailLoading(true)

    try {
      // Load machines
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('project_id', project.id)
        .eq('company_id', companyId)

      const machinesWithStats = await Promise.all(
        (machinesData || []).map(async (machine) => {
          const { data: givenMaterials } = await supabase
            .from('production_to_machine_transfers')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalGiven = givenMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0

          const { data: producedItems } = await supabase
            .from('production_outputs')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalProduced = producedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
          const efficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

          return { ...machine, totalGiven, totalProduced, efficiency }
        })
      )

      setMachines(machinesWithStats)

      // Load warehouse items
      const { data: warehouseData } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      const itemsWithShipments = await Promise.all(
        (warehouseData || []).map(async (item) => {
          const { data: shipments } = await supabase
            .from('warehouse_to_production_transfers')
            .select('quantity')
            .eq('item_id', item.id)
            .eq('project_id', project.id)

          const totalShipped = shipments?.reduce((sum, s) => sum + s.quantity, 0) || 0
          return { ...item, shipped_to_project: totalShipped }
        })
      )

      setWarehouseItems(itemsWithShipments)
    } catch (error) {
      console.error('Error loading detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setShowDetailModal(false)
    setSelectedProject(null)
    setMachines([])
    setWarehouseItems([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Proje Yönetimi</h2>
          <p className="text-gray-600">Projelerinizi yönetin ve takip edin</p>
        </div>
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
              <button
                onClick={() => openDetail(project)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Detay
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedProject && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedProject.project_name}</h2>
                  <p className="text-blue-100 text-sm mt-1">{selectedProject.project_code || 'Kod belirtilmemiş'}</p>
                </div>
                <button
                  onClick={closeDetail}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-600">Veriler yükleniyor...</div>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                      <Factory className="w-6 h-6 text-green-600 mb-2" />
                      <div className="text-2xl font-bold text-gray-900">{machines.length}</div>
                      <div className="text-sm text-gray-600">Projede Çalışan Tezgah</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                      <Package className="w-6 h-6 text-yellow-600 mb-2" />
                      <div className="text-2xl font-bold text-gray-900">{warehouseItems.length}</div>
                      <div className="text-sm text-gray-600">Depo Stok Kalemi</div>
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Machines */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Factory className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-lg">Projede Çalışan Tezgahlar</h3>
                      </div>
                      {machines.length > 0 ? (
                        <div className="space-y-3">
                          {machines.map((machine) => (
                            <div key={machine.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-bold text-gray-900">{machine.machine_name}</div>
                                  <div className="text-sm text-gray-600">{machine.machine_code}</div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  machine.status === 'active' ? 'bg-green-100 text-green-800' :
                                  machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {machine.status === 'active' ? 'Çalışıyor' :
                                   machine.status === 'maintenance' ? 'Bakımda' : 'Çalışmıyor'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                                <div className="text-center">
                                  <div className="text-xs text-gray-600">Verilen</div>
                                  <div className="text-sm font-bold">{machine.totalGiven?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-600">Üretilen</div>
                                  <div className="text-sm font-bold">{machine.totalProduced?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-600">Verimlilik</div>
                                  <div className={`text-sm font-bold ${
                                    (machine.efficiency || 0) >= 80 ? 'text-green-600' :
                                    (machine.efficiency || 0) >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {machine.efficiency?.toFixed(1) || '0.0'}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Bu projede çalışan tezgah yok.</p>
                      )}
                    </div>

                    {/* Warehouse Items */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Package className="w-5 h-5 text-yellow-600" />
                        <h3 className="font-bold text-lg">Depo Stok Durumu</h3>
                      </div>
                      {warehouseItems.length > 0 ? (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {warehouseItems.map((item) => (
                            <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                                  <div className="text-xs text-gray-600">{item.code}</div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  item.type === 'raw_material' ? 'bg-orange-100 text-orange-800' :
                                  item.type === 'semi_finished' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {item.type === 'raw_material' ? 'Hammadde' :
                                   item.type === 'semi_finished' ? 'Yarı Mamül' : 'Mamül'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                                <div>
                                  <div className="text-xs text-gray-600">Depoda</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    {item.current_stock?.toFixed(2) || '0.00'} {item.unit}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-600">Projeye Sevk</div>
                                  <div className="text-sm font-bold text-blue-600">
                                    {item.shipped_to_project?.toFixed(2) || '0.00'} {item.unit}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Depoda stok yok.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

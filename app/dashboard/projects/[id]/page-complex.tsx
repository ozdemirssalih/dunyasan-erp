'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, Factory, Package } from 'lucide-react'

interface Project {
  id: string
  project_name: string
  project_code?: string
  description?: string
  status: string
  start_date: string
  end_date?: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [machines, setMachines] = useState<any[]>([])
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔍 PROJECT DETAIL PAGE LOADED - Project ID:', projectId)
    console.log('🔍 Window location:', window.location.href)
    console.log('🔍 Pathname:', window.location.pathname)
    loadProjectData()
  }, [projectId])

  const loadProjectData = async () => {
    console.log('📊 Starting to load project data...')
    console.log('📊 Project ID:', projectId)
    try {
      setLoading(true)

      // Get company ID
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

      // Load project info
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('company_id', finalCompanyId)
        .single()

      setProject(projectData)

      // Load machines working on this project
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('project_id', projectId)
        .eq('company_id', finalCompanyId)

      // Calculate efficiency for each machine
      const machinesWithEfficiency = await Promise.all(
        (machinesData || []).map(async (machine) => {
          // Total given materials
          const { data: givenMaterials } = await supabase
            .from('production_to_machine_transfers')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalGiven = givenMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // Total produced
          const { data: producedItems } = await supabase
            .from('production_outputs')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalProduced = producedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // Calculate efficiency
          const efficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

          return {
            ...machine,
            totalGiven,
            totalProduced,
            efficiency
          }
        })
      )

      setMachines(machinesWithEfficiency)

      // Load warehouse items with shipments to this project
      const { data: warehouseData } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('name', { ascending: true })

      // Calculate shipped amounts for each item
      const itemsWithShipments = await Promise.all(
        (warehouseData || []).map(async (item) => {
          const { data: shipments } = await supabase
            .from('warehouse_to_production_transfers')
            .select('quantity')
            .eq('item_id', item.id)
            .eq('project_id', projectId)

          const totalShipped = shipments?.reduce((sum, s) => sum + s.quantity, 0) || 0

          return {
            ...item,
            shipped_to_project: totalShipped
          }
        })
      )

      setWarehouseItems(itemsWithShipments)

    } catch (error) {
      console.error('Error loading project data:', error)
    } finally {
      setLoading(false)
    }
  }

  console.log('🎨 RENDER - Loading:', loading, 'Project:', project?.project_name || 'null')

  if (loading) {
    console.log('⏳ Showing loading screen...')
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor... (Project ID: {projectId})</div>
      </div>
    )
  }

  if (!project) {
    console.log('❌ No project found, showing error')
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Proje bulunamadı. ID: {projectId}</p>
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Projelere Dön
          </button>
        </div>
      </div>
    )
  }

  console.log('✅ Rendering project detail page for:', project.project_name)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Projelere Dön</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{project.project_name}</h1>
            <p className="text-gray-600">{project.project_code || 'Kod belirtilmemiş'}</p>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>
          <span className={`px-4 py-2 rounded-lg font-semibold ${
            project.status === 'completed' ? 'bg-green-100 text-green-800' :
            project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
            project.status === 'cancelled' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {project.status === 'planning' ? 'Planlama' :
             project.status === 'in_progress' ? 'Devam Ediyor' :
             project.status === 'completed' ? 'Tamamlandı' :
             project.status === 'on_hold' ? 'Beklemede' :
             project.status === 'cancelled' ? 'İptal' : project.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
          <Factory className="w-8 h-8 text-green-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{machines.length}</div>
          <div className="text-gray-600">Bu Projede Çalışan Tezgah</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
          <Package className="w-8 h-8 text-yellow-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{warehouseItems.length}</div>
          <div className="text-gray-600">Depo Stok Kalemi</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tezgahlar */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Factory className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Projede Çalışan Tezgahlar</h2>
          </div>

          {machines.length > 0 ? (
            <div className="space-y-4">
              {machines.map((machine) => (
                <div key={machine.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-gray-900">{machine.machine_name}</div>
                      <div className="text-sm text-gray-600">{machine.machine_code}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      machine.status === 'active' ? 'bg-green-100 text-green-800' :
                      machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {machine.status === 'active' ? 'Çalışıyor' :
                       machine.status === 'maintenance' ? 'Bakımda' : 'Çalışmıyor'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Verilen</div>
                      <div className="text-sm font-bold text-gray-900">{machine.totalGiven?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Üretilen</div>
                      <div className="text-sm font-bold text-gray-900">{machine.totalProduced?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1">Verimlilik</div>
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
            <div className="text-center py-8">
              <Factory className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Bu projede çalışan tezgah yok.</p>
              <p className="text-gray-400 text-sm mt-1">Tezgah Yönetimi sayfasından tezgahlara proje atayabilirsiniz.</p>
            </div>
          )}
        </div>

        {/* Depo Stok */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Package className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-bold text-gray-800">Depo Stok Durumu</h2>
          </div>

          {warehouseItems.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {warehouseItems.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-yellow-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
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
                      <div className="text-xs text-gray-600">Depodaki Miktar</div>
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
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Depoda stok kalemi yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

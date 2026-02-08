'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Users,
  Factory,
  Package,
  Wrench,
  TrendingUp,
  Calendar,
  Truck,
  ClipboardList
} from 'lucide-react'

interface Project {
  id: string
  project_name: string
  project_code: string
  description: string
  start_date: string
  end_date: string
  status: string
  created_at: string
}

interface Customer {
  id: string
  customer_name: string
  customer_code: string
  contact_person: string
  phone: string
}

interface Machine {
  id: string
  machine_name: string
  machine_code: string
  status: string
}

interface Material {
  id: string
  item_name: string
  item_code: string
  quantity_needed: number
  unit: string
}

interface Product {
  id: string
  item_name: string
  item_code: string
  quantity_target: number
  quantity_produced: number
  unit: string
}

interface Equipment {
  id: string
  equipment_name: string
  equipment_code: string
  equipment_type: string
  status: string
}

interface Production {
  id: string
  output_item_name: string
  quantity: number
  production_date: string
  machine_name: string
  shift: string
}

interface Shipment {
  id: string
  item_name: string
  quantity: number
  shipment_destination: string
  created_at: string
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])

  useEffect(() => {
    loadProjectDetails()
  }, [projectId])

  const loadProjectDetails = async () => {
    try {
      setLoading(true)

      // Proje bilgisi
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Müşteriler
      const { data: customersData } = await supabase
        .from('project_customers')
        .select(`
          customer:customers(id, customer_name, customer_code, contact_person, phone)
        `)
        .eq('project_id', projectId)

      setCustomers(customersData?.map(pc => pc.customer as any) || [])

      // Tezgahlar
      const { data: machinesData } = await supabase
        .from('project_machines')
        .select(`
          machine:machines(id, machine_name, machine_code, status)
        `)
        .eq('project_id', projectId)

      // Her tezgah için istatistikleri hesapla
      const machinesWithStats = await Promise.all(
        (machinesData || []).map(async (pm: any) => {
          const machine = pm.machine
          if (!machine) return null

          // Verilen hammadde
          const { data: givenMaterials } = await supabase
            .from('production_to_machine_transfers')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalGiven = givenMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // Üretilen ürün
          const { data: producedItems } = await supabase
            .from('production_outputs')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalProduced = producedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // Verimlilik hesaplama
          const efficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

          return {
            ...machine,
            totalGiven,
            totalProduced,
            efficiency
          }
        })
      )

      setMachines(machinesWithStats.filter(m => m !== null))

      // Hammaddeler
      const { data: materialsData } = await supabase
        .from('project_required_materials')
        .select(`
          material_id,
          quantity_needed,
          item:warehouse_items(id, name, code, unit)
        `)
        .eq('project_id', projectId)

      setMaterials(materialsData?.map(m => ({
        id: m.material_id,
        item_name: (m.item as any)?.name || '',
        item_code: (m.item as any)?.code || '',
        quantity_needed: m.quantity_needed,
        unit: (m.item as any)?.unit || ''
      })) || [])

      // Mamüller
      const { data: productsData } = await supabase
        .from('project_target_products')
        .select(`
          product_id,
          quantity_target,
          quantity_produced,
          item:warehouse_items(id, name, code, unit)
        `)
        .eq('project_id', projectId)

      setProducts(productsData?.map(p => ({
        id: p.product_id,
        item_name: (p.item as any)?.name || '',
        item_code: (p.item as any)?.code || '',
        quantity_target: p.quantity_target,
        quantity_produced: p.quantity_produced,
        unit: (p.item as any)?.unit || ''
      })) || [])

      // Ekipmanlar
      const { data: equipmentData } = await supabase
        .from('project_equipment')
        .select(`
          equipment:equipment(id, equipment_name, equipment_code, equipment_type, status)
        `)
        .eq('project_id', projectId)

      setEquipment(equipmentData?.map(pe => pe.equipment as any) || [])

      // Üretim kayıtları
      const { data: productionsData } = await supabase
        .from('production_outputs')
        .select(`
          id,
          quantity,
          production_date,
          shift,
          output_item:warehouse_items!production_outputs_output_item_id_fkey(name),
          machine:machines(machine_name)
        `)
        .eq('project_id', projectId)
        .order('production_date', { ascending: false })

      setProductions(productionsData?.map(p => ({
        id: p.id,
        output_item_name: (p.output_item as any)?.name || '',
        quantity: p.quantity,
        production_date: p.production_date,
        machine_name: (p.machine as any)?.machine_name || '',
        shift: p.shift
      })) || [])

      // Sevkiyatlar (warehouse_transactions)
      const { data: shipmentsData } = await supabase
        .from('warehouse_transactions')
        .select(`
          id,
          quantity,
          shipment_destination,
          created_at,
          item:warehouse_items(name)
        `)
        .eq('type', 'exit')
        .not('shipment_destination', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

      setShipments(shipmentsData?.map(s => ({
        id: s.id,
        item_name: (s.item as any)?.name || '',
        quantity: s.quantity,
        shipment_destination: s.shipment_destination || '',
        created_at: s.created_at
      })) || [])

    } catch (error) {
      console.error('Error loading project details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Aktif', color: 'bg-green-100 text-green-800' },
      completed: { label: 'Tamamlandı', color: 'bg-blue-100 text-blue-800' },
      on_hold: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: 'İptal', color: 'bg-red-100 text-red-800' },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Proje bulunamadı</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{project.project_name}</h1>
            <p className="text-gray-600">{project.project_code}</p>
          </div>
        </div>
        {getStatusBadge(project.status)}
      </div>

      {/* Proje Bilgileri */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Proje Bilgileri</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Açıklama:</span>
            <p className="font-semibold">{project.description || '-'}</p>
          </div>
          <div>
            <span className="text-gray-600">Başlangıç:</span>
            <p className="font-semibold">{new Date(project.start_date).toLocaleDateString('tr-TR')}</p>
          </div>
          <div>
            <span className="text-gray-600">Bitiş:</span>
            <p className="font-semibold">{project.end_date ? new Date(project.end_date).toLocaleDateString('tr-TR') : '-'}</p>
          </div>
          <div>
            <span className="text-gray-600">Oluşturma:</span>
            <p className="font-semibold">{new Date(project.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold">{customers.length}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">Müşteriler</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <Factory className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold">{machines.length}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">Tezgahlar</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <Wrench className="w-8 h-8 text-purple-500" />
            <span className="text-2xl font-bold">{equipment.length}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">Ekipmanlar</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <ClipboardList className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold">{productions.length}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">Üretimler</p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Müşteriler */}
        <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold">Müşteriler</h3>
          </div>
          {customers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map(customer => (
                <div key={customer.id} className="p-4 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-lg hover:shadow-md transition-shadow">
                  <p className="font-semibold text-gray-900">{customer.customer_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{customer.customer_code}</p>
                  {customer.contact_person && (
                    <div className="mt-2 pt-2 border-t border-blue-100">
                      <p className="text-xs text-gray-700 font-medium">{customer.contact_person}</p>
                      <p className="text-xs text-gray-500">{customer.phone}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Müşteri eklenmemiş</p>
          )}
        </div>

        {/* Tezgahlar - Full Width */}
        <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <Factory className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold">Projede Çalışan Tezgahlar</h3>
          </div>
          {machines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {machines.map(machine => (
                <div key={machine.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-white">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Machine SVG Icon */}
                      <div className={`p-2 rounded-lg ${
                        machine.status === 'active' ? 'bg-green-100' :
                        machine.status === 'maintenance' ? 'bg-yellow-100' :
                        machine.status === 'idle' ? 'bg-gray-100' :
                        'bg-red-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          machine.status === 'active' ? 'text-green-600' :
                          machine.status === 'maintenance' ? 'text-yellow-600' :
                          machine.status === 'idle' ? 'text-gray-600' :
                          'text-red-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{machine.machine_name}</h4>
                        <p className="text-xs text-gray-500">{machine.machine_code}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      machine.status === 'active' ? 'bg-green-100 text-green-800' :
                      machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      machine.status === 'idle' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {machine.status === 'active' ? 'Aktif' :
                       machine.status === 'maintenance' ? 'Bakım' :
                       machine.status === 'idle' ? 'Boşta' : 'Devre Dışı'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Verilen:</span>
                      <span className="font-semibold text-gray-900">{machine.totalGiven?.toFixed(2) || '0.00'} kg</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Üretilen:</span>
                      <span className="font-semibold text-gray-900">{machine.totalProduced?.toFixed(2) || '0.00'} kg</span>
                    </div>
                  </div>

                  {/* Efficiency Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">Verimlilik</span>
                      <span className={`font-bold ${
                        machine.efficiency >= 80 ? 'text-green-600' :
                        machine.efficiency >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        %{machine.efficiency?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          machine.efficiency >= 80 ? 'bg-green-500' :
                          machine.efficiency >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(machine.efficiency || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Tezgah eklenmemiş</p>
          )}
        </div>

        {/* Hammaddeler */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-bold">Hammadde İhtiyacı</h3>
          </div>
          {materials.length > 0 ? (
            <div className="space-y-3">
              {materials.map(material => (
                <div key={material.id} className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Package className="w-5 h-5 text-yellow-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{material.item_name}</p>
                        <p className="text-sm text-gray-600">{material.item_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-yellow-800 text-lg">
                        {material.quantity_needed}
                      </span>
                      <p className="text-xs text-gray-600">{material.unit}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Hammadde eklenmemiş</p>
          )}
        </div>

        {/* Mamüller */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold">Mamül Hedefleri</h3>
          </div>
          {products.length > 0 ? (
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-purple-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product.item_name}</p>
                        <p className="text-sm text-gray-600">{product.item_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700">
                        {product.quantity_produced} / {product.quantity_target}
                      </p>
                      <p className="text-xs text-gray-600">{product.unit}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">İlerleme</span>
                      <span className={`font-bold ${
                        (product.quantity_produced / product.quantity_target) * 100 >= 100 ? 'text-green-600' :
                        (product.quantity_produced / product.quantity_target) * 100 >= 75 ? 'text-blue-600' :
                        (product.quantity_produced / product.quantity_target) * 100 >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        %{((product.quantity_produced / product.quantity_target) * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          (product.quantity_produced / product.quantity_target) * 100 >= 100 ? 'bg-green-500' :
                          (product.quantity_produced / product.quantity_target) * 100 >= 75 ? 'bg-blue-500' :
                          (product.quantity_produced / product.quantity_target) * 100 >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((product.quantity_produced / product.quantity_target) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Mamül hedefi eklenmemiş</p>
          )}
        </div>

        {/* Ekipmanlar */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Wrench className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-bold">Kullanılan Ekipmanlar</h3>
          </div>
          {equipment.length > 0 ? (
            <div className="space-y-3">
              {equipment.map(item => (
                <div key={item.id} className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        item.status === 'available' ? 'bg-green-100' :
                        item.status === 'in_use' ? 'bg-blue-100' :
                        item.status === 'maintenance' ? 'bg-yellow-100' :
                        'bg-red-100'
                      }`}>
                        <Wrench className={`w-5 h-5 ${
                          item.status === 'available' ? 'text-green-700' :
                          item.status === 'in_use' ? 'text-blue-700' :
                          item.status === 'maintenance' ? 'text-yellow-700' :
                          'text-red-700'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{item.equipment_name}</p>
                        <p className="text-xs text-gray-600">{item.equipment_code}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.equipment_type}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      item.status === 'available' ? 'bg-green-100 text-green-800' :
                      item.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                      item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status === 'available' ? 'Mevcut' :
                       item.status === 'in_use' ? 'Kullanımda' :
                       item.status === 'maintenance' ? 'Bakımda' : 'Kayıp'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Ekipman eklenmemiş</p>
          )}
        </div>

        {/* Üretim Kayıtları */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">Son Üretim Kayıtları</h3>
          </div>
          {productions.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {productions.map(production => (
                <div key={production.id} className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-indigo-100 rounded-lg mt-0.5">
                        <ClipboardList className="w-5 h-5 text-indigo-700" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{production.output_item_name}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          <Factory className="w-3 h-3 inline mr-1" />
                          {production.machine_name}
                        </p>
                        <div className="flex items-center space-x-3 mt-2">
                          <p className="text-xs text-gray-600">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {new Date(production.production_date).toLocaleDateString('tr-TR')}
                          </p>
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                            {production.shift}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <span className="font-bold text-indigo-700 text-lg">{production.quantity}</span>
                      <p className="text-xs text-gray-600">adet</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Üretim kaydı yok</p>
          )}
        </div>
      </div>

      {/* Sevkiyatlar - Full Width */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Truck className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold">Son Sevkiyatlar</h3>
        </div>
        {shipments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-red-50 to-orange-50 border-b-2 border-red-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ürün</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Miktar</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Hedef</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment, index) => (
                  <tr key={shipment.id} className={`border-b hover:bg-red-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Truck className="w-4 h-4 text-red-600" />
                        <span className="font-semibold text-gray-900">{shipment.item_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                        {shipment.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{shipment.shipment_destination}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(shipment.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Sevkiyat kaydı yok</p>
        )}
      </div>
    </div>
  )
}

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

interface Tool {
  id: string
  tool_name: string
  tool_code: string
  tool_type: string
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
  const [tools, setTools] = useState<Tool[]>([])
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

      setMachines(machinesData?.map(pm => pm.machine as any) || [])

      // Hammaddeler
      const { data: materialsData } = await supabase
        .from('project_materials')
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
        .from('project_products')
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

      // Takımlar
      const { data: toolsData } = await supabase
        .from('project_tools')
        .select(`
          tool:tools(id, tool_name, tool_code, tool_type, status)
        `)
        .eq('project_id', projectId)

      setTools(toolsData?.map(pt => pt.tool as any) || [])

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
            <span className="text-2xl font-bold">{tools.length}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">Takımlar</p>
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
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold">Müşteriler</h3>
          </div>
          {customers.length > 0 ? (
            <div className="space-y-2">
              {customers.map(customer => (
                <div key={customer.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold">{customer.customer_name}</p>
                  <p className="text-sm text-gray-600">{customer.customer_code}</p>
                  {customer.contact_person && (
                    <p className="text-xs text-gray-500">{customer.contact_person} - {customer.phone}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Müşteri eklenmemiş</p>
          )}
        </div>

        {/* Tezgahlar */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Factory className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold">Tezgahlar</h3>
          </div>
          {machines.length > 0 ? (
            <div className="space-y-2">
              {machines.map(machine => (
                <div key={machine.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{machine.machine_name}</p>
                    <p className="text-sm text-gray-600">{machine.machine_code}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    machine.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {machine.status}
                  </span>
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
            <div className="space-y-2">
              {materials.map(material => (
                <div key={material.id} className="p-3 bg-gray-50 rounded-lg flex justify-between">
                  <div>
                    <p className="font-semibold">{material.item_name}</p>
                    <p className="text-sm text-gray-600">{material.item_code}</p>
                  </div>
                  <span className="font-bold text-yellow-700">
                    {material.quantity_needed} {material.unit}
                  </span>
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
            <div className="space-y-2">
              {products.map(product => (
                <div key={product.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-semibold">{product.item_name}</p>
                      <p className="text-sm text-gray-600">{product.item_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700">
                        {product.quantity_produced} / {product.quantity_target} {product.unit}
                      </p>
                      <p className="text-xs text-gray-500">
                        %{((product.quantity_produced / product.quantity_target) * 100).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min((product.quantity_produced / product.quantity_target) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Mamül hedefi eklenmemiş</p>
          )}
        </div>

        {/* Takımlar */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Wrench className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-bold">Kullanılan Takımlar</h3>
          </div>
          {tools.length > 0 ? (
            <div className="space-y-2">
              {tools.map(tool => (
                <div key={tool.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{tool.tool_name}</p>
                    <p className="text-sm text-gray-600">{tool.tool_code} - {tool.tool_type}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    tool.status === 'available' ? 'bg-green-100 text-green-800' :
                    tool.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                    tool.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {tool.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Takım eklenmemiş</p>
          )}
        </div>

        {/* Üretim Kayıtları */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">Üretim Kayıtları</h3>
          </div>
          {productions.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {productions.map(production => (
                <div key={production.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{production.output_item_name}</p>
                      <p className="text-sm text-gray-600">{production.machine_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(production.production_date).toLocaleDateString('tr-TR')} - {production.shift}
                      </p>
                    </div>
                    <span className="font-bold text-indigo-700">{production.quantity}</span>
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
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Ürün</th>
                  <th className="px-4 py-2 text-left">Miktar</th>
                  <th className="px-4 py-2 text-left">Hedef</th>
                  <th className="px-4 py-2 text-left">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(shipment => (
                  <tr key={shipment.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{shipment.item_name}</td>
                    <td className="px-4 py-3">{shipment.quantity}</td>
                    <td className="px-4 py-3">{shipment.shipment_destination}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(shipment.created_at).toLocaleDateString('tr-TR')}
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

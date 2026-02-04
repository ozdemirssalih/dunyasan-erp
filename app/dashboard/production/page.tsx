'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'

type Tab = 'inventory' | 'requests' | 'assignments' | 'outputs'

interface ProductionInventoryItem {
  id: string
  item_id: string
  item_code: string
  item_name: string
  category_name: string
  unit: string
  current_stock: number
}

interface MaterialRequest {
  id: string
  item_name: string
  item_code: string
  category_name: string
  quantity: number
  unit: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  reason: string
  status: string
  requested_by_name: string
  requested_at: string
}

interface Machine {
  id: string
  name: string
  code: string
  status: string
}

interface MaterialAssignment {
  id: string
  machine_name: string
  machine_code: string
  item_name: string
  item_code: string
  quantity: number
  unit: string
  assigned_by_name: string
  assigned_date: string
  shift: string
}

interface ProductionOutput {
  id: string
  machine_name: string
  machine_code: string
  output_item_name: string
  quantity: number
  unit: string
  production_date: string
  shift: string
  quality_status: string
  operator_name: string
}

export default function ProductionPage() {
  const { canCreate } = usePermissions()

  const [activeTab, setActiveTab] = useState<Tab>('inventory')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Data states
  const [productionInventory, setProductionInventory] = useState<ProductionInventoryItem[]>([])
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignments, setAssignments] = useState<MaterialAssignment[]>([])
  const [outputs, setOutputs] = useState<ProductionOutput[]>([])
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])

  // Modal states
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [showOutputModal, setShowOutputModal] = useState(false)

  // Form states
  const [requestForm, setRequestForm] = useState({
    item_id: '',
    quantity: 0,
    urgency: 'medium',
    reason: '',
  })

  const [assignmentForm, setAssignmentForm] = useState({
    machine_id: '',
    item_id: '',
    quantity: 0,
    shift: 'sabah',
    notes: '',
  })

  const [outputForm, setOutputForm] = useState({
    machine_id: '',
    output_item_id: '',
    quantity: 0,
    shift: 'sabah',
    operator_id: '',
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)

      // Load all data in parallel
      await Promise.all([
        loadProductionInventory(profile.company_id),
        loadMaterialRequests(profile.company_id),
        loadMachines(profile.company_id),
        loadAssignments(profile.company_id),
        loadOutputs(profile.company_id),
        loadWarehouseItems(profile.company_id),
      ])

    } catch (error) {
      console.error('Error loading data:', error)
      alert('Veri yüklenirken hata oluştu!')
    } finally {
      setLoading(false)
    }
  }

  const loadProductionInventory = async (companyId: string) => {
    const { data } = await supabase
      .from('production_inventory')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name))
      `)
      .eq('company_id', companyId)
      .gt('current_stock', 0)

    const inventoryData = data?.map((inv: any) => ({
      id: inv.id,
      item_id: inv.item_id,
      item_code: inv.item?.code || '',
      item_name: inv.item?.name || '',
      category_name: inv.item?.category?.name || '',
      unit: inv.item?.unit || '',
      current_stock: inv.current_stock
    })) || []

    setProductionInventory(inventoryData)
  }

  const loadMaterialRequests = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_material_requests')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name)),
        requested_by:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading material requests:', error)
    }

    const requestsData = data?.map((req: any) => ({
      id: req.id,
      item_name: req.item?.name || '',
      item_code: req.item?.code || '',
      category_name: req.item?.category?.name || '',
      quantity: req.quantity,
      unit: req.item?.unit || '',
      urgency: req.urgency,
      reason: req.reason || '',
      status: req.status,
      requested_by_name: req.requested_by?.full_name || '',
      requested_at: req.requested_at
    })) || []

    setMaterialRequests(requestsData)
  }

  const loadMachines = async (companyId: string) => {
    const { data } = await supabase
      .from('machines')
      .select('*')
      .eq('company_id', companyId)
      .order('code')

    setMachines(data || [])
  }

  const loadAssignments = async (companyId: string) => {
    const { data } = await supabase
      .from('production_material_assignments')
      .select(`
        *,
        machine:machines(name, code),
        item:warehouse_items(code, name, unit),
        assigned_by:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('assigned_date', { ascending: false })
      .limit(100)

    const assignmentsData = data?.map((a: any) => ({
      id: a.id,
      machine_name: a.machine?.name || '',
      machine_code: a.machine?.code || '',
      item_name: a.item?.name || '',
      item_code: a.item?.code || '',
      quantity: a.quantity,
      unit: a.item?.unit || '',
      assigned_by_name: a.assigned_by?.full_name || '',
      assigned_date: a.assigned_date,
      shift: a.shift || ''
    })) || []

    setAssignments(assignmentsData)
  }

  const loadOutputs = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_outputs')
      .select(`
        *,
        machine:machines(name, code),
        output_item:warehouse_items(name, unit),
        operator_id:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('production_date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error loading outputs:', error)
    }

    const outputsData = data?.map((o: any) => ({
      id: o.id,
      machine_name: o.machine?.name || '',
      machine_code: o.machine?.code || '',
      output_item_name: o.output_item?.name || '',
      quantity: o.quantity,
      unit: o.output_item?.unit || '',
      production_date: o.production_date,
      shift: o.shift || '',
      quality_status: o.quality_status,
      operator_name: o.operator_id?.full_name || ''
    })) || []

    setOutputs(outputsData)
  }

  const loadWarehouseItems = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    setWarehouseItems(data || [])
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('production_material_requests')
        .insert({
          company_id: companyId,
          item_id: requestForm.item_id,
          quantity: requestForm.quantity,
          urgency: requestForm.urgency,
          reason: requestForm.reason,
          requested_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Malzeme talebi gönderildi!')
      setShowRequestModal(false)
      resetRequestForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('production_material_assignments')
        .insert({
          company_id: companyId,
          machine_id: assignmentForm.machine_id,
          item_id: assignmentForm.item_id,
          quantity: assignmentForm.quantity,
          shift: assignmentForm.shift,
          notes: assignmentForm.notes,
          assigned_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Hammadde tezgaha verildi!')
      setShowAssignmentModal(false)
      resetAssignmentForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating assignment:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateOutput = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('production_outputs')
        .insert({
          company_id: companyId,
          machine_id: outputForm.machine_id,
          output_item_id: outputForm.output_item_id,
          quantity: outputForm.quantity,
          shift: outputForm.shift,
          operator_id: outputForm.operator_id || null,
          notes: outputForm.notes,
          created_by: currentUserId,
        })

      if (error) throw error

      alert('✅ Üretim kaydı oluşturuldu!')
      setShowOutputModal(false)
      resetOutputForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating output:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const resetRequestForm = () => {
    setRequestForm({
      item_id: '',
      quantity: 0,
      urgency: 'medium',
      reason: '',
    })
  }

  const resetAssignmentForm = () => {
    setAssignmentForm({
      machine_id: '',
      item_id: '',
      quantity: 0,
      shift: 'sabah',
      notes: '',
    })
  }

  const resetOutputForm = () => {
    setOutputForm({
      machine_id: '',
      output_item_id: '',
      quantity: 0,
      shift: 'sabah',
      operator_id: '',
      notes: '',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="production" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Üretim Yönetimi</h2>
            <p className="text-gray-600">Tezgah hammadde takibi ve üretim kayıtları</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'inventory', label: 'Üretim Stoğu', count: productionInventory.length },
              { id: 'requests', label: 'Depodan Talepler', count: materialRequests.filter(r => r.status === 'pending').length },
              { id: 'assignments', label: 'Tezgaha Hammadde Ver', icon: '🏭' },
              { id: 'outputs', label: 'Üretim Kayıtları', count: outputs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
                {tab.icon && <span>{tab.icon}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB CONTENT */}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">📦 Üretim Stoğu (Depodan Onaylanmış)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kod</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hammadde</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mevcut Stok</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productionInventory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {item.category_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-gray-900">
                          {item.current_stock} <span className="text-sm text-gray-600">{item.unit}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {productionInventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Üretim stoğunda hammadde yok. Depodan talep oluşturun.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canCreate('production') && (
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Yeni Talep
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {materialRequests.map(req => {
                const urgencyColors: Record<string, string> = {
                  low: 'bg-gray-100 text-gray-700',
                  medium: 'bg-blue-100 text-blue-700',
                  high: 'bg-orange-100 text-orange-700',
                  urgent: 'bg-red-100 text-red-700'
                }

                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700',
                  cancelled: 'bg-gray-100 text-gray-700'
                }

                return (
                  <div key={req.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{req.item_name}</h4>
                        <p className="text-sm text-gray-500">{req.item_code} - {req.category_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${urgencyColors[req.urgency] || 'bg-gray-100 text-gray-700'}`}>
                          {req.urgency.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[req.status] || 'bg-gray-100 text-gray-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Miktar:</span>
                        <span className="font-semibold ml-2">{req.quantity} {req.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Talep Eden:</span>
                        <span className="ml-2">{req.requested_by_name}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Tarih:</span>
                        <span className="ml-2">{new Date(req.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {req.reason && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Sebep:</span>
                          <p className="mt-1 text-gray-700">{req.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {materialRequests.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz malzeme talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-600">32 tezgaha hammadde dağıtımı</p>
              {canCreate('production') && (
                <button
                  onClick={() => setShowAssignmentModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Tezgaha Hammadde Ver
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tezgah</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hammadde</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Miktar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vardiya</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Veren</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments.map(assignment => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(assignment.assigned_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{assignment.machine_name}</div>
                        <div className="text-xs text-gray-500">{assignment.machine_code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{assignment.item_name}</div>
                        <div className="text-xs text-gray-500">{assignment.item_code}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {assignment.quantity} {assignment.unit}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {assignment.shift}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {assignment.assigned_by_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {assignments.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Henüz hammadde dağıtımı yapılmamış</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OUTPUTS TAB */}
        {activeTab === 'outputs' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canCreate('production') && (
                <button
                  onClick={() => setShowOutputModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Üretim Kaydı Ekle
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tezgah</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Üretilen Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Miktar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vardiya</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kalite</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Operatör</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {outputs.map(output => {
                    const qualityColors: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-700',
                      approved: 'bg-green-100 text-green-700',
                      rejected: 'bg-red-100 text-red-700'
                    }

                    return (
                      <tr key={output.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(output.production_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{output.machine_name}</div>
                          <div className="text-xs text-gray-500">{output.machine_code}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {output.output_item_name}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {output.quantity} {output.unit}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {output.shift}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded font-semibold ${qualityColors[output.quality_status] || 'bg-gray-100 text-gray-700'}`}>
                            {output.quality_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {output.operator_name || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {outputs.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Henüz üretim kaydı yok</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODALS */}
        {/* Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Depodan Malzeme Talebi</h3>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hammadde <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={requestForm.item_id}
                      onChange={(e) => setRequestForm({ ...requestForm, item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {warehouseItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={requestForm.quantity}
                      onChange={(e) => setRequestForm({ ...requestForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Aciliyet <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={requestForm.urgency}
                      onChange={(e) => setRequestForm({ ...requestForm, urgency: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                      <option value="urgent">Acil</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sebep</label>
                    <textarea
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Talep Gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false)
                      resetRequestForm()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assignment Modal */}
        {showAssignmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Tezgaha Hammadde Ver</h3>

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tezgah <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assignmentForm.machine_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, machine_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.code} - {machine.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hammadde <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assignmentForm.item_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {productionInventory.map(item => (
                        <option key={item.id} value={item.item_id}>
                          {item.item_code} - {item.item_name} (Stok: {item.current_stock} {item.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={assignmentForm.quantity}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Vardiya <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assignmentForm.shift}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, shift: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="sabah">Sabah</option>
                      <option value="oglen">Öğlen</option>
                      <option value="gece">Gece</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                    <textarea
                      value={assignmentForm.notes}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Tezgaha Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignmentModal(false)
                      resetAssignmentForm()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Output Modal */}
        {showOutputModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Üretim Kaydı Ekle</h3>

              <form onSubmit={handleCreateOutput} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tezgah <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={outputForm.machine_id}
                      onChange={(e) => setOutputForm({ ...outputForm, machine_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.code} - {machine.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Üretilen Ürün <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={outputForm.output_item_id}
                      onChange={(e) => setOutputForm({ ...outputForm, output_item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {warehouseItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={outputForm.quantity}
                      onChange={(e) => setOutputForm({ ...outputForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Vardiya <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={outputForm.shift}
                      onChange={(e) => setOutputForm({ ...outputForm, shift: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="sabah">Sabah</option>
                      <option value="oglen">Öğlen</option>
                      <option value="gece">Gece</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                    <textarea
                      value={outputForm.notes}
                      onChange={(e) => setOutputForm({ ...outputForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOutputModal(false)
                      resetOutputForm()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold"
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

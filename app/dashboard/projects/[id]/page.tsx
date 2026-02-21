'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, Factory, Package, Building2, TrendingUp, Plus, Users, Wrench, Edit, Calculator } from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])
  const [projectMaterials, setProjectMaterials] = useState<any[]>([])
  const [productions, setProductions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Tezgah konfigürasyonu ve üretim takibi
  const [processMachines, setProcessMachines] = useState<any[]>([])
  const [dailyProduction, setDailyProduction] = useState<any[]>([])

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const [showMachineModal, setShowMachineModal] = useState(false)
  const [availableMachines, setAvailableMachines] = useState<any[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState('')

  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [materialQuantity, setMaterialQuantity] = useState('')

  // Tools modal
  const [showToolModal, setShowToolModal] = useState(false)
  const [projectTools, setProjectTools] = useState<any[]>([])
  const [availableTools, setAvailableTools] = useState<any[]>([])
  const [selectedToolId, setSelectedToolId] = useState('')
  const [toolBreakageRate, setToolBreakageRate] = useState('')

  // Machine edit modal
  const [showMachineEditModal, setShowMachineEditModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState<any>(null)
  const [machineEditForm, setMachineEditForm] = useState({
    daily_capacity_target: '',
    notes: ''
  })

  useEffect(() => {
    console.log('🟢 PROJECT DETAIL PAGE - Loading project:', projectId)
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const finalCompanyId = profile?.company_id
      if (!finalCompanyId) return

      setCompanyId(finalCompanyId)

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, customer_company:customer_companies(id, customer_name, contact_person, phone, email)')
        .eq('id', projectId)
        .eq('company_id', finalCompanyId)
        .single()

      if (projectError) {
        console.error('❌ Project load error:', projectError)
        return
      }

      console.log('✅ Project loaded:', projectData?.project_name)
      setProject(projectData)
      setCustomer(projectData?.customer_company)

      // Load process machines
      const { data: processMachinesData } = await supabase
        .from('project_machines')
        .select('*, machine:machines(id, machine_code, machine_name, machine_type, status)')
        .eq('project_id', projectId)
        .order('display_order')

      console.log('✅ Process machines loaded:', processMachinesData?.length || 0)
      setProcessMachines(processMachinesData || [])

      // Load daily production data (last 30 days)
      const { data: dailyProductionData } = await supabase
        .from('machine_daily_production')
        .select('*, machine:machines(id, machine_code, machine_name)')
        .eq('project_id', projectId)
        .order('production_date', { ascending: false })
        .limit(30)

      console.log('✅ Daily production loaded:', dailyProductionData?.length || 0)
      setDailyProduction(dailyProductionData || [])

      // Load productions (for progress calculation)
      const { data: productionsData } = await supabase
        .from('production_outputs')
        .select('*, machine:machines(machine_name)')
        .eq('project_id', projectId)
        .order('production_date', { ascending: false })

      console.log('✅ Productions loaded:', productionsData?.length || 0)
      setProductions(productionsData || [])

      // Load warehouse items (tüm depo - malzeme eklemek için)
      const { data: warehouseData } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('name', { ascending: true })

      console.log('✅ Warehouse items loaded:', warehouseData?.length || 0)
      setWarehouseItems(warehouseData || [])

      // Load project materials (sadece bu projeye atanmış malzemeler)
      const { data: projectMaterialsData } = await supabase
        .from('project_materials')
        .select('*, warehouse_item:warehouse_items(*)')
        .eq('project_id', projectId)

      console.log('✅ Project materials loaded:', projectMaterialsData?.length || 0)
      setProjectMaterials(projectMaterialsData || [])

      // Load available customers for modal
      const { data: customersData } = await supabase
        .from('customer_companies')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('customer_name', { ascending: true })

      setCustomers(customersData || [])

      // Load available machines
      const { data: availableMachinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('machine_name', { ascending: true })

      // Load all machine assignments in one query
      const { data: allAssignments } = await supabase
        .from('project_machines')
        .select('machine_id, project_id, project:projects(project_name)')

      // Map assignments to machines
      const machinesWithAssignment = (availableMachinesData || []).map((machine) => {
        const assignment = allAssignments?.find((a: any) => a.machine_id === machine.id)
        return {
          ...machine,
          assignedProject: assignment?.project || null,
          isAssignedToThisProject: assignment?.project_id === projectId
        }
      })

      console.log('✅ Available machines loaded:', machinesWithAssignment?.length || 0)
      setAvailableMachines(machinesWithAssignment || [])

      // Load project tools
      const { data: projectToolsData } = await supabase
        .from('project_tools')
        .select('*, tool:tools(id, tool_code, tool_name, unit_price), calculated_unit_cost, last_calculation_date')
        .eq('project_id', projectId)

      console.log('✅ Project tools loaded:', projectToolsData?.length || 0)
      setProjectTools(projectToolsData || [])

      // Load available tools
      const { data: availableToolsData } = await supabase
        .from('tools')
        .select('*')
        .eq('company_id', finalCompanyId)
        .eq('is_active', true)
        .order('tool_code', { ascending: true })

      setAvailableTools(availableToolsData || [])

    } catch (error) {
      console.error('❌ Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Proje bulunamadı.</p>
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

  // Calculate progress
  const targetQuantity = project?.target_quantity || 0
  const totalProduced = productions.reduce((sum, p) => sum + (p.quantity || 0), 0)
  const progressPercentage = targetQuantity > 0 ? Math.min((totalProduced / targetQuantity) * 100, 100) : 0

  const handleAssignCustomer = async () => {
    if (!selectedCustomerId) return

    try {
      const { error } = await supabase
        .from('projects')
        .update({ customer_company_id: selectedCustomerId })
        .eq('id', projectId)

      if (error) throw error

      // Reload data
      await loadData()
      setShowCustomerModal(false)
      setSelectedCustomerId('')
    } catch (error) {
      console.error('❌ Error assigning customer:', error)
      alert('Müşteri atanırken hata oluştu!')
    }
  }

  const handleAssignMachine = async () => {
    if (!selectedMachineId || !companyId) return

    try {
      // Check in availableMachines array (already loaded)
      const selectedMachine = availableMachines.find((m: any) => m.id === selectedMachineId)

      if (selectedMachine?.assignedProject && !selectedMachine.isAssignedToThisProject) {
        alert(`Bu tezgah başka bir projeye atanmış: ${selectedMachine.assignedProject.project_name}`)
        return
      }

      // Get the next display order
      const nextOrder = processMachines.length + 1

      const { error } = await supabase
        .from('project_machines')
        .insert({
          company_id: companyId,
          project_id: projectId,
          machine_id: selectedMachineId,
          display_order: nextOrder
        })

      if (error) throw error

      // Reload data
      await loadData()
      setShowMachineModal(false)
      setSelectedMachineId('')
    } catch (error: any) {
      console.error('❌ Error assigning machine:', error)
      if (error?.code === '23505') {
        alert('Bu tezgah zaten bu projeye eklenmiş!')
      } else {
        alert('Tezgah eklenirken hata oluştu!')
      }
    }
  }

  const handleRemoveMachine = async (projectMachineId: string) => {
    if (!confirm('Bu tezgahı projeden çıkarmak istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_machines')
        .delete()
        .eq('id', projectMachineId)

      if (error) throw error

      // Reload data
      await loadData()
    } catch (error) {
      console.error('❌ Error removing machine:', error)
      alert('Tezgah çıkarılırken hata oluştu!')
    }
  }

  const handleAddMaterial = async () => {
    if (!selectedMaterialId) return

    try {
      const { error } = await supabase
        .from('project_materials')
        .insert({
          project_id: projectId,
          warehouse_item_id: selectedMaterialId,
          required_quantity: materialQuantity ? parseFloat(materialQuantity) : 0
        })

      if (error) throw error

      // Reload data
      await loadData()
      setShowMaterialModal(false)
      setSelectedMaterialId('')
      setMaterialQuantity('')
    } catch (error: any) {
      console.error('❌ Error adding material:', error)
      if (error?.code === '23505') {
        alert('Bu malzeme zaten projeye eklenmiş!')
      } else {
        alert('Malzeme eklenirken hata oluştu!')
      }
    }
  }

  const handleRemoveMaterial = async (projectMaterialId: string) => {
    if (!confirm('Bu malzemeyi projeden çıkarmak istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_materials')
        .delete()
        .eq('id', projectMaterialId)

      if (error) throw error

      // Reload data
      await loadData()
    } catch (error) {
      console.error('❌ Error removing material:', error)
      alert('Malzeme çıkarılırken hata oluştu!')
    }
  }

  const handleAddTool = async () => {
    if (!selectedToolId) return

    try {
      const { error } = await supabase
        .from('project_tools')
        .insert({
          project_id: projectId,
          tool_id: selectedToolId,
          breakage_rate: toolBreakageRate ? parseInt(toolBreakageRate) : 0
        })

      if (error) throw error

      // Reload data
      await loadData()
      setShowToolModal(false)
      setSelectedToolId('')
      setToolBreakageRate('')
    } catch (error: any) {
      console.error('❌ Error adding tool:', error)
      if (error?.code === '23505') {
        alert('Bu takım zaten projeye eklenmiş!')
      } else {
        alert('Takım eklenirken hata oluştu!')
      }
    }
  }

  const handleRemoveTool = async (projectToolId: string) => {
    if (!confirm('Bu takımı projeden çıkarmak istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_tools')
        .delete()
        .eq('id', projectToolId)

      if (error) throw error

      // Reload data
      await loadData()
    } catch (error) {
      console.error('❌ Error removing tool:', error)
      alert('Takım çıkarılırken hata oluştu!')
    }
  }

  const handleEditMachine = (machine: any) => {
    setEditingMachine(machine)
    setMachineEditForm({
      daily_capacity_target: machine.daily_capacity_target?.toString() || '',
      notes: machine.notes || ''
    })
    setShowMachineEditModal(true)
  }

  const handleUpdateMachine = async () => {
    if (!editingMachine) return

    try {
      const { error } = await supabase
        .from('project_machines')
        .update({
          daily_capacity_target: machineEditForm.daily_capacity_target ? parseInt(machineEditForm.daily_capacity_target) : null,
          notes: machineEditForm.notes || null
        })
        .eq('id', editingMachine.id)

      if (error) throw error

      // Reload data
      await loadData()
      setShowMachineEditModal(false)
      setEditingMachine(null)
    } catch (error) {
      console.error('❌ Error updating machine:', error)
      alert('Tezgah güncellenirken hata oluştu!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Projelere Dön</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{project.project_name}</h1>
            <p className="text-gray-600">{project.project_code || 'Kod belirtilmemiş'}</p>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>
          <span className={`px-4 py-2 rounded-lg font-semibold ${
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

        {/* Progress Bar */}
        {targetQuantity > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Proje İlerlemesi</span>
              <span className="text-sm font-bold text-blue-600">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  progressPercentage >= 100 ? 'bg-green-500' :
                  progressPercentage >= 75 ? 'bg-blue-500' :
                  progressPercentage >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-600">Üretilen: {totalProduced.toFixed(2)}</span>
              <span className="text-xs text-gray-600">Hedef: {targetQuantity.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cost Summary */}
      {project.last_calculated_total_cost && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl shadow-md p-6 border-l-4 border-emerald-500">
          <div className="flex items-center space-x-2 mb-4">
            <Calculator className="w-6 h-6 text-emerald-700" />
            <h2 className="text-xl font-bold text-gray-800">Maliyet Özeti</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/60 rounded-lg p-4">
              <div className="text-xs font-semibold text-gray-600 mb-1">TOPLAM KESİCİ MALİYETİ</div>
              <div className="text-2xl font-bold text-emerald-700">
                {project.last_calculated_total_cost?.toFixed(2)} €
              </div>
            </div>

            <div className="bg-white/60 rounded-lg p-4">
              <div className="text-xs font-semibold text-gray-600 mb-1">PARÇA BAŞI MALİYET</div>
              <div className="text-2xl font-bold text-teal-700">
                {project.last_calculated_unit_cost?.toFixed(4)} €
              </div>
            </div>

            <div className="bg-white/60 rounded-lg p-4">
              <div className="text-xs font-semibold text-gray-600 mb-1">SİPARİŞ ADEDİ</div>
              <div className="text-2xl font-bold text-gray-700">
                {project.last_order_quantity?.toLocaleString('tr-TR')}
              </div>
            </div>
          </div>

          {project.last_cost_calculation_date && (
            <div className="mt-3 text-xs text-emerald-700 font-semibold">
              Son Hesaplama: {new Date(project.last_cost_calculation_date).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      )}

      {/* Customer Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">Müşteri Bilgileri</h2>
          </div>
          {!customer && (
            <button
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Müşteri Ata</span>
            </button>
          )}
        </div>

        {customer ? (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{customer.customer_name}</h3>
                <div className="mt-3 space-y-2">
                  {customer.contact_person && (
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-700">{customer.contact_person}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">📞 {customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">✉️ {customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCustomerModal(true)}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Değiştir
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Bu projeye henüz müşteri atanmamış.</p>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="mt-4 text-purple-600 hover:text-purple-800 font-semibold"
            >
              Müşteri Ata
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
          <Factory className="w-8 h-8 text-green-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{processMachines.length}</div>
          <div className="text-gray-600">Projede Kullanılan Tezgah</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
          <Package className="w-8 h-8 text-yellow-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{projectMaterials.length}</div>
          <div className="text-gray-600">Projede Kullanılan Malzeme</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-6 border-l-4 border-orange-500">
          <Wrench className="w-8 h-8 text-orange-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{projectTools.length}</div>
          <div className="text-gray-600">Projede Kullanılan Takım</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
          <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{productions.length}</div>
          <div className="text-gray-600">Toplam Üretim Kaydı</div>
        </div>
      </div>

      {/* Recent Productions / Shipments */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center space-x-2 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Son Üretim Çıktıları</h2>
        </div>

        {productions.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {productions.slice(0, 10).map((production) => (
              <div key={production.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">
                      {production.machine?.machine_name || 'Tezgah bilgisi yok'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(production.production_date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {production.quantity?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-600">adet</div>
                  </div>
                </div>
                {production.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">{production.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Henüz üretim kaydı yok.</p>
          </div>
        )}
      </div>


      {/* Daily Production Tracking */}
      {dailyProduction.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Günlük Üretim Takibi</h2>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {dailyProduction.map((dp) => (
              <div key={dp.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{dp.machine?.machine_name}</div>
                    <div className="text-xs text-gray-600">{dp.machine?.machine_code}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(dp.production_date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      {dp.shift && ` - ${dp.shift}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      dp.efficiency_rate >= 80 ? 'text-green-600' :
                      dp.efficiency_rate >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {dp.efficiency_rate?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-gray-600">Verimlilik</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Hedef</div>
                    <div className="text-sm font-bold text-gray-900">{dp.capacity_target}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Üretilen</div>
                    <div className="text-sm font-bold text-blue-600">{dp.actual_production}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Fire</div>
                    <div className="text-sm font-bold text-red-600">{dp.defect_count}</div>
                  </div>
                </div>

                {dp.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600 italic">{dp.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Machines Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Factory className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Projede Kullanılan Tezgahlar</h2>
          </div>
          <button
            onClick={() => setShowMachineModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Tezgah Ekle</span>
          </button>
        </div>

        {processMachines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processMachines.map((pm) => (
              <div key={pm.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700">Sıra: {pm.display_order}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditMachine(pm)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveMachine(pm.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      title="Projeden Çıkar"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="font-bold text-gray-900 text-sm">{pm.machine?.machine_name}</div>
                <div className="text-xs text-gray-600">{pm.machine?.machine_code}</div>
                {pm.daily_capacity_target && (
                  <div className="mt-2 text-xs text-gray-700">
                    <span className="font-semibold">Kapasite:</span> {pm.daily_capacity_target}/gün
                  </div>
                )}
                {pm.notes && (
                  <div className="mt-1 text-xs text-gray-600 italic">{pm.notes}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Factory className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Bu projeye henüz tezgah eklenmemiş.</p>
            <button
              onClick={() => setShowMachineModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-800 font-semibold"
            >
              Tezgah Ekle
            </button>
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Project Materials */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Package className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-800">Projede Kullanılan Malzemeler</h2>
            </div>
            <button
              onClick={() => setShowMaterialModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Malzeme Ekle</span>
            </button>
          </div>

          {projectMaterials.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {projectMaterials.map((pm) => (
                <div key={pm.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{pm.warehouse_item?.name}</div>
                      <div className="text-xs text-gray-600">{pm.warehouse_item?.code}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        pm.warehouse_item?.type === 'raw_material' ? 'bg-orange-100 text-orange-800' :
                        pm.warehouse_item?.type === 'semi_finished' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {pm.warehouse_item?.type === 'raw_material' ? 'Hammadde' :
                         pm.warehouse_item?.type === 'semi_finished' ? 'Yarı Mamül' : 'Mamül'}
                      </span>
                      <button
                        onClick={() => handleRemoveMaterial(pm.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        title="Projeden Çıkar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-600">Depodaki Miktar</div>
                      <div className="text-sm font-bold text-gray-900">
                        {pm.warehouse_item?.current_stock?.toFixed(2) || '0.00'} {pm.warehouse_item?.unit}
                      </div>
                    </div>
                    {pm.required_quantity > 0 && (
                      <div>
                        <div className="text-xs text-gray-600">Gerekli Miktar</div>
                        <div className="text-sm font-bold text-blue-600">
                          {pm.required_quantity?.toFixed(2)} {pm.warehouse_item?.unit}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Bu projeye henüz malzeme eklenmemiş.</p>
              <button
                onClick={() => setShowMaterialModal(true)}
                className="mt-4 text-yellow-600 hover:text-yellow-800 font-semibold"
              >
                Malzeme Ekle
              </button>
            </div>
          )}
        </div>

        {/* Project Tools */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Wrench className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-800">Projede Kullanılan Takımlar</h2>
            </div>
            <button
              onClick={() => setShowToolModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Takım Ekle</span>
            </button>
          </div>

          {projectTools.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {projectTools.map((pt) => (
                <div key={pt.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{pt.tool?.tool_name}</div>
                      <div className="text-xs text-gray-600">{pt.tool?.tool_code}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveTool(pt.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      title="Projeden Çıkar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-600">Birim Fiyat</div>
                      <div className="text-sm font-bold text-gray-900">
                        {pt.tool?.unit_price?.toFixed(2) || '0.00'} €
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Kırılma Oranı</div>
                      <div className="text-sm font-bold text-orange-600">
                        {pt.breakage_rate || 0} iş/takım
                      </div>
                    </div>
                  </div>

                  {/* Hesaplanan Maliyet Bilgileri */}
                  {pt.calculated_unit_cost && (
                    <div className="mt-3 pt-3 border-t border-blue-200 bg-blue-50 rounded-md p-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-blue-600 font-semibold">Hesaplanan Parça Başı Maliyet</div>
                          <div className="text-sm font-bold text-blue-700">
                            {pt.calculated_unit_cost?.toFixed(4) || '0.0000'} €
                          </div>
                        </div>
                        {pt.last_calculation_date && (
                          <div>
                            <div className="text-xs text-blue-600 font-semibold">Son Hesaplama</div>
                            <div className="text-xs text-blue-700">
                              {new Date(pt.last_calculation_date).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Bu projeye henüz takım eklenmemiş.</p>
              <button
                onClick={() => setShowToolModal(true)}
                className="mt-4 text-orange-600 hover:text-orange-800 font-semibold"
              >
                Takım Ekle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Assignment Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Müşteri Seç</h3>
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setSelectedCustomerId('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Müşteri Şirketi
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Müşteri Seçiniz</option>
                {customers.map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.customer_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setSelectedCustomerId('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleAssignCustomer}
                disabled={!selectedCustomerId}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Ata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Assignment Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Malzeme Ekle</h3>
              <button
                onClick={() => {
                  setShowMaterialModal(false)
                  setSelectedMaterialId('')
                  setMaterialQuantity('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {warehouseItems.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Projeye eklenecek malzemeyi seçin. Depodaki tüm malzemeler listelenmektedir.
                </p>

                {/* Material Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Malzeme Seçin
                  </label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    <option value="">Malzeme Seçiniz</option>
                    {warehouseItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.code}) - Stok: {item.current_stock?.toFixed(2)} {item.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Required Quantity */}
                {selectedMaterialId && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gerekli Miktar (Opsiyonel)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={materialQuantity}
                      onChange={(e) => setMaterialQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="Bu proje için gereken miktar"
                    />
                  </div>
                )}

                {/* Selected Material Preview */}
                {selectedMaterialId && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Seçilen Malzeme:</div>
                    {(() => {
                      const selected = warehouseItems.find(i => i.id === selectedMaterialId)
                      return selected ? (
                        <div>
                          <div className="font-bold text-gray-900">{selected.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Kod: {selected.code} |
                            Tip: {selected.type === 'raw_material' ? 'Hammadde' :
                                  selected.type === 'semi_finished' ? 'Yarı Mamül' : 'Mamül'} |
                            Stok: {selected.current_stock?.toFixed(2)} {selected.unit}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Depoda malzeme bulunamadı.</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMaterialModal(false)
                  setSelectedMaterialId('')
                  setMaterialQuantity('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleAddMaterial}
                disabled={!selectedMaterialId}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Malzemeyi Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Assignment Modal */}
      {showMachineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Tezgah Ekle</h3>
              <button
                onClick={() => {
                  setShowMachineModal(false)
                  setSelectedMachineId('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {availableMachines.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Projeye eklenecek tezgahı seçin.
                </p>
                {availableMachines.map((machine: any) => {
                  const isAssignedToOther = machine.assignedProject && !machine.isAssignedToThisProject
                  const isDisabled = isAssignedToOther

                  return (
                    <div
                      key={machine.id}
                      onClick={() => !isDisabled && setSelectedMachineId(machine.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isDisabled
                          ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                          : selectedMachineId === machine.id
                          ? 'border-blue-500 bg-blue-50 cursor-pointer'
                          : 'border-gray-200 hover:border-blue-300 bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">{machine.machine_name}</div>
                          <div className="text-sm text-gray-600">{machine.machine_code}</div>
                          {machine.location && (
                            <div className="text-xs text-gray-500 mt-1">📍 {machine.location}</div>
                          )}
                          {isAssignedToOther && (
                            <div className="text-xs text-red-600 font-semibold mt-2">
                              ⚠️ Başka projeye atanmış: {machine.assignedProject?.project_name || 'Bilinmeyen'}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            machine.status === 'active' ? 'bg-green-100 text-green-800' :
                            machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {machine.status === 'active' ? 'Çalışıyor' :
                             machine.status === 'maintenance' ? 'Bakımda' : 'Çalışmıyor'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Factory className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Tezgah bulunamadı.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Önce Tezgah Yönetimi sayfasından tezgah oluşturun.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMachineModal(false)
                  setSelectedMachineId('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleAssignMachine}
                disabled={!selectedMachineId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Tezgahı Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool Assignment Modal */}
      {showToolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Takım Ekle</h3>
              <button
                onClick={() => {
                  setShowToolModal(false)
                  setSelectedToolId('')
                  setToolBreakageRate('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {availableTools.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Projeye eklenecek takımı seçin ve kırılma oranını girin.
                </p>

                {/* Tool Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Takım Seçin <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedToolId}
                    onChange={(e) => setSelectedToolId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Takım Seçiniz</option>
                    {availableTools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.tool_name} ({tool.tool_code}) - {tool.unit_price?.toFixed(2) || '0.00'} €
                      </option>
                    ))}
                  </select>
                </div>

                {/* Breakage Rate */}
                {selectedToolId && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kırılma Oranı
                    </label>
                    <input
                      type="number"
                      value={toolBreakageRate}
                      onChange={(e) => setToolBreakageRate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Kaç işte bir kırılıyor? (Örn: 1000)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Bu takım ortalama kaç iş sonunda değiştirilir?
                    </p>
                  </div>
                )}

                {/* Selected Tool Preview */}
                {selectedToolId && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Seçilen Takım:</div>
                    {(() => {
                      const selected = availableTools.find(t => t.id === selectedToolId)
                      return selected ? (
                        <div>
                          <div className="font-bold text-gray-900">{selected.tool_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Kod: {selected.tool_code} |
                            Birim Fiyat: {selected.unit_price?.toFixed(2) || '0.00'} €
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Takımhanede takım bulunamadı.</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowToolModal(false)
                  setSelectedToolId('')
                  setToolBreakageRate('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleAddTool}
                disabled={!selectedToolId}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Takımı Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Edit Modal */}
      {showMachineEditModal && editingMachine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Tezgah Bilgilerini Düzenle</h3>
              <button
                onClick={() => {
                  setShowMachineEditModal(false)
                  setEditingMachine(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-bold text-gray-900">{editingMachine.machine?.machine_name}</div>
                <div className="text-sm text-gray-600">{editingMachine.machine?.machine_code}</div>
              </div>

              {/* Daily Capacity Target */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Günlük Kapasite Hedefi
                </label>
                <input
                  type="number"
                  value={machineEditForm.daily_capacity_target}
                  onChange={(e) => setMachineEditForm({ ...machineEditForm, daily_capacity_target: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: 1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bu tezgahın günlük üretim hedefi (adet/gün)
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={machineEditForm.notes}
                  onChange={(e) => setMachineEditForm({ ...machineEditForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Ek notlar veya açıklamalar..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMachineEditModal(false)
                  setEditingMachine(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleUpdateMachine}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

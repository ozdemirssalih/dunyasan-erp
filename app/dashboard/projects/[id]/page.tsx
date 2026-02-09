'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, Factory, Package, Building2, TrendingUp, Plus, Users } from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [machines, setMachines] = useState<any[]>([])
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])
  const [projectMaterials, setProjectMaterials] = useState<any[]>([])
  const [productions, setProductions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

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
      const { data: projectData } = await supabase
        .from('projects')
        .select('*, customer_company:customer_companies(id, customer_name, contact_person, phone, email)')
        .eq('id', projectId)
        .eq('company_id', finalCompanyId)
        .single()

      console.log('✅ Project loaded:', projectData?.project_name)
      setProject(projectData)
      setCustomer(projectData?.customer_company)

      // Load productions (for progress calculation)
      const { data: productionsData } = await supabase
        .from('production_outputs')
        .select('*, machine:machines(machine_name)')
        .eq('project_id', projectId)
        .order('production_date', { ascending: false })

      console.log('✅ Productions loaded:', productionsData?.length || 0)
      setProductions(productionsData || [])

      // Load machines
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('project_id', projectId)
        .eq('company_id', finalCompanyId)

      console.log('✅ Machines loaded:', machinesData?.length || 0)

      const machinesWithStats = await Promise.all(
        (machinesData || []).map(async (machine) => {
          // Bu tezgaha verilen malzemeler (tüm kayıtlar - tezgah zaten projeye atanmış)
          const { data: givenMaterials, error: givenError } = await supabase
            .from('production_to_machine_transfers')
            .select('quantity')
            .eq('machine_id', machine.id)

          if (givenError) console.error('Error loading given materials:', givenError)

          const totalGiven = givenMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // Bu tezgahta üretilen ürünler (tüm kayıtlar)
          const { data: producedItems, error: producedError } = await supabase
            .from('production_outputs')
            .select('quantity')
            .eq('machine_id', machine.id)

          if (producedError) console.error('Error loading produced items:', producedError)

          const totalProduced = producedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
          const efficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

          return { ...machine, totalGiven, totalProduced, efficiency }
        })
      )

      setMachines(machinesWithStats)

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

      // Load available machines (no project or this project)
      const { data: availableMachinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', finalCompanyId)
        .or(`project_id.is.null,project_id.eq.${projectId}`)
        .order('machine_name', { ascending: true })

      console.log('✅ Available machines loaded:', availableMachinesData?.length || 0)
      setAvailableMachines(availableMachinesData || [])

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
    if (!selectedMachineId) return

    try {
      const { error } = await supabase
        .from('machines')
        .update({ project_id: projectId })
        .eq('id', selectedMachineId)

      if (error) throw error

      // Reload data
      await loadData()
      setShowMachineModal(false)
      setSelectedMachineId('')
    } catch (error) {
      console.error('❌ Error assigning machine:', error)
      alert('Tezgah atanırken hata oluştu!')
    }
  }

  const handleRemoveMachine = async (machineId: string) => {
    if (!confirm('Bu tezgahı projeden çıkarmak istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('machines')
        .update({ project_id: null })
        .eq('id', machineId)

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
          <Factory className="w-8 h-8 text-green-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{machines.length}</div>
          <div className="text-gray-600">Bu Projede Çalışan Tezgah</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-500">
          <Package className="w-8 h-8 text-yellow-600 mb-2" />
          <div className="text-3xl font-bold text-gray-900">{projectMaterials.length}</div>
          <div className="text-gray-600">Projede Kullanılan Malzeme</div>
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machines */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Factory className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-800">Projede Çalışan Tezgahlar</h2>
            </div>
            <button
              onClick={() => setShowMachineModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Tezgah Ekle</span>
            </button>
          </div>

          {machines.length > 0 ? (
            <div className="space-y-4">
              {machines.map((machine) => (
                <div key={machine.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{machine.machine_name}</div>
                      <div className="text-sm text-gray-600">{machine.machine_code}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        machine.status === 'active' ? 'bg-green-100 text-green-800' :
                        machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {machine.status === 'active' ? 'Çalışıyor' :
                         machine.status === 'maintenance' ? 'Bakımda' : 'Çalışmıyor'}
                      </span>
                      <button
                        onClick={() => handleRemoveMachine(machine.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        title="Projeden Çıkar"
                      >
                        ✕
                      </button>
                    </div>
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
                  Projeye atanacak tezgahı seçin. Sadece başka projeye atanmamış tezgahlar listelenmektedir.
                </p>
                {availableMachines.map((machine) => (
                  <div
                    key={machine.id}
                    onClick={() => setSelectedMachineId(machine.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedMachineId === machine.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">{machine.machine_name}</div>
                        <div className="text-sm text-gray-600">{machine.machine_code}</div>
                        {machine.location && (
                          <div className="text-xs text-gray-500 mt-1">📍 {machine.location}</div>
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
                        {machine.project_id === projectId && (
                          <span className="text-xs text-green-600 font-semibold">
                            ✓ Bu projede
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Factory className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Atanabilir tezgah bulunamadı.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Tüm tezgahlar başka projelere atanmış olabilir.
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
    </div>
  )
}

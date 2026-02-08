'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { FolderKanban, Plus, Calendar, Building2, Clock, AlertCircle, CheckCircle2, Pause, X, Edit, Trash2, Eye, Package, Wrench, Scissors, Factory, Users } from 'lucide-react'

interface CustomerCompany {
  id: string
  customer_name: string
  contact_person?: string
  phone?: string
  email?: string
}

interface Project {
  id: string
  project_name: string
  project_code?: string
  description?: string
  customer_company_id?: string
  customer_company?: CustomerCompany
  scope_duration?: number
  start_date: string
  end_date?: string
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  notes?: string
  created_at: string
  parts_count?: number
}

interface ProjectPart {
  id: string
  project_id: string
  part_name: string
  part_code: string
  quantity: number
  unit: string
  notes?: string
}

interface ProjectOperation {
  id: string
  part_id: string
  operation_name: string
  operation_order: number
  machine_id?: string
  machine_name?: string
  estimated_time?: number
  notes?: string
}

interface ProjectMaterial {
  id: string
  part_id: string
  material_id: string
  material_name?: string
  quantity: number
  unit: string
  notes?: string
}

interface ProjectTool {
  id: string
  part_id: string
  tool_name: string
  tool_code?: string
  tool_type?: string
  quantity: number
  notes?: string
}

interface ProjectCutter {
  id: string
  part_id: string
  cutter_name: string
  cutter_code?: string
  cutter_type?: string
  diameter?: number
  diameter_unit: string
  quantity: number
  notes?: string
}

interface ProductionMaterial {
  id: string
  item_name: string
  unit: string
  current_stock: number
}

interface Machine {
  id: string
  machine_name: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<CustomerCompany[]>([])
  const [productionMaterials, setProductionMaterials] = useState<ProductionMaterial[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Project Detail Add Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showAddMachineModal, setShowAddMachineModal] = useState(false)
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false)

  // Selection Lists
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([])
  const [availableMachines, setAvailableMachines] = useState<any[]>([])
  const [availableWarehouseItems, setAvailableWarehouseItems] = useState<any[]>([])
  const [availableEquipment, setAvailableEquipment] = useState<any[]>([])

  // Add Forms
  const [addForm, setAddForm] = useState({
    customer_id: '',
    machine_id: '',
    material_id: '',
    material_quantity: '',
    product_id: '',
    product_quantity: '',
    equipment_id: ''
  })

  // Project Detail Data
  const [projectDetailData, setProjectDetailData] = useState<any>({
    customers: [],
    machines: [],
    materials: [],
    products: [],
    equipment: [],
    productions: [],
    shipments: []
  })

  // Detail tabs and data
  const [detailTab, setDetailTab] = useState<'parts' | 'info' | 'production'>('parts')
  const [projectParts, setProjectParts] = useState<ProjectPart[]>([])
  const [selectedPart, setSelectedPart] = useState<ProjectPart | null>(null)
  const [partOperations, setPartOperations] = useState<ProjectOperation[]>([])
  const [partMaterials, setPartMaterials] = useState<ProjectMaterial[]>([])
  const [partTools, setPartTools] = useState<ProjectTool[]>([])
  const [partCutters, setPartCutters] = useState<ProjectCutter[]>([])
  const [projectProductionMaterials, setProjectProductionMaterials] = useState<any[]>([])
  const [projectProductionOutputs, setProjectProductionOutputs] = useState<any[]>([])

  // Forms
  const [projectForm, setProjectForm] = useState({
    project_name: '',
    customer_company_id: '',
    scope_duration: '',
    start_date: '',
    status: 'planning' as const,
    notes: ''
  })

  const [customerForm, setCustomerForm] = useState({
    customer_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  })

  const [partForm, setPartForm] = useState({
    part_name: '',
    part_code: '',
    quantity: '1',
    unit: 'adet',
    notes: ''
  })

  const [showPartModal, setShowPartModal] = useState(false)
  const [showOperationModal, setShowOperationModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [showToolModal, setShowToolModal] = useState(false)
  const [showCutterModal, setShowCutterModal] = useState(false)

  const [operationForm, setOperationForm] = useState({
    operation_name: '',
    operation_order: '1',
    machine_id: '',
    estimated_time: '',
    notes: ''
  })

  const [materialForm, setMaterialForm] = useState({
    material_id: '',
    quantity: '',
    unit: '',
    notes: ''
  })

  const [toolForm, setToolForm] = useState({
    tool_name: '',
    tool_code: '',
    tool_type: '',
    quantity: '1',
    notes: ''
  })

  const [cutterForm, setCutterForm] = useState({
    cutter_name: '',
    cutter_code: '',
    cutter_type: '',
    diameter: '',
    diameter_unit: 'mm',
    quantity: '1',
    notes: ''
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      // Profil bilgisini çek
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      // Eğer profilde company_id yoksa, Dünyasan şirketini kullan
      if (!finalCompanyId) {
        console.log('No company_id in profile, fetching Dünyasan company...')

        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          console.log('Using Dünyasan company ID:', finalCompanyId)

          // Profili güncelle
          await supabase
            .from('profiles')
            .update({ company_id: finalCompanyId })
            .eq('id', user.id)

          console.log('Profile updated with company_id')
        } else {
          // Hiç şirket yoksa, ilk şirketi kullan
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            console.log('Using first company ID:', finalCompanyId)

            await supabase
              .from('profiles')
              .update({ company_id: finalCompanyId })
              .eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) {
        alert('⚠️ Şirket bilgisi bulunamadı. Lütfen önce bir şirket oluşturun.')
        return
      }

      setCompanyId(finalCompanyId)

      await Promise.all([
        loadProjects(finalCompanyId),
        loadCustomers(finalCompanyId),
        loadProductionMaterials(finalCompanyId),
        loadMachines(finalCompanyId)
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
      alert('❌ Veri yüklenirken hata oluştu: ' + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customer_company:customer_companies(id, customer_name, contact_person, phone, email)
        `)
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error

      const projectsWithCounts = await Promise.all(
        (data || []).map(async (project) => {
          const { count } = await supabase
            .from('project_parts')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)

          return {
            ...project,
            parts_count: count || 0
          }
        })
      )

      setProjects(projectsWithCounts)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadCustomers = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_companies')
        .select('*')
        .eq('company_id', cid)
        .order('customer_name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const loadProductionMaterials = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('production_inventory')
        .select(`
          id,
          item_id,
          current_stock,
          item:warehouse_items(name, unit)
        `)
        .eq('company_id', cid)
        .eq('item_type', 'raw_material')

      if (error) throw error

      const materials = (data || []).map((item: any) => ({
        id: item.item_id,
        item_name: item.item?.name || 'Bilinmeyen',
        unit: item.item?.unit || 'adet',
        current_stock: item.current_stock
      }))

      setProductionMaterials(materials)
    } catch (error) {
      console.error('Error loading production materials:', error)
    }
  }

  const loadProjectDetail = async (projectId: string) => {
    try {
      // Müşteriler
      const { data: customersData } = await supabase
        .from('project_customers')
        .select('customer:customers(id, customer_name, customer_code, contact_person, phone)')
        .eq('project_id', projectId)

      // Tezgahlar
      const { data: machinesData } = await supabase
        .from('project_machines')
        .select('machine:machines(id, machine_name, machine_code, status)')
        .eq('project_id', projectId)

      // Hammaddeler
      const { data: materialsData } = await supabase
        .from('project_required_materials')
        .select('material_id, quantity_needed, item:warehouse_items(id, name, code, unit)')
        .eq('project_id', projectId)

      // Mamüller
      const { data: productsData } = await supabase
        .from('project_target_products')
        .select('product_id, quantity_target, quantity_produced, item:warehouse_items(id, name, code, unit)')
        .eq('project_id', projectId)

      // Ekipmanlar
      const { data: equipmentData } = await supabase
        .from('project_equipment')
        .select('equipment:equipment(id, equipment_name, equipment_code, equipment_type, status)')
        .eq('project_id', projectId)

      setProjectDetailData({
        customers: customersData?.map((c: any) => c.customer) || [],
        machines: machinesData?.map((m: any) => m.machine) || [],
        materials: materialsData?.map((m: any) => ({
          id: m.material_id,
          item_name: m.item?.name || '',
          item_code: m.item?.code || '',
          quantity_needed: m.quantity_needed,
          unit: m.item?.unit || ''
        })) || [],
        products: productsData?.map((p: any) => ({
          id: p.product_id,
          item_name: p.item?.name || '',
          item_code: p.item?.code || '',
          quantity_target: p.quantity_target,
          quantity_produced: p.quantity_produced,
          unit: p.item?.unit || ''
        })) || [],
        equipment: equipmentData?.map((e: any) => e.equipment) || [],
        productions: [],
        shipments: []
      })
    } catch (error) {
      console.error('Error loading project details:', error)
    }
  }

  const loadAvailableData = async () => {
    try {
      // Müşteriler
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
      setAvailableCustomers(customersData || [])

      // Tezgahlar
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', companyId)
      setAvailableMachines(machinesData || [])

      // Depo stok kalemleri
      const { data: warehouseData } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('company_id', companyId)
      setAvailableWarehouseItems(warehouseData || [])

      // Ekipmanlar (takımhane - tools tablosu)
      const { data: equipmentData } = await supabase
        .from('equipment')
        .select('*')
        .eq('company_id', companyId)
      setAvailableEquipment(equipmentData || [])
    } catch (error) {
      console.error('Error loading available data:', error)
    }
  }

  const handleAddCustomer = async () => {
    if (!selectedProject || !addForm.customer_id) return
    try {
      const { error } = await supabase
        .from('project_customers')
        .insert({
          project_id: selectedProject.id,
          customer_id: addForm.customer_id
        })
      if (error) throw error
      await loadProjectDetail(selectedProject.id)
      setShowAddCustomerModal(false)
      setAddForm({ ...addForm, customer_id: '' })
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleAddMachine = async () => {
    if (!selectedProject || !addForm.machine_id) return
    try {
      const { error } = await supabase
        .from('project_machines')
        .insert({
          project_id: selectedProject.id,
          machine_id: addForm.machine_id
        })
      if (error) throw error
      await loadProjectDetail(selectedProject.id)
      setShowAddMachineModal(false)
      setAddForm({ ...addForm, machine_id: '' })
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleAddMaterial = async () => {
    if (!selectedProject || !addForm.material_id || !addForm.material_quantity) return
    try {
      const { error } = await supabase
        .from('project_required_materials')
        .insert({
          project_id: selectedProject.id,
          material_id: addForm.material_id,
          quantity_needed: parseFloat(addForm.material_quantity)
        })
      if (error) throw error
      await loadProjectDetail(selectedProject.id)
      setShowAddMaterialModal(false)
      setAddForm({ ...addForm, material_id: '', material_quantity: '' })
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleAddProduct = async () => {
    if (!selectedProject || !addForm.product_id || !addForm.product_quantity) return
    try {
      const { error } = await supabase
        .from('project_target_products')
        .insert({
          project_id: selectedProject.id,
          product_id: addForm.product_id,
          quantity_target: parseFloat(addForm.product_quantity),
          quantity_produced: 0
        })
      if (error) throw error
      await loadProjectDetail(selectedProject.id)
      setShowAddProductModal(false)
      setAddForm({ ...addForm, product_id: '', product_quantity: '' })
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleAddEquipment = async () => {
    if (!selectedProject || !addForm.equipment_id) return
    try {
      const { error } = await supabase
        .from('project_equipment')
        .insert({
          project_id: selectedProject.id,
          equipment_id: addForm.equipment_id
        })
      if (error) throw error
      await loadProjectDetail(selectedProject.id)
      setShowAddEquipmentModal(false)
      setAddForm({ ...addForm, equipment_id: '' })
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const loadMachines = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id, machine_name')
        .eq('company_id', cid)
        .eq('status', 'active')
        .order('machine_name')

      if (error) throw error
      setMachines(data || [])
    } catch (error) {
      console.error('Error loading machines:', error)
    }
  }

  const loadProjectParts = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_parts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at')

      if (error) throw error
      setProjectParts(data || [])
    } catch (error) {
      console.error('Error loading project parts:', error)
    }
  }

  const loadProjectProduction = async (projectId: string) => {
    try {
      // Projedeki hammadde kullanımları
      const { data: materials, error: matError } = await supabase
        .from('production_material_assignments')
        .select(`
          *,
          machine:machines(machine_name, machine_code),
          item:warehouse_items(name, code, unit),
          part:project_parts(part_name, part_code),
          assigned_by_user:profiles!production_material_assignments_assigned_by_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .order('assigned_date', { ascending: false })

      if (matError) throw matError
      setProjectProductionMaterials(materials || [])

      // Projedeki üretim çıktıları
      const { data: outputs, error: outError } = await supabase
        .from('production_outputs')
        .select(`
          *,
          machine:machines(machine_name, machine_code),
          output_item:warehouse_items!production_outputs_output_item_id_fkey(name, code, unit),
          part:project_parts(part_name, part_code),
          operator:profiles!production_outputs_operator_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .order('production_date', { ascending: false })

      if (outError) throw outError
      setProjectProductionOutputs(outputs || [])
    } catch (error) {
      console.error('Error loading project production:', error)
    }
  }

  const loadPartDetails = async (partId: string) => {
    try {
      // Load operations
      const { data: ops, error: opsError } = await supabase
        .from('project_operations')
        .select(`
          *,
          machine:machines(machine_name)
        `)
        .eq('part_id', partId)
        .order('operation_order')

      if (opsError) throw opsError
      setPartOperations((ops || []).map(op => ({
        ...op,
        machine_name: op.machine?.machine_name
      })))

      // Load materials
      const { data: mats, error: matsError } = await supabase
        .from('project_materials')
        .select(`
          *,
          material:warehouse_items(name, unit)
        `)
        .eq('part_id', partId)

      if (matsError) throw matsError
      setPartMaterials((mats || []).map(mat => ({
        ...mat,
        material_name: mat.material?.name,
        unit: mat.unit || mat.material?.unit || 'adet'
      })))

      // Load tools
      const { data: tools, error: toolsError } = await supabase
        .from('project_tools')
        .select('*')
        .eq('part_id', partId)

      if (toolsError) throw toolsError
      setPartTools(tools || [])

      // Load cutters
      const { data: cutters, error: cuttersError } = await supabase
        .from('project_cutters')
        .select('*')
        .eq('part_id', partId)

      if (cuttersError) throw cuttersError
      setPartCutters(cutters || [])
    } catch (error) {
      console.error('Error loading part details:', error)
    }
  }

  const handleSaveProject = async () => {
    if (!projectForm.project_name || !projectForm.start_date) {
      alert('Lütfen proje adı ve başlangıç tarihini girin')
      return
    }

    try {
      const projectData = {
        company_id: companyId,
        project_name: projectForm.project_name,
        customer_company_id: projectForm.customer_company_id && projectForm.customer_company_id.trim() !== '' ? projectForm.customer_company_id : null,
        scope_duration: projectForm.scope_duration ? parseInt(projectForm.scope_duration) : null,
        start_date: projectForm.start_date,
        status: projectForm.status,
        notes: projectForm.notes,
        created_by: currentUserId
      }

      if (selectedProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', selectedProject.id)

        if (error) throw error
        alert('✅ Proje güncellendi!')
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData)

        if (error) throw error
        alert('✅ Proje eklendi!')
      }

      setShowProjectModal(false)
      resetProjectForm()
      loadProjects(companyId)
    } catch (error: any) {
      console.error('Error saving project:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveCustomer = async () => {
    if (!customerForm.customer_name) {
      alert('Lütfen firma adını girin')
      return
    }

    try {
      const { error } = await supabase
        .from('customer_companies')
        .insert({
          company_id: companyId,
          customer_name: customerForm.customer_name.trim(),
          contact_person: customerForm.contact_person.trim() || null,
          phone: customerForm.phone.trim() || null,
          email: customerForm.email.trim() || null,
          address: customerForm.address.trim() || null,
          notes: customerForm.notes.trim() || null
        })

      if (error) throw error

      alert('✅ Müşteri firma eklendi!')
      setShowCustomerModal(false)
      resetCustomerForm()
      loadCustomers(companyId)
    } catch (error: any) {
      console.error('Error saving customer:', error)
      alert('❌ Hata: ' + (error.message || 'Müşteri eklenirken bir hata oluştu'))
    }
  }

  const handleSavePart = async () => {
    if (!partForm.part_name || !partForm.part_code || !selectedProject) {
      alert('Lütfen tüm gerekli alanları doldurun')
      return
    }

    try {
      const { error } = await supabase
        .from('project_parts')
        .insert({
          project_id: selectedProject.id,
          part_name: partForm.part_name,
          part_code: partForm.part_code,
          quantity: parseInt(partForm.quantity),
          unit: partForm.unit,
          notes: partForm.notes
        })

      if (error) throw error

      alert('✅ Parça eklendi!')
      setShowPartModal(false)
      resetPartForm()
      loadProjectParts(selectedProject.id)
      loadProjects(companyId)
    } catch (error: any) {
      console.error('Error saving part:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveOperation = async () => {
    if (!operationForm.operation_name || !selectedPart) {
      alert('Lütfen operasyon adını girin')
      return
    }

    try {
      const { error } = await supabase
        .from('project_operations')
        .insert({
          part_id: selectedPart.id,
          operation_name: operationForm.operation_name,
          operation_order: parseInt(operationForm.operation_order),
          machine_id: operationForm.machine_id && operationForm.machine_id.trim() !== '' ? operationForm.machine_id : null,
          estimated_time: operationForm.estimated_time ? parseInt(operationForm.estimated_time) : null,
          notes: operationForm.notes
        })

      if (error) throw error

      alert('✅ Operasyon eklendi!')
      setShowOperationModal(false)
      resetOperationForm()
      loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error saving operation:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveMaterial = async () => {
    if (!materialForm.material_id || materialForm.material_id.trim() === '' || !materialForm.quantity || !selectedPart) {
      alert('Lütfen tüm gerekli alanları doldurun')
      return
    }

    const selectedMaterial = productionMaterials.find(m => m.id === materialForm.material_id)
    if (!selectedMaterial) {
      alert('Seçilen malzeme bulunamadı')
      return
    }

    try {
      const { error } = await supabase
        .from('project_materials')
        .insert({
          part_id: selectedPart.id,
          material_id: materialForm.material_id,
          quantity: parseFloat(materialForm.quantity),
          unit: materialForm.unit || selectedMaterial.unit,
          notes: materialForm.notes
        })

      if (error) throw error

      alert('✅ Hammadde eklendi!')
      setShowMaterialModal(false)
      resetMaterialForm()
      loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error saving material:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveTool = async () => {
    if (!toolForm.tool_name || !selectedPart) {
      alert('Lütfen takım adını girin')
      return
    }

    try {
      const { error } = await supabase
        .from('project_tools')
        .insert({
          part_id: selectedPart.id,
          tool_name: toolForm.tool_name,
          tool_code: toolForm.tool_code,
          tool_type: toolForm.tool_type,
          quantity: parseInt(toolForm.quantity),
          notes: toolForm.notes
        })

      if (error) throw error

      alert('✅ Takım eklendi!')
      setShowToolModal(false)
      resetToolForm()
      loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error saving tool:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveCutter = async () => {
    if (!cutterForm.cutter_name || !selectedPart) {
      alert('Lütfen kater adını girin')
      return
    }

    try {
      const { error } = await supabase
        .from('project_cutters')
        .insert({
          part_id: selectedPart.id,
          cutter_name: cutterForm.cutter_name,
          cutter_code: cutterForm.cutter_code,
          cutter_type: cutterForm.cutter_type,
          diameter: cutterForm.diameter ? parseFloat(cutterForm.diameter) : null,
          diameter_unit: cutterForm.diameter_unit,
          quantity: parseInt(cutterForm.quantity),
          notes: cutterForm.notes
        })

      if (error) throw error

      alert('✅ Kater eklendi!')
      setShowCutterModal(false)
      resetCutterForm()
      loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error saving cutter:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Bu projeyi silmek istediğinizden emin misiniz? Tüm parçalar, operasyonlar ve ilişkili veriler silinecektir.')) return

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      alert('✅ Proje silindi!')
      loadProjects(companyId)
    } catch (error: any) {
      console.error('Error deleting project:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeletePart = async (partId: string) => {
    if (!confirm('Bu parçayı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_parts')
        .delete()
        .eq('id', partId)

      if (error) throw error

      alert('✅ Parça silindi!')
      if (selectedProject) {
        loadProjectParts(selectedProject.id)
        loadProjects(companyId)
      }
      setSelectedPart(null)
    } catch (error: any) {
      console.error('Error deleting part:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteOperation = async (opId: string) => {
    if (!confirm('Bu operasyonu silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_operations')
        .delete()
        .eq('id', opId)

      if (error) throw error

      if (selectedPart) loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error deleting operation:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteMaterial = async (matId: string) => {
    if (!confirm('Bu hammaddeyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_materials')
        .delete()
        .eq('id', matId)

      if (error) throw error

      if (selectedPart) loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error deleting material:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('Bu takımı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_tools')
        .delete()
        .eq('id', toolId)

      if (error) throw error

      if (selectedPart) loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error deleting tool:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteCutter = async (cutterId: string) => {
    if (!confirm('Bu kateri silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('project_cutters')
        .delete()
        .eq('id', cutterId)

      if (error) throw error

      if (selectedPart) loadPartDetails(selectedPart.id)
    } catch (error: any) {
      console.error('Error deleting cutter:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const openProjectModal = (project?: Project) => {
    if (project) {
      setSelectedProject(project)
      setProjectForm({
        project_name: project.project_name,
        customer_company_id: project.customer_company_id || '',
        scope_duration: project.scope_duration?.toString() || '',
        start_date: project.start_date,
        status: project.status as any,
        notes: project.notes || ''
      })
    } else {
      resetProjectForm()
    }
    setShowProjectModal(true)
  }

  const openDetailsModal = async (project: Project) => {
    setSelectedProject(project)
    setDetailTab('parts')
    await Promise.all([
      loadProjectParts(project.id),
      loadProjectProduction(project.id)
    ])
    setShowDetailsModal(true)
  }

  const selectPart = async (part: ProjectPart) => {
    setSelectedPart(part)
    await loadPartDetails(part.id)
  }

  const resetProjectForm = () => {
    setSelectedProject(null)
    setProjectForm({
      project_name: '',
      customer_company_id: '',
      scope_duration: '',
      start_date: '',
      status: 'planning',
      notes: ''
    })
  }

  const resetCustomerForm = () => {
    setCustomerForm({
      customer_name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    })
  }

  const resetPartForm = () => {
    setPartForm({
      part_name: '',
      part_code: '',
      quantity: '1',
      unit: 'adet',
      notes: ''
    })
  }

  const resetOperationForm = () => {
    setOperationForm({
      operation_name: '',
      operation_order: '1',
      machine_id: '',
      estimated_time: '',
      notes: ''
    })
  }

  const resetMaterialForm = () => {
    setMaterialForm({
      material_id: '',
      quantity: '',
      unit: '',
      notes: ''
    })
  }

  const resetToolForm = () => {
    setToolForm({
      tool_name: '',
      tool_code: '',
      tool_type: '',
      quantity: '1',
      notes: ''
    })
  }

  const resetCutterForm = () => {
    setCutterForm({
      cutter_name: '',
      cutter_code: '',
      cutter_type: '',
      diameter: '',
      diameter_unit: 'mm',
      quantity: '1',
      notes: ''
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning': return <AlertCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'completed': return <CheckCircle2 className="w-4 h-4" />
      case 'on_hold': return <Pause className="w-4 h-4" />
      case 'cancelled': return <X className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning': return 'Planlama'
      case 'in_progress': return 'Devam Ediyor'
      case 'completed': return 'Tamamlandı'
      case 'on_hold': return 'Beklemede'
      case 'cancelled': return 'İptal Edildi'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Proje Yönetimi</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomerModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              Müşteri Ekle
            </button>
            <button
              onClick={() => openProjectModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yeni Proje
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Toplam Proje</div>
            <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 mb-1">Devam Eden</div>
            <div className="text-2xl font-bold text-blue-900">
              {projects.filter(p => p.status === 'in_progress').length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 mb-1">Tamamlanan</div>
            <div className="text-2xl font-bold text-green-900">
              {projects.filter(p => p.status === 'completed').length}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-sm text-yellow-600 mb-1">Beklemede</div>
            <div className="text-2xl font-bold text-yellow-900">
              {projects.filter(p => p.status === 'on_hold').length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 mb-1">Müşteri Sayısı</div>
            <div className="text-2xl font-bold text-purple-900">{customers.length}</div>
          </div>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{project.project_name}</h3>
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                  {getStatusIcon(project.status)}
                  {getStatusText(project.status)}
                </div>
              </div>
            </div>

            {project.customer_company && (
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <Building2 className="w-4 h-4" />
                <span>{project.customer_company.customer_name}</span>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Başlangıç: {new Date(project.start_date).toLocaleDateString('tr-TR')}</span>
              </div>
              {project.scope_duration && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Süre: {project.scope_duration} gün</span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-600">Parça Sayısı</div>
              <div className="text-xl font-bold text-gray-900">{project.parts_count || 0}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSelectedProject(project)
                  await loadProjectDetail(project.id)
                  setShowProjectDetailModal(true)
                }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
              >
                <Eye className="w-4 h-4" />
                Detay
              </button>
              <button
                onClick={() => openProjectModal(project)}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <FolderKanban className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Henüz proje eklenmemiş</p>
            <button
              onClick={() => openProjectModal()}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              İlk Projeyi Ekle
            </button>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedProject ? 'Projeyi Düzenle' : 'Yeni Proje Ekle'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proje Adı *
                </label>
                <input
                  type="text"
                  value={projectForm.project_name}
                  onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: ABC Projesi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müşteri Firma
                </label>
                <div className="flex gap-2">
                  <select
                    value={projectForm.customer_company_id}
                    onChange={(e) => setProjectForm({ ...projectForm, customer_company_id: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setShowProjectModal(false)
                      setShowCustomerModal(true)
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    value={projectForm.start_date}
                    onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kapsam Süresi (Gün)
                  </label>
                  <input
                    type="number"
                    value={projectForm.scope_duration}
                    onChange={(e) => setProjectForm({ ...projectForm, scope_duration: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="planning">Planlama</option>
                  <option value="in_progress">Devam Ediyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="on_hold">Beklemede</option>
                  <option value="cancelled">İptal Edildi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Proje hakkında notlar..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowProjectModal(false)
                  resetProjectForm()
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveProject}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedProject ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Müşteri Firma Ekle</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firma Adı *
                </label>
                <input
                  type="text"
                  value={customerForm.customer_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: ABC Ltd. Şti."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İlgili Kişi
                </label>
                <input
                  type="text"
                  value={customerForm.contact_person}
                  onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ahmet Yılmaz"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0532 XXX XX XX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ornek@firma.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Firma adresi..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Müşteri hakkında notlar..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  resetCustomerForm()
                  if (selectedProject) {
                    setShowProjectModal(true)
                  }
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveCustomer}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedProject.project_name}</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedPart(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setDetailTab('parts')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    detailTab === 'parts'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Parçalar
                  </div>
                </button>
                <button
                  onClick={() => setDetailTab('production')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    detailTab === 'production'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4" />
                    Üretim Kayıtları
                  </div>
                </button>
                <button
                  onClick={() => setDetailTab('info')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    detailTab === 'info'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Proje Bilgileri
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {detailTab === 'parts' && (
              <div className="flex" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                {/* Parts List - Left Side */}
                <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setShowPartModal(true)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Parça
                  </button>
                </div>

                <div className="p-4 space-y-2">
                  {projectParts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Henüz parça eklenmemiş</p>
                    </div>
                  )}

                  {projectParts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => selectPart(part)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedPart?.id === part.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-bold text-gray-900">{part.part_name}</div>
                          <div className="text-sm text-gray-600">Kod: {part.part_code}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePart(part.id)
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        Adet: {part.quantity} {part.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part Details - Right Side */}
              <div className="flex-1 overflow-y-auto">
                {selectedPart ? (
                  <div className="p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedPart.part_name}</h3>
                      <div className="text-sm text-gray-600">
                        <p>Kod: {selectedPart.part_code}</p>
                        <p>Adet: {selectedPart.quantity} {selectedPart.unit}</p>
                      </div>
                    </div>

                    {/* Operasyonlar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Factory className="w-5 h-5 text-blue-600" />
                          <h4 className="font-bold text-gray-900">Operasyonlar</h4>
                        </div>
                        <button
                          onClick={() => setShowOperationModal(true)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {partOperations.length === 0 && (
                          <p className="text-sm text-gray-500">Henüz operasyon eklenmemiş</p>
                        )}
                        {partOperations.map((op) => (
                          <div key={op.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">
                                {op.operation_order}. {op.operation_name}
                              </div>
                              {op.machine_name && (
                                <div className="text-sm text-gray-600">Tezgah: {op.machine_name}</div>
                              )}
                              {op.estimated_time && (
                                <div className="text-sm text-gray-600">Süre: {op.estimated_time} dk</div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteOperation(op.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hammaddeler */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-green-600" />
                          <h4 className="font-bold text-gray-900">Hammaddeler</h4>
                        </div>
                        <button
                          onClick={() => setShowMaterialModal(true)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {partMaterials.length === 0 && (
                          <p className="text-sm text-gray-500">Henüz hammadde eklenmemiş</p>
                        )}
                        {partMaterials.map((mat) => (
                          <div key={mat.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{mat.material_name}</div>
                              <div className="text-sm text-gray-600">
                                Miktar: {mat.quantity} {mat.unit}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteMaterial(mat.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Takımlar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-5 h-5 text-orange-600" />
                          <h4 className="font-bold text-gray-900">Takımlar</h4>
                        </div>
                        <button
                          onClick={() => setShowToolModal(true)}
                          className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {partTools.length === 0 && (
                          <p className="text-sm text-gray-500">Henüz takım eklenmemiş</p>
                        )}
                        {partTools.map((tool) => (
                          <div key={tool.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{tool.tool_name}</div>
                              {tool.tool_code && (
                                <div className="text-sm text-gray-600">Kod: {tool.tool_code}</div>
                              )}
                              <div className="text-sm text-gray-600">Adet: {tool.quantity}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteTool(tool.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Katerler */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Scissors className="w-5 h-5 text-purple-600" />
                          <h4 className="font-bold text-gray-900">Katerler</h4>
                        </div>
                        <button
                          onClick={() => setShowCutterModal(true)}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Ekle
                        </button>
                      </div>
                      <div className="space-y-2">
                        {partCutters.length === 0 && (
                          <p className="text-sm text-gray-500">Henüz kater eklenmemiş</p>
                        )}
                        {partCutters.map((cutter) => (
                          <div key={cutter.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{cutter.cutter_name}</div>
                              {cutter.cutter_code && (
                                <div className="text-sm text-gray-600">Kod: {cutter.cutter_code}</div>
                              )}
                              {cutter.diameter && (
                                <div className="text-sm text-gray-600">
                                  Çap: {cutter.diameter} {cutter.diameter_unit}
                                </div>
                              )}
                              <div className="text-sm text-gray-600">Adet: {cutter.quantity}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteCutter(cutter.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p>Bir parça seçin veya yeni parça ekleyin</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Production Tab */}
            {detailTab === 'production' && (
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <div className="space-y-6">
                  {/* Hammadde Kullanımları */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-orange-600" />
                      Hammadde Kullanımları
                    </h3>

                    {projectProductionMaterials.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Bu projede henüz hammadde kullanımı kaydedilmemiş</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parça</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hammadde</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miktar</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tezgah</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vardiya</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atayan</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {projectProductionMaterials.map((mat: any) => (
                              <tr key={mat.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Date(mat.assigned_date).toLocaleDateString('tr-TR')}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {mat.part?.part_code} - {mat.part?.part_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {mat.item?.code} - {mat.item?.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {mat.quantity} {mat.item?.unit}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {mat.machine?.machine_code} - {mat.machine?.machine_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  <span className="capitalize">{mat.shift}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {mat.assigned_by_user?.full_name}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Üretim Çıktıları */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Factory className="w-5 h-5 text-green-600" />
                      Üretim Çıktıları
                    </h3>

                    {projectProductionOutputs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <Factory className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Bu projede henüz üretim kaydedilmemiş</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parça</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ürün</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miktar</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tezgah</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vardiya</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kalite</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operatör</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {projectProductionOutputs.map((out: any) => (
                              <tr key={out.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Date(out.production_date).toLocaleDateString('tr-TR')}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {out.part?.part_code} - {out.part?.part_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {out.output_item?.code} - {out.output_item?.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {out.quantity} {out.output_item?.unit}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {out.machine?.machine_code} - {out.machine?.machine_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  <span className="capitalize">{out.shift}</span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    out.quality_status === 'approved' ? 'bg-green-100 text-green-800' :
                                    out.quality_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {out.quality_status === 'approved' ? 'Onaylı' :
                                     out.quality_status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {out.operator?.full_name || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* İstatistikler */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-sm text-orange-600 font-medium">Toplam Hammadde</div>
                      <div className="text-2xl font-bold text-orange-900">{projectProductionMaterials.length}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Toplam Üretim</div>
                      <div className="text-2xl font-bold text-green-900">{projectProductionOutputs.length}</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">Onaylı Üretim</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {projectProductionOutputs.filter((o: any) => o.quality_status === 'approved').length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Tab */}
            {detailTab === 'info' && (
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Proje Detayları</h3>
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Proje Adı</div>
                          <div className="text-base font-semibold text-gray-900">{selectedProject.project_name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Müşteri</div>
                          <div className="text-base font-semibold text-gray-900">
                            {selectedProject.customer_company?.customer_name || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Başlangıç Tarihi</div>
                          <div className="text-base font-semibold text-gray-900">
                            {new Date(selectedProject.start_date).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Süre</div>
                          <div className="text-base font-semibold text-gray-900">
                            {selectedProject.scope_duration ? `${selectedProject.scope_duration} gün` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Durum</div>
                          <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              selectedProject.status === 'completed' ? 'bg-green-100 text-green-800' :
                              selectedProject.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              selectedProject.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                              selectedProject.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedProject.status === 'planning' ? 'Planlama' :
                               selectedProject.status === 'in_progress' ? 'Devam Ediyor' :
                               selectedProject.status === 'completed' ? 'Tamamlandı' :
                               selectedProject.status === 'on_hold' ? 'Beklemede' :
                               selectedProject.status === 'cancelled' ? 'İptal' : selectedProject.status}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Toplam Parça</div>
                          <div className="text-base font-semibold text-gray-900">{projectParts.length}</div>
                        </div>
                      </div>
                      {selectedProject.notes && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Notlar</div>
                          <div className="text-base text-gray-900">{selectedProject.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Part Modal */}
      {showPartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Yeni Parça Ekle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parça Adı *</label>
                <input
                  type="text"
                  value={partForm.part_name}
                  onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: Kapak"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parça Kodu *</label>
                <input
                  type="text"
                  value={partForm.part_code}
                  onChange={(e) => setPartForm({ ...partForm, part_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: KPK-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adet</label>
                  <input
                    type="number"
                    value={partForm.quantity}
                    onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                  <input
                    type="text"
                    value={partForm.unit}
                    onChange={(e) => setPartForm({ ...partForm, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={partForm.notes}
                  onChange={(e) => setPartForm({ ...partForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPartModal(false)
                  resetPartForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSavePart}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operation Modal */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Operasyon Ekle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Operasyon Adı *</label>
                <input
                  type="text"
                  value={operationForm.operation_name}
                  onChange={(e) => setOperationForm({ ...operationForm, operation_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: Tornalama"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sıra</label>
                  <input
                    type="number"
                    value={operationForm.operation_order}
                    onChange={(e) => setOperationForm({ ...operationForm, operation_order: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tahmini Süre (dk)</label>
                  <input
                    type="number"
                    value={operationForm.estimated_time}
                    onChange={(e) => setOperationForm({ ...operationForm, estimated_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah</label>
                <select
                  value={operationForm.machine_id}
                  onChange={(e) => setOperationForm({ ...operationForm, machine_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.machine_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={operationForm.notes}
                  onChange={(e) => setOperationForm({ ...operationForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOperationModal(false)
                  resetOperationForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveOperation}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Hammadde Ekle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hammadde *</label>
                <select
                  value={materialForm.material_id}
                  onChange={(e) => {
                    const selected = productionMaterials.find(m => m.id === e.target.value)
                    setMaterialForm({
                      ...materialForm,
                      material_id: e.target.value,
                      unit: selected?.unit || ''
                    })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seçiniz</option>
                  {productionMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.item_name} (Stok: {mat.current_stock} {mat.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miktar *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                  <input
                    type="text"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMaterialModal(false)
                  resetMaterialForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveMaterial}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {showToolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Takım Ekle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Takım Adı *</label>
                <input
                  type="text"
                  value={toolForm.tool_name}
                  onChange={(e) => setToolForm({ ...toolForm, tool_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Örn: Pens"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Takım Kodu</label>
                  <input
                    type="text"
                    value={toolForm.tool_code}
                    onChange={(e) => setToolForm({ ...toolForm, tool_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tip</label>
                  <input
                    type="text"
                    value={toolForm.tool_type}
                    onChange={(e) => setToolForm({ ...toolForm, tool_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adet</label>
                <input
                  type="number"
                  value={toolForm.quantity}
                  onChange={(e) => setToolForm({ ...toolForm, quantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={toolForm.notes}
                  onChange={(e) => setToolForm({ ...toolForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowToolModal(false)
                  resetToolForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveTool}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cutter Modal */}
      {showCutterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Kater Ekle</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kater Adı *</label>
                <input
                  type="text"
                  value={cutterForm.cutter_name}
                  onChange={(e) => setCutterForm({ ...cutterForm, cutter_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Örn: Parmak Freze"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kater Kodu</label>
                  <input
                    type="text"
                    value={cutterForm.cutter_code}
                    onChange={(e) => setCutterForm({ ...cutterForm, cutter_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tip</label>
                  <input
                    type="text"
                    value={cutterForm.cutter_type}
                    onChange={(e) => setCutterForm({ ...cutterForm, cutter_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Çap</label>
                  <input
                    type="number"
                    step="0.001"
                    value={cutterForm.diameter}
                    onChange={(e) => setCutterForm({ ...cutterForm, diameter: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                  <select
                    value={cutterForm.diameter_unit}
                    onChange={(e) => setCutterForm({ ...cutterForm, diameter_unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="inch">inch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adet</label>
                <input
                  type="number"
                  value={cutterForm.quantity}
                  onChange={(e) => setCutterForm({ ...cutterForm, quantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  value={cutterForm.notes}
                  onChange={(e) => setCutterForm({ ...cutterForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCutterModal(false)
                  resetCutterForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveCutter}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proje Detay Modal */}
      {showProjectDetailModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectDetailModal(false)}>
          <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedProject.project_name}</h2>
                  <p className="text-blue-100 text-sm mt-1">{selectedProject.project_code || 'Kod yok'}</p>
                </div>
                <button
                  onClick={() => setShowProjectDetailModal(false)}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <Users className="w-6 h-6 text-blue-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{projectDetailData.customers.length}</div>
                  <div className="text-sm text-gray-600">Müşteriler</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                  <Factory className="w-6 h-6 text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{projectDetailData.machines.length}</div>
                  <div className="text-sm text-gray-600">Tezgahlar</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                  <Package className="w-6 h-6 text-yellow-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{projectDetailData.materials.length}</div>
                  <div className="text-sm text-gray-600">Hammaddeler</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
                  <Wrench className="w-6 h-6 text-purple-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{projectDetailData.equipment.length}</div>
                  <div className="text-sm text-gray-600">Ekipmanlar</div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Müşteriler */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-lg">Müşteriler</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadAvailableData()
                        setShowAddCustomerModal(true)
                      }}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      title="Müşteri Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {projectDetailData.customers.length > 0 ? (
                    <div className="space-y-2">
                      {projectDetailData.customers.map((customer: any) => (
                        <div key={customer.id} className="p-3 bg-blue-50 rounded-lg">
                          <div className="font-semibold text-gray-900">{customer.customer_name}</div>
                          <div className="text-sm text-gray-600">{customer.customer_code}</div>
                          {customer.contact_person && (
                            <div className="text-xs text-gray-500 mt-1">{customer.contact_person} - {customer.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Müşteri eklenmemiş</p>
                  )}
                </div>

                {/* Tezgahlar */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Factory className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-lg">Tezgahlar</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadAvailableData()
                        setShowAddMachineModal(true)
                      }}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      title="Tezgah Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {projectDetailData.machines.length > 0 ? (
                    <div className="space-y-2">
                      {projectDetailData.machines.map((machine: any) => (
                        <div key={machine.id} className="p-3 bg-green-50 rounded-lg flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-gray-900">{machine.machine_name}</div>
                            <div className="text-sm text-gray-600">{machine.machine_code}</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
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
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-yellow-600" />
                      <h3 className="font-bold text-lg">Hammadde İhtiyacı</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadAvailableData()
                        setShowAddMaterialModal(true)
                      }}
                      className="p-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      title="Hammadde Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {projectDetailData.materials.length > 0 ? (
                    <div className="space-y-2">
                      {projectDetailData.materials.map((material: any) => (
                        <div key={material.id} className="p-3 bg-yellow-50 rounded-lg flex justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{material.item_name}</div>
                            <div className="text-sm text-gray-600">{material.item_code}</div>
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
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-lg">Mamül Hedefleri</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadAvailableData()
                        setShowAddProductModal(true)
                      }}
                      className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      title="Mamül Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {projectDetailData.products.length > 0 ? (
                    <div className="space-y-3">
                      {projectDetailData.products.map((product: any) => (
                        <div key={product.id} className="p-3 bg-purple-50 rounded-lg">
                          <div className="flex justify-between mb-2">
                            <div>
                              <div className="font-semibold text-gray-900">{product.item_name}</div>
                              <div className="text-sm text-gray-600">{product.item_code}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-purple-700">
                                {product.quantity_produced} / {product.quantity_target} {product.unit}
                              </div>
                              <div className="text-xs text-gray-500">
                                %{((product.quantity_produced / product.quantity_target) * 100).toFixed(0)}
                              </div>
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

                {/* Ekipmanlar */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Wrench className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-lg">Kullanılan Ekipmanlar</h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadAvailableData()
                        setShowAddEquipmentModal(true)
                      }}
                      className="p-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      title="Ekipman Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {projectDetailData.equipment.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {projectDetailData.equipment.map((item: any) => (
                        <div key={item.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-gray-900">{item.equipment_name}</div>
                            <div className="text-sm text-gray-600">{item.equipment_code} - {item.equipment_type}</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            item.status === 'available' ? 'bg-green-100 text-green-800' :
                            item.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                            item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Ekipman eklenmemiş</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowAddCustomerModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Müşteri Ekle</h3>
            <select
              value={addForm.customer_id}
              onChange={(e) => setAddForm({ ...addForm, customer_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Müşteri seçin...</option>
              {availableCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.customer_name} - {c.customer_code}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAddCustomerModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={handleAddCustomer} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Machine Modal */}
      {showAddMachineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowAddMachineModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Tezgah Ekle</h3>
            <select
              value={addForm.machine_id}
              onChange={(e) => setAddForm({ ...addForm, machine_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Tezgah seçin...</option>
              {availableMachines.map(m => (
                <option key={m.id} value={m.id}>{m.machine_name} - {m.machine_code}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAddMachineModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={handleAddMachine} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowAddMaterialModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Hammadde Ekle</h3>
            <select
              value={addForm.material_id}
              onChange={(e) => setAddForm({ ...addForm, material_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Hammadde seçin...</option>
              {availableWarehouseItems.filter(i => i.type === 'raw_material').map(i => (
                <option key={i.id} value={i.id}>{i.name} - {i.code}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              placeholder="Miktar"
              value={addForm.material_quantity}
              onChange={(e) => setAddForm({ ...addForm, material_quantity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddMaterialModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={handleAddMaterial} className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowAddProductModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Mamül Hedefi Ekle</h3>
            <select
              value={addForm.product_id}
              onChange={(e) => setAddForm({ ...addForm, product_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Mamül seçin...</option>
              {availableWarehouseItems.filter(i => i.type === 'finished_good').map(i => (
                <option key={i.id} value={i.id}>{i.name} - {i.code}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              placeholder="Hedef Miktar"
              value={addForm.product_quantity}
              onChange={(e) => setAddForm({ ...addForm, product_quantity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddProductModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={handleAddProduct} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddEquipmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowAddEquipmentModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Ekipman Ekle</h3>
            <select
              value={addForm.equipment_id}
              onChange={(e) => setAddForm({ ...addForm, equipment_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Ekipman seçin...</option>
              {availableEquipment.map(e => (
                <option key={e.id} value={e.id}>{e.equipment_name} - {e.equipment_code}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAddEquipmentModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
              <button onClick={handleAddEquipment} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

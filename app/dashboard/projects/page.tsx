'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FolderKanban, Plus, Calendar, Building2, Clock, AlertCircle, CheckCircle2, Pause, X, Edit, Trash2, Eye, Package, Wrench, Scissors, Factory } from 'lucide-react'

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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Detail tabs and data
  const [detailTab, setDetailTab] = useState<'parts' | 'info'>('parts')
  const [projectParts, setProjectParts] = useState<ProjectPart[]>([])
  const [selectedPart, setSelectedPart] = useState<ProjectPart | null>(null)
  const [partOperations, setPartOperations] = useState<ProjectOperation[]>([])
  const [partMaterials, setPartMaterials] = useState<ProjectMaterial[]>([])
  const [partTools, setPartTools] = useState<ProjectTool[]>([])
  const [partCutters, setPartCutters] = useState<ProjectCutter[]>([])

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

  const supabase = createClientComponentClient()

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
          .ilike('company_name', '%dünyasan%')
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
          item:warehouse_items(item_name, unit)
        `)
        .eq('company_id', cid)
        .eq('item_type', 'raw_material')

      if (error) throw error

      const materials = (data || []).map((item: any) => ({
        id: item.item_id,
        item_name: item.item?.item_name || 'Bilinmeyen',
        unit: item.item?.unit || 'adet',
        current_stock: item.current_stock
      }))

      setProductionMaterials(materials)
    } catch (error) {
      console.error('Error loading production materials:', error)
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
          material:warehouse_items(item_name, unit)
        `)
        .eq('part_id', partId)

      if (matsError) throw matsError
      setPartMaterials((mats || []).map(mat => ({
        ...mat,
        material_name: mat.material?.item_name,
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
      // Önce kullanıcıyı ve şirket bilgisini çek
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('❌ Kullanıcı bilgisi bulunamadı')
        return
      }

      // Profildeki company_id'yi al
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id || companyId

      // Hala company_id yoksa, ilk şirketi kullan
      if (!finalCompanyId) {
        const { data: firstCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .single()

        if (firstCompany?.id) {
          finalCompanyId = firstCompany.id
        }
      }

      if (!finalCompanyId) {
        alert('❌ Şirket bilgisi bulunamadı. Lütfen önce bir şirket oluşturun.')
        return
      }

      const customerData = {
        company_id: finalCompanyId,
        customer_name: customerForm.customer_name.trim(),
        contact_person: customerForm.contact_person.trim() || null,
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        address: customerForm.address.trim() || null,
        notes: customerForm.notes.trim() || null
      }

      const { data, error } = await supabase
        .from('customer_companies')
        .insert(customerData)
        .select()

      if (error) throw error

      alert('✅ Müşteri firma eklendi!')
      setShowCustomerModal(false)
      resetCustomerForm()

      // Company ID'yi güncelle
      if (!companyId) {
        setCompanyId(finalCompanyId)
      }

      loadCustomers(finalCompanyId)
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
    await loadProjectParts(project.id)
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
                onClick={() => openDetailsModal(project)}
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
              <div className="flex items-center justify-between">
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
            </div>

            <div className="flex" style={{ maxHeight: 'calc(90vh - 120px)' }}>
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
    </div>
  )
}

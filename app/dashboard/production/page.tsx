'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { Package, FlaskConical, Factory, ClipboardList, TestTube2, Send } from 'lucide-react'

type Tab = 'inventory' | 'requests' | 'assignments' | 'outputs' | 'transfers' | 'qc-transfers' | 'history'

interface ProductionInventoryItem {
  id: string
  item_id: string
  item_code: string
  item_name: string
  category_name: string
  unit: string
  current_stock: number
  item_type: 'raw_material' | 'finished_product'
}

interface WarehouseTransfer {
  id: string
  item_name: string
  item_code: string
  quantity: number
  unit: string
  status: string
  requested_by_name: string
  requested_at: string
  approved_by_name?: string
  approved_at?: string
  notes?: string
}

interface QCTransfer {
  id: string
  item_name: string
  item_code: string
  quantity: number
  unit: string
  status: string
  requested_by_name: string
  requested_at: string
  reviewed_by_name?: string
  reviewed_at?: string
  notes?: string
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
  machine_name: string
  machine_code: string
  status: string
  project_id?: string | null
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
  output_item_id: string
  output_item_code: string
  quantity: number
  unit: string
  production_date: string
  shift: string
  quality_status: string
  operator_name: string
  transfer_status: string
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
  const [warehouseTransfers, setWarehouseTransfers] = useState<WarehouseTransfer[]>([])
  const [qcTransfers, setQCTransfers] = useState<QCTransfer[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [projectParts, setProjectParts] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])

  // Stats states
  const [stats, setStats] = useState({
    rawMaterialsReady: 0,
    finishedProducts: 0,
    pendingQC: 0,
    todayProduction: 0,
    calculatedScrap: 0,
    recordedFire: 0,
    recentProjects: [] as string[]
  })

  // Modal states
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [showOutputModal, setShowOutputModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showManualStockModal, setShowManualStockModal] = useState(false)
  const [showQCTransferModal, setShowQCTransferModal] = useState(false)

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
    project_id: '',
    project_part_id: '',
  })

  const [outputForm, setOutputForm] = useState({
    machine_id: '',
    output_item_id: '',
    quantity: 0,
    fire_quantity: 0,
    fire_reason: 'process_error',
    shift: 'sabah',
    operator_id: '',
    notes: '',
    project_id: '',
    project_part_id: '',
  })

  const [transferForm, setTransferForm] = useState({
    item_id: '',
    quantity: 0,
    notes: '',
  })

  const [manualStockForm, setManualStockForm] = useState({
    item_id: '',
    quantity: 0,
    notes: '',
  })

  const [qcTransferForm, setQCTransferForm] = useState({
    item_id: '',
    quantity: 0,
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

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
        console.error('No company found')
        setLoading(false)
        return
      }

      setCompanyId(finalCompanyId)

      // Load all data in parallel
      await Promise.all([
        loadProductionInventory(finalCompanyId),
        loadMaterialRequests(finalCompanyId),
        loadMachines(finalCompanyId),
        loadAssignments(finalCompanyId),
        loadOutputs(finalCompanyId),
        loadWarehouseItems(finalCompanyId),
        loadWarehouseTransfers(finalCompanyId),
        loadQCTransfers(finalCompanyId),
        loadProjects(finalCompanyId),
        loadStats(finalCompanyId),
        loadHistory(finalCompanyId),
      ])

    } catch (error) {
      console.error('Error loading data:', error)
      alert('Veri yüklenirken hata oluştu!')
    } finally {
      setLoading(false)
    }
  }

  const loadProductionInventory = async (companyId: string) => {
    console.log('🔍 [PRODUCTION] loadProductionInventory çağrıldı, companyId:', companyId)

    // Üretim deposundan tüm stokları çek (hem hammadde hem bitmiş ürün)
    const { data, error } = await supabase
      .from('production_inventory')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name))
      `)
      .eq('company_id', companyId)
      .gt('current_stock', 0)
      .order('item_type', { ascending: true })

    if (error) {
      console.error('❌ [PRODUCTION] production_inventory sorgu hatası:', error)
      setProductionInventory([])
      return
    }

    console.log('🏭 [PRODUCTION] production_inventory sonucu:', { count: data?.length })
    console.log('📦 [PRODUCTION] İlk 3 kayıt:', data?.slice(0, 3))

    const inventoryData = data?.map((inv: any) => ({
      id: inv.id,
      item_id: inv.item_id,
      item_code: inv.item?.code || '',
      item_name: inv.item?.name || '',
      category_name: inv.item?.category?.name || '',
      unit: inv.item?.unit || '',
      current_stock: inv.current_stock,
      item_type: inv.item_type || 'raw_material'
    })) || []

    console.log('✅ [PRODUCTION] ProductionInventory state:', inventoryData.length, 'kayıt')
    console.log('📊 [PRODUCTION] Hammadde:', inventoryData.filter(i => i.item_type === 'raw_material').length)
    console.log('📊 [PRODUCTION] Bitmiş ürün:', inventoryData.filter(i => i.item_type === 'finished_product').length)

    setProductionInventory(inventoryData)
  }

  const loadMaterialRequests = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_material_requests')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name)),
        requested_by:profiles!production_material_requests_requested_by_fkey(full_name)
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
    console.log('🔍 [PRODUCTION] loadMachines çağrıldı, companyId:', companyId)

    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .eq('company_id', companyId)
      .order('machine_code')

    console.log('🏭 [PRODUCTION] machines sorgu sonucu:', { data, error, count: data?.length })

    if (error) {
      console.error('❌ [PRODUCTION] Machines yükleme hatası:', error)
    }

    console.log('✅ [PRODUCTION] Machines state güncelleniyor:', data?.length || 0, 'tezgah')
    setMachines(data || [])
  }

  const loadAssignments = async (companyId: string) => {
    console.log('🔍 [ASSIGNMENTS] loadAssignments çağrıldı, companyId:', companyId)

    // Önce basit sorgu ile kayıtları çek
    const { data: transfers, error: transferError } = await supabase
      .from('production_to_machine_transfers')
      .select('*')
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .limit(100)

    if (transferError) {
      console.error('❌ [ASSIGNMENTS] Sorgu hatası:', transferError)
      setAssignments([])
      return
    }

    console.log('✅ [ASSIGNMENTS] Transfer kayıtları:', transfers?.length)

    if (!transfers || transfers.length === 0) {
      console.log('⚠️ [ASSIGNMENTS] Hiç transfer kaydı bulunamadı')
      setAssignments([])
      return
    }

    // Machine ID'lerini topla
    const machineIds = Array.from(new Set(transfers.map(t => t.machine_id).filter(Boolean)))
    const itemIds = Array.from(new Set(transfers.map(t => t.item_id).filter(Boolean)))

    console.log('📊 [ASSIGNMENTS] Machine IDs:', machineIds.length, 'Item IDs:', itemIds.length)

    // Tezgahları çek
    const { data: machines } = await supabase
      .from('machines')
      .select('id, machine_name, machine_code')
      .in('id', machineIds)

    // Ürünleri çek
    const { data: items } = await supabase
      .from('warehouse_items')
      .select('id, code, name, unit')
      .in('id', itemIds)

    console.log('✅ [ASSIGNMENTS] Machines:', machines?.length, 'Items:', items?.length)

    // Map oluştur
    const machineMap = new Map(machines?.map(m => [m.id, m]) || [])
    const itemMap = new Map(items?.map(i => [i.id, i]) || [])

    const assignmentsData = transfers.map((a: any) => {
      const machine = machineMap.get(a.machine_id)
      const item = itemMap.get(a.item_id)

      return {
        id: a.id,
        machine_name: machine?.machine_name || 'Bilinmeyen Tezgah',
        machine_code: machine?.machine_code || '-',
        item_name: item?.name || 'Bilinmeyen Ürün',
        item_code: item?.code || '-',
        quantity: a.quantity,
        unit: item?.unit || 'adet',
        assigned_by_name: '',
        assigned_date: a.created_at || new Date().toISOString(),
        shift: a.shift || '-'
      }
    })

    console.log('✅ [ASSIGNMENTS] State güncelleniyor:', assignmentsData.length, 'kayıt')
    setAssignments(assignmentsData)
  }

  const loadOutputs = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_outputs')
      .select(`
        *,
        machine:machines(machine_name, machine_code),
        output_item:warehouse_items!production_outputs_output_item_id_fkey(id, code, name, unit),
        operator:profiles!production_outputs_operator_id_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('production_date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error loading outputs:', error)
    }

    const outputsData = data?.map((o: any) => ({
      id: o.id,
      machine_name: o.machine?.machine_name || '',
      machine_code: o.machine?.machine_code || '',
      output_item_name: o.output_item?.name || '',
      output_item_id: o.output_item?.id || o.output_item_id,
      output_item_code: o.output_item?.code || '',
      quantity: o.quantity,
      unit: o.output_item?.unit || '',
      production_date: o.production_date,
      shift: o.shift || '',
      quality_status: o.quality_status,
      operator_name: o.operator?.full_name || '',
      transfer_status: o.transfer_status || 'pending'
    })) || []

    setOutputs(outputsData)
  }

  const loadWarehouseItems = async (companyId: string) => {
    console.log('🔍 [PRODUCTION] loadWarehouseItems çağrıldı, companyId:', companyId)

    const { data, error } = await supabase
      .from('warehouse_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    console.log('📦 [PRODUCTION] warehouse_items sorgu sonucu:', { data, error, count: data?.length })
    console.log('✅ [PRODUCTION] WarehouseItems state güncelleniyor:', data?.length || 0, 'kayıt')

    setWarehouseItems(data || [])
  }

  const loadProjects = async (companyId: string) => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_name, status')
      .eq('company_id', companyId)
      .in('status', ['planning', 'in_progress'])
      .order('project_name')

    setProjects(data || [])
  }

  const loadProjectParts = async (projectId: string) => {
    if (!projectId) {
      setProjectParts([])
      return
    }

    const { data } = await supabase
      .from('project_parts')
      .select('id, part_name, part_code, quantity, unit')
      .eq('project_id', projectId)
      .order('part_name')

    setProjectParts(data || [])
  }

  const loadStats = async (companyId: string) => {
    console.log('📊 [PRODUCTION] loadStats çağrıldı')

    // DOĞRU MANTIK:
    // 1. Tezgahlarda bekleyen hammadde = Tezgaha verilen - (Üretilen + Fire)
    // 2. Üretim deposundaki hammadde = production_inventory'den çek
    // 3. Toplam işlenebilir = Tezgahlardaki + Deposundaki

    // 1. Tezgaha verilen toplam hammadde
    const { data: givenToMachines } = await supabase
      .from('production_to_machine_transfers')
      .select('quantity')
      .eq('company_id', companyId)

    const totalGivenToMachines = givenToMachines?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // 2. Toplam üretilen (bitmiş ürün)
    const { data: allOutputs } = await supabase
      .from('production_outputs')
      .select('quantity')
      .eq('company_id', companyId)

    const totalProduced = allOutputs?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // 3. Toplam fire
    const { data: allFire } = await supabase
      .from('production_scrap_records')
      .select('quantity')
      .eq('company_id', companyId)

    const totalFire = allFire?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // 4. Üretim deposundaki hammaddeler (geri dönenler dahil)
    const { data: warehouseStock } = await supabase
      .from('production_inventory')
      .select('current_stock')
      .eq('company_id', companyId)
      .eq('item_type', 'raw_material')

    const warehouseRawMaterials = warehouseStock?.reduce((sum, item) => sum + item.current_stock, 0) || 0

    // Tezgahlarda kalan = Verilen - Kullanılan (Not: 1:1 oran varsayımı)
    const onMachines = Math.max(0, totalGivenToMachines - totalProduced - totalFire)

    // TOPLAM işlenmeye hazır = Tezgahlardaki + Depodaki
    const rawMaterialsReady = warehouseRawMaterials + onMachines

    // Bitmiş ürünler
    const finishedProducts = totalProduced

    // Kalite kontrolde bekleyen (ÜRÜN SAYISI, test sayısı değil)
    const { data: pendingQCData } = await supabase
      .from('production_outputs')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('quality_status', 'pending')

    const pendingQC = pendingQCData?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // Bugünkü üretim
    const today = new Date().toISOString().split('T')[0]
    const { data: todayOutputs } = await supabase
      .from('production_outputs')
      .select('quantity')
      .eq('company_id', companyId)
      .gte('production_date', today)

    const todayProduction = todayOutputs?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // En son atanan projeleri al (şimdilik devre dışı - join hatası var)
    // const { data: recentAssignments } = await supabase
    //   .from('production_to_machine_transfers')
    //   .select(`
    //     project_id,
    //     project:projects(project_name)
    //   `)
    //   .eq('company_id', companyId)
    //   .not('project_id', 'is', null)
    //   .order('created_at', { ascending: false })
    //   .limit(5)

    // const projectNames = recentAssignments?.map((a: any) => a.project?.project_name).filter(Boolean) as string[]
    const recentProjects: string[] = []

    // Verimlilik = Verilen - (Üretilen + Fire)
    const calculatedScrap = Math.max(0, totalGivenToMachines - totalProduced - totalFire)

    // Kayıtlı fire (zaten yukarıda hesaplandı)
    const recordedFire = totalFire

    console.log('📊 [PRODUCTION] İstatistikler:', {
      'Tezgaha Verilen': totalGivenToMachines,
      'Üretilen': totalProduced,
      'Fire': totalFire,
      'Tezgahlarda Bekleyen (Verilen-Üretilen-Fire)': rawMaterialsReady,
      'KK Bekleyen': pendingQC,
      'Bugünkü Üretim': todayProduction,
      'Projeler': recentProjects
    })

    setStats({
      rawMaterialsReady,
      finishedProducts,
      pendingQC: pendingQC || 0,
      todayProduction,
      calculatedScrap,
      recordedFire,
      recentProjects
    })
  }

  const loadHistory = async (companyId: string) => {
    // Tüm işlemleri birleştir: malzeme talepleri, depo transferleri, KK transferleri, üretim çıktıları
    const [requestsData, warehouseData, qcData, outputsData] = await Promise.all([
      // Malzeme talepleri (onaylanan/reddedilen)
      supabase
        .from('production_material_requests')
        .select(`
          *,
          item:warehouse_items(code, name, unit),
          requested_by:profiles!production_material_requests_requested_by_fkey(full_name),
          approved_by:profiles!production_material_requests_approved_by_fkey(full_name)
        `)
        .eq('company_id', companyId)
        .in('status', ['approved', 'rejected'])
        .order('requested_at', { ascending: false }),

      // Depoya transferler (onaylanan/reddedilen)
      supabase
        .from('production_to_warehouse_transfers')
        .select(`
          *,
          item:warehouse_items(code, name, unit),
          requested_by:profiles!production_to_warehouse_transfers_requested_by_fkey(full_name),
          approved_by:profiles!production_to_warehouse_transfers_approved_by_fkey(full_name)
        `)
        .eq('company_id', companyId)
        .in('status', ['approved', 'rejected'])
        .order('requested_at', { ascending: false }),

      // KK transferleri
      supabase
        .from('production_to_qc_transfers')
        .select(`
          *,
          item:warehouse_items(code, name, unit),
          requested_by:profiles!production_to_qc_transfers_requested_by_fkey(full_name),
          reviewed_by_user:profiles!production_to_qc_transfers_reviewed_by_fkey(full_name)
        `)
        .eq('company_id', companyId)
        .in('status', ['approved', 'rejected'])
        .order('requested_at', { ascending: false }),

      // Üretim çıktıları
      supabase
        .from('production_outputs')
        .select(`
          *,
          machine:machines(code, name),
          output_item:warehouse_items(code, name, unit),
          operator:profiles(full_name)
        `)
        .eq('company_id', companyId)
        .order('production_date', { ascending: false })
    ])

    // Hepsini birleştir ve tarihe göre sırala
    const allHistory = [
      ...(requestsData.data || []).map(item => ({ ...item, history_type: 'material_request' })),
      ...(warehouseData.data || []).map(item => ({ ...item, history_type: 'warehouse_transfer' })),
      ...(qcData.data || []).map(item => ({ ...item, history_type: 'qc_transfer' })),
      ...(outputsData.data || []).map(item => ({ ...item, history_type: 'production_output' }))
    ].sort((a, b) => {
      const dateA = new Date(a.requested_at || a.production_date).getTime()
      const dateB = new Date(b.requested_at || b.production_date).getTime()
      return dateB - dateA
    })

    setHistory(allHistory)
  }

  const loadWarehouseTransfers = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_to_warehouse_transfers')
      .select(`
        *,
        item:warehouse_items(code, name, unit),
        requested_by:profiles!production_to_warehouse_transfers_requested_by_fkey(full_name),
        approved_by:profiles!production_to_warehouse_transfers_approved_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading warehouse transfers:', error)
    }

    const transfersData = data?.map((t: any) => ({
      id: t.id,
      item_name: t.item?.name || '',
      item_code: t.item?.code || '',
      quantity: t.quantity,
      unit: t.item?.unit || '',
      status: t.status,
      requested_by_name: t.requested_by?.full_name || '',
      requested_at: t.requested_at,
      approved_by_name: t.approved_by?.full_name || '',
      approved_at: t.approved_at,
      notes: t.notes || ''
    })) || []

    setWarehouseTransfers(transfersData)
  }

  const loadQCTransfers = async (companyId: string) => {
    const { data, error } = await supabase
      .from('production_to_qc_transfers')
      .select(`
        *,
        item:warehouse_items(code, name, unit),
        requested_by:profiles!production_to_qc_transfers_requested_by_fkey(full_name),
        reviewed_by:profiles!production_to_qc_transfers_reviewed_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error loading QC transfers:', error)
    }

    const qcTransfersData = data?.map((t: any) => ({
      id: t.id,
      item_name: t.item?.name || '',
      item_code: t.item?.code || '',
      quantity: t.quantity,
      unit: t.item?.unit || '',
      status: t.status,
      requested_by_name: t.requested_by?.full_name || '',
      requested_at: t.requested_at,
      reviewed_by_name: t.reviewed_by?.full_name || '',
      reviewed_at: t.reviewed_at,
      notes: t.notes || ''
    })) || []

    setQCTransfers(qcTransfersData)
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      // 1. Ana depoda stok kontrolü
      const { data: warehouseItem } = await supabase
        .from('warehouse_items')
        .select('current_stock, code, name')
        .eq('id', requestForm.item_id)
        .single()

      if (!warehouseItem) {
        alert('❌ Ürün bulunamadı!')
        return
      }

      if (warehouseItem.current_stock < requestForm.quantity) {
        alert(`❌ Ana depoda yeterli stok yok!\nMevcut: ${warehouseItem.current_stock}\nİstenen: ${requestForm.quantity}`)
        return
      }

      // 2. Talep kaydı oluştur
      const { error: requestError } = await supabase
        .from('production_material_requests')
        .insert({
          company_id: companyId,
          item_id: requestForm.item_id,
          quantity: requestForm.quantity,
          urgency: requestForm.urgency,
          reason: requestForm.reason,
          requested_by: currentUserId,
          status: 'approved' // Otomatik onaylı
        })

      if (requestError) throw requestError

      // 3. Ana depodan düş
      const { error: warehouseError } = await supabase
        .from('warehouse_items')
        .update({
          current_stock: warehouseItem.current_stock - requestForm.quantity,
        })
        .eq('id', requestForm.item_id)

      if (warehouseError) throw warehouseError

      // 4. Üretim deposuna ekle
      const { data: existingProd } = await supabase
        .from('production_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', requestForm.item_id)
        .eq('item_type', 'raw_material')
        .maybeSingle()

      if (existingProd) {
        // Mevcut stoğu güncelle
        const { error: updateError } = await supabase
          .from('production_inventory')
          .update({
            current_stock: existingProd.current_stock + requestForm.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('item_id', requestForm.item_id)
          .eq('item_type', 'raw_material')

        if (updateError) throw updateError
      } else {
        // Yeni kayıt
        const { error: insertError } = await supabase
          .from('production_inventory')
          .insert({
            company_id: companyId,
            item_id: requestForm.item_id,
            current_stock: requestForm.quantity,
            item_type: 'raw_material',
            notes: `Ana depodan transfer - ${requestForm.reason}`
          })

        if (insertError) throw insertError
      }

      setShowRequestModal(false)
      resetRequestForm()
      await loadData()

      alert(`✅ ${warehouseItem.code} - ${warehouseItem.name}\n${requestForm.quantity} birim üretim deposuna transfer edildi!`)
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      // 1. Üretim deposundan hammadde stoğunu kontrol et ve düş
      const { data: existingStock } = await supabase
        .from('production_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', assignmentForm.item_id)
        .eq('item_type', 'raw_material')
        .single()

      if (!existingStock) {
        alert('❌ Üretim deposunda bu hammadde bulunamadı!')
        return
      }

      if (existingStock.current_stock < assignmentForm.quantity) {
        alert(`❌ Yetersiz stok!\nMevcut: ${existingStock.current_stock}\nİstenen: ${assignmentForm.quantity}`)
        return
      }

      // Stoktan düş
      const { error: stockError } = await supabase
        .from('production_inventory')
        .update({
          current_stock: existingStock.current_stock - assignmentForm.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('item_id', assignmentForm.item_id)
        .eq('item_type', 'raw_material')

      if (stockError) throw stockError

      // 2. Transfer kaydını oluştur
      const { error } = await supabase
        .from('production_to_machine_transfers')
        .insert({
          company_id: companyId,
          machine_id: assignmentForm.machine_id,
          item_id: assignmentForm.item_id,
          quantity: assignmentForm.quantity,
          shift: assignmentForm.shift,
          notes: assignmentForm.notes,
          transferred_by: currentUserId,
          project_id: assignmentForm.project_id || null,
          project_part_id: assignmentForm.project_part_id || null,
        })

      if (error) throw error

      setShowAssignmentModal(false)
      resetAssignmentForm()
      await loadData() // ⚠️ await ekledik

      alert('✅ Hammadde tezgaha verildi ve stoktan düşüldü!')
    } catch (error: any) {
      console.error('Error creating assignment:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateOutput = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      // 1. Tezgaha verilen son hammaddeyi bul
      const { data: lastTransfer, error: transferError } = await supabase
        .from('production_to_machine_transfers')
        .select('item_id, quantity')
        .eq('machine_id', outputForm.machine_id)
        .eq('company_id', companyId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (transferError) {
        console.error('Transfer sorgu hatası:', transferError)
        alert('❌ Hata: ' + transferError.message)
        return
      }

      if (!lastTransfer) {
        alert('❌ Bu tezgaha henüz hammadde atanmamış!')
        return
      }

      const rawMaterialId = lastTransfer.item_id
      const givenQuantity = lastTransfer.quantity
      const usedQuantity = outputForm.quantity + outputForm.fire_quantity
      const remainingQuantity = givenQuantity - usedQuantity

      if (usedQuantity > givenQuantity) {
        alert(`❌ Kullanılan miktar tezgaha verilenden fazla olamaz!\nVerilen: ${givenQuantity}\nKullanılan: ${usedQuantity}`)
        return
      }

      // 2. Üretim kaydını oluştur
      const { error: outputError } = await supabase
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
          project_id: outputForm.project_id || null,
          project_part_id: outputForm.project_part_id || null,
        })

      if (outputError) throw outputError

      // 3. Eğer fire varsa fire kaydını oluştur
      if (outputForm.fire_quantity > 0) {
        const { error: fireError } = await supabase
          .from('production_scrap_records')
          .insert({
            company_id: companyId,
            source_type: 'machine',
            machine_id: outputForm.machine_id,
            item_id: rawMaterialId,
            quantity: outputForm.fire_quantity,
            scrap_reason: outputForm.fire_reason,
            notes: `Üretim sırasında fire - ${outputForm.notes || ''}`,
            recorded_by: currentUserId,
          })

        if (fireError) throw fireError
      }

      // 4. Bitmiş ürünü stoğa ekle
      console.log('✨ [PRODUCTION] Bitmiş ürün stoğa ekleniyor:', {
        item_id: outputForm.output_item_id,
        quantity: outputForm.quantity
      })

      const { data: existingFinished, error: checkFinishedError } = await supabase
        .from('production_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', outputForm.output_item_id)
        .eq('item_type', 'finished_product')
        .maybeSingle()

      if (checkFinishedError) {
        console.error('❌ [PRODUCTION] Bitmiş ürün kontrolü hatası:', checkFinishedError)
      }

      if (existingFinished) {
        const { error: updateFinishedError } = await supabase
          .from('production_inventory')
          .update({
            current_stock: existingFinished.current_stock + outputForm.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('item_id', outputForm.output_item_id)
          .eq('item_type', 'finished_product')

        if (updateFinishedError) {
          console.error('❌ [PRODUCTION] Bitmiş ürün güncelleme hatası:', updateFinishedError)
          throw updateFinishedError
        }
        console.log('✅ [PRODUCTION] Bitmiş ürün stoku güncellendi')
      } else {
        const { error: insertFinishedError } = await supabase
          .from('production_inventory')
          .insert({
            company_id: companyId,
            item_id: outputForm.output_item_id,
            current_stock: outputForm.quantity,
            item_type: 'finished_product',
            notes: 'Üretimden gelen bitmiş ürün'
          })

        if (insertFinishedError) {
          console.error('❌ [PRODUCTION] Bitmiş ürün ekleme hatası:', insertFinishedError)
          throw insertFinishedError
        }
        console.log('✅ [PRODUCTION] Yeni bitmiş ürün kaydı oluşturuldu')
      }

      // 5. Kalan hammaddeyi stoğa geri ekle
      if (remainingQuantity > 0) {
        console.log('↩️ [PRODUCTION] Geri dönen hammadde ekleniyor:', {
          rawMaterialId,
          remainingQuantity,
          companyId
        })

        const { data: existingRaw, error: checkError } = await supabase
          .from('production_inventory')
          .select('current_stock')
          .eq('company_id', companyId)
          .eq('item_id', rawMaterialId)
          .eq('item_type', 'raw_material')
          .maybeSingle()

        if (checkError) {
          console.error('❌ [PRODUCTION] Mevcut stok kontrolü hatası:', checkError)
        }

        if (existingRaw) {
          console.log('📝 [PRODUCTION] Mevcut stok bulundu:', existingRaw.current_stock, '+ yeni:', remainingQuantity, '=', existingRaw.current_stock + remainingQuantity)

          const { error: updateError } = await supabase
            .from('production_inventory')
            .update({
              current_stock: existingRaw.current_stock + remainingQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId)
            .eq('item_id', rawMaterialId)
            .eq('item_type', 'raw_material')

          if (updateError) {
            console.error('❌ [PRODUCTION] Stok güncelleme hatası:', updateError)
            throw updateError
          }
          console.log('✅ [PRODUCTION] Stok güncellendi')
        } else {
          console.log('📝 [PRODUCTION] Yeni kayıt oluşturuluyor')

          const { error: insertError } = await supabase
            .from('production_inventory')
            .insert({
              company_id: companyId,
              item_id: rawMaterialId,
              current_stock: remainingQuantity,
              item_type: 'raw_material',
              notes: 'Tezgahtan kalan hammadde'
            })

          if (insertError) {
            console.error('❌ [PRODUCTION] Stok ekleme hatası:', insertError)
            throw insertError
          }
          console.log('✅ [PRODUCTION] Yeni stok kaydı oluşturuldu')
        }
      }

      // Başarı mesajı oluştur
      let successMsg = '✅ Üretim kaydı oluşturuldu!'
      successMsg += `\n✨ Üretilen: ${outputForm.quantity} birim bitmiş ürün`
      if (outputForm.fire_quantity > 0) {
        successMsg += `\n🔥 Fire: ${outputForm.fire_quantity} birim`
      }
      if (remainingQuantity > 0) {
        successMsg += `\n↩️ Stoğa dönen: ${remainingQuantity} birim hammadde`
      }
      // Başarı mesajını göster ve verileri yenile
      setShowOutputModal(false)
      resetOutputForm()
      await loadData() // ⚠️ await ekledik - stoklar güncellenmeden devam etmesin!

      alert(successMsg) // Veriler yenilendikten SONRA mesaj göster
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
      project_id: '',
      project_part_id: '',
    })
    setProjectParts([])
  }

  const resetOutputForm = () => {
    setOutputForm({
      machine_id: '',
      output_item_id: '',
      quantity: 0,
      fire_quantity: 0,
      fire_reason: 'process_error',
      shift: 'sabah',
      operator_id: '',
      notes: '',
      project_id: '',
      project_part_id: '',
    })
    setProjectParts([])
  }

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('production_to_warehouse_transfers')
        .insert({
          company_id: companyId,
          item_id: transferForm.item_id,
          quantity: transferForm.quantity,
          notes: transferForm.notes,
          requested_by: currentUserId,
        })

      if (error) throw error

      setShowTransferModal(false)
      resetTransferForm()
      await loadData()

      alert('✅ Ana depoya transfer talebi gönderildi!')
    } catch (error: any) {
      console.error('Error creating transfer:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const resetTransferForm = () => {
    setTransferForm({
      item_id: '',
      quantity: 0,
      notes: '',
    })
  }

  const handleManualStockAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      // Üretim deposuna bitmiş ürün ekle
      const { data: existing } = await supabase
        .from('production_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', manualStockForm.item_id)
        .eq('item_type', 'finished_product')
        .single()

      if (existing) {
        // Güncelle
        const { error } = await supabase
          .from('production_inventory')
          .update({
            current_stock: existing.current_stock + manualStockForm.quantity,
            notes: manualStockForm.notes,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('item_id', manualStockForm.item_id)
          .eq('item_type', 'finished_product')

        if (error) throw error
      } else {
        // Yeni kayıt
        const { error } = await supabase
          .from('production_inventory')
          .insert({
            company_id: companyId,
            item_id: manualStockForm.item_id,
            current_stock: manualStockForm.quantity,
            item_type: 'finished_product',
            notes: manualStockForm.notes
          })

        if (error) throw error
      }

      setShowManualStockModal(false)
      resetManualStockForm()
      await loadData()

      alert('✅ Bitmiş ürün üretim deposuna eklendi!')
    } catch (error: any) {
      console.error('Error adding manual stock:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCreateQCTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('production_to_qc_transfers')
        .insert({
          company_id: companyId,
          item_id: qcTransferForm.item_id,
          quantity: qcTransferForm.quantity,
          notes: qcTransferForm.notes,
          requested_by: currentUserId,
        })

      if (error) throw error

      setShowQCTransferModal(false)
      resetQCTransferForm()
      await loadData()

      alert('✅ Kalite kontrole transfer talebi gönderildi!')
    } catch (error: any) {
      console.error('Error creating QC transfer:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const resetManualStockForm = () => {
    setManualStockForm({
      item_id: '',
      quantity: 0,
      notes: '',
    })
  }

  const resetQCTransferForm = () => {
    setQCTransferForm({
      item_id: '',
      quantity: 0,
      notes: '',
    })
  }


  const handleSendOutputToQC = async (output: ProductionOutput) => {
    if (!confirm(`${output.output_item_name} ürününü (${output.quantity} ${output.unit}) kalite kontrole göndermek istediğinizden emin misiniz?`)) return

    try {
      // Kalite kontrole transfer kaydı oluştur
      const { data: transferData, error: transferError } = await supabase
        .from('production_to_qc_transfers')
        .insert({
          company_id: companyId,
          item_id: output.output_item_id,
          quantity: output.quantity,
          notes: `Üretim kaydı #${output.id} - ${output.machine_name} - ${new Date(output.production_date).toLocaleDateString('tr-TR')}`,
          requested_by: currentUserId,
          status: 'approved' // Direkt onaylı olarak gönder
        })
        .select()
        .single()

      if (transferError) throw transferError

      // Üretim kaydının durumunu güncelle
      const { error: updateError } = await supabase
        .from('production_outputs')
        .update({
          transfer_status: 'sent_to_qc',
          qc_transfer_id: transferData.id
        })
        .eq('id', output.id)

      if (updateError) throw updateError

      await loadData()
      alert('✅ Ürün kalite kontrole gönderildi!')
    } catch (error: any) {
      console.error('Error sending to QC:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSendOutputToWarehouse = async (output: ProductionOutput) => {
    if (!confirm(`${output.output_item_name} ürününü (${output.quantity} ${output.unit}) ana depoya göndermek istediğinizden emin misiniz?`)) return

    try {
      // Ana depoya transfer kaydı oluştur
      const { data: transferData, error: transferError } = await supabase
        .from('production_to_warehouse_transfers')
        .insert({
          company_id: companyId,
          item_id: output.output_item_id,
          quantity: output.quantity,
          notes: `Üretim kaydı #${output.id} - ${output.machine_name} - ${new Date(output.production_date).toLocaleDateString('tr-TR')}`,
          requested_by: currentUserId,
          status: 'approved' // Direkt onaylı olarak gönder
        })
        .select()
        .single()

      if (transferError) throw transferError

      // Üretim kaydının durumunu güncelle
      const { error: updateError } = await supabase
        .from('production_outputs')
        .update({
          transfer_status: 'sent_to_warehouse',
          warehouse_transfer_id: transferData.id
        })
        .eq('id', output.id)

      if (updateError) throw updateError

      await loadData()
      alert('✅ Ürün ana depoya gönderildi!')
    } catch (error: any) {
      console.error('Error sending to warehouse:', error)
      alert('❌ Hata: ' + error.message)
    }
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* İşlenmeye Hazır Hammadde */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.rawMaterialsReady}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">İşlenmeye Hazır Hammadde</h3>
            <p className="text-xs text-gray-600 mt-1">Tezgaha verilen - Üretilen - Fire</p>
            {stats.recentProjects.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Son projeler:</p>
                <div className="flex flex-wrap gap-1">
                  {stats.recentProjects.slice(0, 2).map((project, idx) => (
                    <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {project}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* İşlenen Mamul */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-green-100 rounded-lg">
                <Factory className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.finishedProducts}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">İşlenen Mamul</h3>
            <p className="text-xs text-gray-600 mt-1">Toplam üretilen ürün sayısı</p>
          </div>

          {/* Kalite Kontrolde Bekleyen */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TestTube2 className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.pendingQC}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Kalite Kontrolde Bekleyen</h3>
            <p className="text-xs text-gray-600 mt-1">Bekleyen ürün sayısı</p>
          </div>

          {/* Bugünkü Üretim */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-purple-100 rounded-lg">
                <ClipboardList className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.todayProduction}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Bugünkü Üretim</h3>
            <p className="text-xs text-gray-600 mt-1">Bugün üretilen toplam miktar</p>
          </div>

          {/* Verimlilik */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.calculatedScrap.toFixed(2)}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Tezgahlarda Bekleyen</h3>
            <p className="text-xs text-gray-600 mt-1">Verilen - (Üretilen + Fire)</p>
          </div>

          {/* Kayıtlı Fire */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
              <span className="text-3xl font-bold text-gray-900">{Math.round(stats.recordedFire)}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Kayıtlı Fire</h3>
            <p className="text-xs text-gray-600 mt-1">Girilen fire kayıtları</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'inventory'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Üretim Stoğu</span>
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {productionInventory.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Depodan Talepler</span>
              {materialRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {materialRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'assignments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Factory className="w-4 h-4" />
              <span>Tezgaha Hammadde Ver</span>
            </button>

            <button
              onClick={() => setActiveTab('outputs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'outputs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Üretim Kayıtları</span>
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {outputs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('qc-transfers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'qc-transfers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TestTube2 className="w-4 h-4" />
              <span>Kalite Kontrole Gönder</span>
              {qcTransfers.filter(t => t.status === 'pending').length > 0 && (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {qcTransfers.filter(t => t.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('transfers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'transfers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Ana Depoya Transfer</span>
              {warehouseTransfers.filter(t => t.status === 'pending').length > 0 && (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {warehouseTransfers.filter(t => t.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Geçmiş</span>
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {history.length}
              </span>
            </button>
          </nav>
        </div>

        {/* TAB CONTENT */}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Hammaddeler */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-green-50 border-b border-gray-200">
                <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Hammaddeler (Depodan Gelen)
                </h3>
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
                    {productionInventory.filter(item => item.item_type === 'raw_material').map(item => (
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

                {productionInventory.filter(item => item.item_type === 'raw_material').length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Üretim stoğunda hammadde yok. Depodan talep oluşturun.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bitmiş Ürünler - Günlük Üretim Kayıtları */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-purple-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Bitmiş Ürünler (Tezgahtan Gelen Kayıtlar)
                  </h3>
                  <p className="text-sm text-purple-600 mt-1">Günlük üretim kayıtları - KK veya Depoya gönderilebilir</p>
                </div>
                {canCreate('production') && (
                  <button
                    onClick={() => setShowManualStockModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
                  >
                    + Manuel Stok Ekle
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tezgah</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ürün</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Miktar</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vardiya</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outputs.map(output => {
                      const transferStatusColors: Record<string, string> = {
                        pending: 'bg-yellow-100 text-yellow-700',
                        sent_to_qc: 'bg-blue-100 text-blue-700',
                        sent_to_warehouse: 'bg-green-100 text-green-700'
                      }

                      const transferStatusLabels: Record<string, string> = {
                        pending: 'Bekliyor',
                        sent_to_qc: 'KK\'da',
                        sent_to_warehouse: 'Depoda'
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
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{output.output_item_name}</div>
                            <div className="text-xs text-gray-500">{output.output_item_code}</div>
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
                            <span className={`px-2 py-1 text-xs rounded font-semibold ${transferStatusColors[output.transfer_status] || 'bg-gray-100 text-gray-700'}`}>
                              {transferStatusLabels[output.transfer_status] || output.transfer_status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {output.transfer_status === 'pending' && canCreate('production') && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSendOutputToQC(output)}
                                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-semibold"
                                >
                                  KK'ya Gönder
                                </button>
                                <button
                                  onClick={() => handleSendOutputToWarehouse(output)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-semibold"
                                >
                                  Depoya Gönder
                                </button>
                              </div>
                            )}
                            {output.transfer_status !== 'pending' && (
                              <span className="text-xs text-gray-500">Gönderildi</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {outputs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Henüz üretim kaydı yok. Üretim Kayıtları sekmesinden ekleyin.</p>
                  </div>
                )}
              </div>
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

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{req.quantity} {req.unit}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{req.requested_by_name}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(req.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {req.reason && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Sebep</span>
                          <p className="text-gray-900">{req.reason}</p>
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

        {/* QC TRANSFERS TAB */}
        {activeTab === 'qc-transfers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600">Bitmiş ürünleri kalite kontrole gönder</p>
              </div>
              {canCreate('production') && (
                <button
                  onClick={() => setShowQCTransferModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Kalite Kontrole Gönder
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {qcTransfers.map(transfer => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                return (
                  <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{transfer.item_name}</h4>
                        <p className="text-sm text-gray-500">{transfer.item_code}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                        {transfer.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{transfer.quantity} {transfer.unit}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{transfer.requested_by_name}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(transfer.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {transfer.status !== 'pending' && transfer.reviewed_by_name && (
                        <>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">İnceleyen</span>
                            <span className="text-gray-900">{transfer.reviewed_by_name}</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">İnceleme Tarihi</span>
                            <span className="text-gray-900">{transfer.reviewed_at ? new Date(transfer.reviewed_at).toLocaleString('tr-TR') : '-'}</span>
                          </div>
                        </>
                      )}
                      {transfer.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{transfer.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {qcTransfers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz kalite kontrol transfer talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* TRANSFERS TAB */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {canCreate('production') && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Ana Depoya Transfer Talebi
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {warehouseTransfers.map(transfer => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                return (
                  <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{transfer.item_name}</h4>
                        <p className="text-sm text-gray-500">{transfer.item_code}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                        {transfer.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{transfer.quantity} {transfer.unit}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{transfer.requested_by_name}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(transfer.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {transfer.status === 'approved' && transfer.approved_by_name && (
                        <>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Onaylayan</span>
                            <span className="text-gray-900">{transfer.approved_by_name}</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Onay Tarihi</span>
                            <span className="text-gray-900">{transfer.approved_at ? new Date(transfer.approved_at).toLocaleString('tr-TR') : '-'}</span>
                          </div>
                        </>
                      )}
                      {transfer.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{transfer.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {warehouseTransfers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz transfer talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-gray-900 mb-2">📋 Tüm Üretim İşlemleri</h3>
              <p className="text-sm text-gray-700">
                Malzeme talepleri, transferler, üretim çıktıları - tüm geçmiş kayıtlar.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {history.map((item: any) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                const historyTypeLabels: Record<string, { label: string; color: string }> = {
                  material_request: { label: 'Malzeme Talebi', color: 'bg-purple-100 text-purple-700' },
                  warehouse_transfer: { label: 'Depoya Transfer', color: 'bg-blue-100 text-blue-700' },
                  qc_transfer: { label: 'KK\'ya Transfer', color: 'bg-orange-100 text-orange-700' },
                  production_output: { label: 'Üretim Çıktısı', color: 'bg-green-100 text-green-700' }
                }

                const typeInfo = historyTypeLabels[item.history_type] || { label: 'Bilinmiyor', color: 'bg-gray-100 text-gray-700' }

                return (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-800">
                          {item.item?.name || item.output_item?.name || 'Bilinmiyor'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {item.item?.code || item.output_item?.code || '-'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {item.status && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[item.status]}`}>
                            {item.status === 'approved' ? 'ONAYLANDI' : item.status === 'rejected' ? 'REDDEDİLDİ' : 'BEKLEMEDE'}
                          </span>
                        )}
                        {item.quality_status && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            item.quality_status === 'passed' ? 'bg-green-100 text-green-700' :
                            item.quality_status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.quality_status === 'passed' ? 'GEÇTİ' : item.quality_status === 'failed' ? 'KALDI' : 'BEKLEMEDE'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">
                          {item.quantity} {item.item?.unit || item.output_item?.unit || ''}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">
                          {item.history_type === 'production_output' ? 'Operatör' : 'Talep Eden'}
                        </span>
                        <span className="text-gray-900">
                          {item.requested_by?.full_name || item.operator?.full_name || 'Bilinmiyor'}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">
                          {new Date(item.requested_at || item.production_date).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      {item.history_type === 'production_output' && (
                        <>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Tezgah</span>
                            <span className="text-gray-900">
                              {item.machine?.name || 'Bilinmiyor'}
                            </span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Vardiya</span>
                            <span className="text-gray-900">{item.shift || '-'}</span>
                          </div>
                        </>
                      )}
                      {(item.approved_by || item.reviewed_by_user) && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">
                            {item.history_type === 'qc_transfer' ? 'İnceleyen' : 'Onaylayan'}
                          </span>
                          <span className="text-gray-900">
                            {item.approved_by?.full_name || item.reviewed_by_user?.full_name || '-'}
                          </span>
                        </div>
                      )}
                      {item.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {history.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz geçmiş yok</p>
              </div>
            )}
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
                      onChange={(e) => {
                        const selectedMachine = machines.find(m => m.id === e.target.value)
                        setAssignmentForm({
                          ...assignmentForm,
                          machine_id: e.target.value,
                          project_id: selectedMachine?.project_id || '',
                          project_part_id: ''
                        })
                        if (selectedMachine?.project_id) {
                          loadProjectParts(selectedMachine.project_id)
                        } else {
                          setProjectParts([])
                        }
                      }}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.machine_code} - {machine.machine_name}
                          {machine.project_id && ' (Projeye atanmış)'}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Proje {assignmentForm.machine_id && assignmentForm.project_id && '(Tezgahtan otomatik)'}
                    </label>
                    <select
                      value={assignmentForm.project_id}
                      onChange={(e) => {
                        setAssignmentForm({ ...assignmentForm, project_id: e.target.value, project_part_id: '' })
                        if (e.target.value) {
                          loadProjectParts(e.target.value)
                        } else {
                          setProjectParts([])
                        }
                      }}
                      disabled={!!(assignmentForm.machine_id && assignmentForm.project_id)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Proje Seçilmedi</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Parça (Opsiyonel)
                    </label>
                    <select
                      value={assignmentForm.project_part_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, project_part_id: e.target.value })}
                      disabled={!assignmentForm.project_id}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    >
                      <option value="">Parça Seçilmedi</option>
                      {projectParts.map(part => (
                        <option key={part.id} value={part.id}>
                          {part.part_code} - {part.part_name}
                        </option>
                      ))}
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
                      onChange={(e) => {
                        const selectedMachine = machines.find(m => m.id === e.target.value)
                        setOutputForm({
                          ...outputForm,
                          machine_id: e.target.value,
                          project_id: selectedMachine?.project_id || '',
                          project_part_id: ''
                        })
                        if (selectedMachine?.project_id) {
                          loadProjectParts(selectedMachine.project_id)
                        } else {
                          setProjectParts([])
                        }
                      }}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.machine_code} - {machine.machine_name}
                          {machine.project_id && ' (Projeye atanmış)'}
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
                      Üretilen Miktar <span className="text-red-500">*</span>
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Proje {outputForm.machine_id && outputForm.project_id && '(Tezgahtan otomatik)'}
                    </label>
                    <select
                      value={outputForm.project_id}
                      onChange={(e) => {
                        setOutputForm({ ...outputForm, project_id: e.target.value, project_part_id: '' })
                        if (e.target.value) {
                          loadProjectParts(e.target.value)
                        } else {
                          setProjectParts([])
                        }
                      }}
                      disabled={!!(outputForm.machine_id && outputForm.project_id)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Proje Seçilmedi</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.project_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Parça (Opsiyonel)
                    </label>
                    <select
                      value={outputForm.project_part_id}
                      onChange={(e) => setOutputForm({ ...outputForm, project_part_id: e.target.value })}
                      disabled={!outputForm.project_id}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    >
                      <option value="">Parça Seçilmedi</option>
                      {projectParts.map(part => (
                        <option key={part.id} value={part.id}>
                          {part.part_code} - {part.part_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🔥 Fire Miktarı (adet)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={outputForm.fire_quantity}
                      onChange={(e) => setOutputForm({ ...outputForm, fire_quantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fire Sebebi
                    </label>
                    <select
                      value={outputForm.fire_reason}
                      onChange={(e) => setOutputForm({ ...outputForm, fire_reason: e.target.value })}
                      disabled={outputForm.fire_quantity === 0}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    >
                      <option value="damaged">Hasarlı</option>
                      <option value="defective">Kusurlu</option>
                      <option value="expired">Süresi Dolmuş</option>
                      <option value="process_error">İşlem Hatası</option>
                      <option value="quality_fail">Kalite Uygunsuz</option>
                      <option value="measurement_error">Ölçü Hatası</option>
                      <option value="material_fault">Malzeme Hatası</option>
                      <option value="other">Diğer</option>
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


        {/* Manual Stock Modal */}
        {showManualStockModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Manuel Bitmiş Ürün Ekle</h3>
              <p className="text-sm text-gray-600 mb-6">Üretim deposuna doğrudan bitmiş ürün ekleyin</p>

              <form onSubmit={handleManualStockAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bitmiş Ürün <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={manualStockForm.item_id}
                      onChange={(e) => setManualStockForm({ ...manualStockForm, item_id: e.target.value })}
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

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={manualStockForm.quantity}
                      onChange={(e) => setManualStockForm({ ...manualStockForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                    <textarea
                      value={manualStockForm.notes}
                      onChange={(e) => setManualStockForm({ ...manualStockForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Manuel giriş nedeni..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Stok Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualStockModal(false)
                      resetManualStockForm()
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

        {/* QC Transfer Modal */}
        {showQCTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Kalite Kontrole Gönder</h3>
              <p className="text-sm text-gray-600 mb-6">Bitmiş ürünleri kalite kontrol bölümüne gönderin</p>

              <form onSubmit={handleCreateQCTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bitmiş Ürün <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={qcTransferForm.item_id}
                      onChange={(e) => setQCTransferForm({ ...qcTransferForm, item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {productionInventory
                        .filter(item => item.item_type === 'finished_product')
                        .map(item => (
                          <option key={item.id} value={item.item_id}>
                            {item.item_code} - {item.item_name} (Stok: {item.current_stock} {item.unit})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={qcTransferForm.quantity}
                      onChange={(e) => setQCTransferForm({ ...qcTransferForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                    <textarea
                      value={qcTransferForm.notes}
                      onChange={(e) => setQCTransferForm({ ...qcTransferForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Kalite kontrol notları..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Kalite Kontrole Gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQCTransferModal(false)
                      resetQCTransferForm()
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

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Ana Depoya Transfer Talebi</h3>
              <p className="text-sm text-gray-600 mb-6">Üretimde bitmiş ürünleri ana depoya transfer edin</p>

              <form onSubmit={handleCreateTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bitmiş Ürün <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={transferForm.item_id}
                      onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {productionInventory
                        .filter(item => item.item_type === 'finished_product')
                        .map(item => (
                          <option key={item.id} value={item.item_id}>
                            {item.item_code} - {item.item_name} (Stok: {item.current_stock} {item.unit})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={transferForm.quantity}
                      onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                    <textarea
                      value={transferForm.notes}
                      onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Transfer ile ilgili notlarınız..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Transfer Talebi Gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferModal(false)
                      resetTransferForm()
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

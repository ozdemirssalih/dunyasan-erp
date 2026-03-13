'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { Package, Factory, ClipboardCheck, Upload, Download, FileText, X } from 'lucide-react'

type Tab = 'inventory' | 'incoming' | 'outgoing' | 'history' | 'warehouse-qc'

export default function QualityControlPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory')
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Data states
  const [qcInventory, setQCInventory] = useState<any[]>([])
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([])
  const [outgoingTransfers, setOutgoingTransfers] = useState<any[]>([])
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [warehouseQCRequests, setWarehouseQCRequests] = useState<any[]>([])

  // Stats states
  const [stats, setStats] = useState({
    pendingTests: 0,
    passedToday: 0,
    failedToday: 0,
    totalInQC: 0
  })

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState({
    item_id: '',
    quantity: 0,
    quality_result: 'passed',
    notes: '',
  })

  // Submitting state (çift tıklama engellemek için)
  const [submittingTransfer, setSubmittingTransfer] = useState(false)

  // PDF Upload states
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null)
  const [selectedRecordType, setSelectedRecordType] = useState<'qc_transfer' | 'warehouse_qc'>('qc_transfer')
  const [qcDocuments, setQCDocuments] = useState<Record<string, any[]>>({})
  const [warehouseQCDocuments, setWarehouseQCDocuments] = useState<Record<string, any[]>>({})
  const [uploadingPDF, setUploadingPDF] = useState(false)
  const [pdfForm, setPdfForm] = useState({
    document_type: 'test_report',
    document_title: '',
    notes: '',
    file: null as File | null
  })

  useEffect(() => {
    loadData()

    // Her 5 dakikada bir otomatik yenile (sessizce, loading gösterme)
    const interval = setInterval(() => {
      console.log('🔄 [AUTO-REFRESH] Kalite kontrol verileri sessizce yenileniyor...')
      loadData(true) // silent mode
    }, 5 * 60 * 1000) // 5 dakika

    return () => clearInterval(interval)
  }, [])

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        if (!silent) setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      if (!finalCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          await supabase
            .from('profiles')
            .update({ company_id: finalCompanyId })
            .eq('id', user.id)
        } else {
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            await supabase
              .from('profiles')
              .update({ company_id: finalCompanyId })
              .eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) {
        console.error('No company found')
        if (!silent) setLoading(false)
        return
      }

      setCompanyId(finalCompanyId)

      await Promise.all([
        loadQCInventory(finalCompanyId),
        loadIncomingTransfers(finalCompanyId),
        loadOutgoingTransfers(finalCompanyId),
        loadWarehouseItems(finalCompanyId),
        loadStats(finalCompanyId),
        loadHistory(finalCompanyId),
        loadWarehouseQCRequests(finalCompanyId),
        loadQCDocuments(finalCompanyId),
        loadWarehouseQCDocuments(finalCompanyId),
      ])

    } catch (error) {
      console.error('Error loading data:', error)
      if (!silent) alert('Veri yüklenirken hata oluştu!')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadQCInventory = async (companyId: string) => {
    const { data } = await supabase
      .from('quality_control_inventory')
      .select(`
        *,
        item:warehouse_items(code, name, unit, category:warehouse_categories(name))
      `)
      .eq('company_id', companyId)
      .gt('current_stock', 0)

    setQCInventory(data || [])
  }

  const loadIncomingTransfers = async (companyId: string) => {
    const { data } = await supabase
      .from('production_to_qc_transfers')
      .select(`
        *,
        item:warehouse_items(code, name, unit),
        requested_by:profiles!production_to_qc_transfers_requested_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    setIncomingTransfers(data || [])
  }

  const loadOutgoingTransfers = async (companyId: string) => {
    const { data } = await supabase
      .from('qc_to_warehouse_transfers')
      .select(`
        *,
        item:warehouse_items(code, name, unit),
        requested_by:profiles!qc_to_warehouse_transfers_requested_by_fkey(full_name),
        approved_by:profiles!qc_to_warehouse_transfers_approved_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    setOutgoingTransfers(data || [])
  }

  const loadWarehouseItems = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)

    setWarehouseItems(data || [])
  }

  const loadStats = async (companyId: string) => {
    console.log('📊 [QC] loadStats çağrıldı')

    // Bekleyen testler (ÜRÜN SAYISI, test sayısı değil)
    const { data: pendingTestsData } = await supabase
      .from('production_to_qc_transfers')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('status', 'pending')

    const pendingTests = pendingTestsData?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // Bugün geçen testler (ÜRÜN SAYISI)
    const today = new Date().toISOString().split('T')[0]
    const { data: passedTodayData } = await supabase
      .from('qc_to_warehouse_transfers')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('quality_result', 'passed')
      .gte('requested_at', today)

    const passedToday = passedTodayData?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // Bugün kalan testler (ÜRÜN SAYISI)
    const { data: failedTodayData } = await supabase
      .from('qc_to_warehouse_transfers')
      .select('quantity')
      .eq('company_id', companyId)
      .eq('quality_result', 'failed')
      .gte('requested_at', today)

    const failedToday = failedTodayData?.reduce((sum, item) => sum + item.quantity, 0) || 0

    // KK deposundaki toplam ürün
    const { data: qcStock } = await supabase
      .from('quality_control_inventory')
      .select('current_stock')
      .eq('company_id', companyId)
      .gt('current_stock', 0)

    const totalInQC = qcStock?.reduce((sum, item) => sum + item.current_stock, 0) || 0

    console.log('📊 [QC] İstatistikler:', { pendingTests, passedToday, failedToday, totalInQC })

    setStats({
      pendingTests: pendingTests || 0,
      passedToday: passedToday || 0,
      failedToday: failedToday || 0,
      totalInQC
    })
  }

  const loadHistory = async (companyId: string) => {
    // Hem gelen hem giden tüm işlemleri birleştir
    const [incomingData, outgoingData] = await Promise.all([
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

      supabase
        .from('qc_to_warehouse_transfers')
        .select(`
          *,
          item:warehouse_items(code, name, unit),
          requested_by:profiles!qc_to_warehouse_transfers_requested_by_fkey(full_name),
          approved_by:profiles!qc_to_warehouse_transfers_approved_by_fkey(full_name)
        `)
        .eq('company_id', companyId)
        .in('status', ['approved', 'rejected'])
        .order('requested_at', { ascending: false })
    ])

    // İkisini birleştir ve tarihe göre sırala
    const allHistory = [
      ...(incomingData.data || []).map(item => ({ ...item, transfer_type: 'incoming' })),
      ...(outgoingData.data || []).map(item => ({ ...item, transfer_type: 'outgoing' }))
    ].sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())

    setHistory(allHistory)
  }

  const loadWarehouseQCRequests = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_qc_requests')
      .select(`
        *,
        item:warehouse_items(id, code, name, unit),
        requested_by_user:profiles!warehouse_qc_requests_requested_by_fkey(full_name),
        reviewed_by_user:profiles!warehouse_qc_requests_reviewed_by_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })

    setWarehouseQCRequests(data || [])
  }

  const loadQCDocuments = async (companyId: string) => {
    const { data } = await supabase
      .from('quality_control_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })

    if (data) {
      const docsByTransfer: Record<string, any[]> = {}
      data.forEach(doc => {
        if (!docsByTransfer[doc.qc_transfer_id]) {
          docsByTransfer[doc.qc_transfer_id] = []
        }
        docsByTransfer[doc.qc_transfer_id].push(doc)
      })
      setQCDocuments(docsByTransfer)
    }
  }

  const loadWarehouseQCDocuments = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_qc_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })

    if (data) {
      const docsByRequest: Record<string, any[]> = {}
      data.forEach(doc => {
        if (!docsByRequest[doc.warehouse_qc_request_id]) {
          docsByRequest[doc.warehouse_qc_request_id] = []
        }
        docsByRequest[doc.warehouse_qc_request_id].push(doc)
      })
      setWarehouseQCDocuments(docsByRequest)
    }
  }

  const handleApproveWarehouseQC = async (requestId: string, notes: string) => {
    if (!confirm('Bu depo giriş talebini onaylamak istediğinizden emin misiniz? Stok depoya eklenecek.')) return
    if (submittingTransfer) return

    try {
      setSubmittingTransfer(true)

      // Check current status
      const { data: request, error: requestError } = await supabase
        .from('warehouse_qc_requests')
        .select('status')
        .eq('id', requestId)
        .single()

      if (requestError) throw requestError

      if (request.status !== 'pending') {
        alert('⚠️ Bu talep zaten işlenmiş!')
        return
      }

      // Update status - database trigger will handle adding to warehouse_transactions
      const { data: updatedRequest, error: updateError } = await supabase
        .from('warehouse_qc_requests')
        .update({
          status: 'approved',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || 'Onaylandı'
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select()

      if (updateError) throw updateError

      if (!updatedRequest || updatedRequest.length === 0) {
        alert('⚠️ Bu talep zaten işlenmiş veya bulunamadı!')
        return
      }

      alert('✅ Talep onaylandı! Stok depoya eklendi.')
      loadData()
    } catch (error: any) {
      console.error('Error approving warehouse QC:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const handleRejectWarehouseQC = async (requestId: string, notes: string) => {
    if (!notes) {
      alert('⚠️ Red nedeni gerekli!')
      return
    }

    if (!confirm('Bu depo giriş talebini reddetmek istediğinizden emin misiniz?')) return
    if (submittingTransfer) return

    try {
      setSubmittingTransfer(true)

      // Check current status
      const { data: request, error: requestError } = await supabase
        .from('warehouse_qc_requests')
        .select('status')
        .eq('id', requestId)
        .single()

      if (requestError) throw requestError

      if (request.status !== 'pending') {
        alert('⚠️ Bu talep zaten işlenmiş!')
        return
      }

      // Update status to rejected
      const { data: updatedRequest, error: updateError } = await supabase
        .from('warehouse_qc_requests')
        .update({
          status: 'rejected',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select()

      if (updateError) throw updateError

      if (!updatedRequest || updatedRequest.length === 0) {
        alert('⚠️ Bu talep zaten işlenmiş veya bulunamadı!')
        return
      }

      alert('❌ Talep reddedildi.')
      loadData()
    } catch (error: any) {
      console.error('Error rejecting warehouse QC:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const handleApproveIncoming = async (transferId: string) => {
    if (!confirm('Bu transferi onaylamak istediğinizden emin misiniz? Kalite kontrol deposuna eklenecek.')) return
    if (submittingTransfer) return // Çift tıklama engelle

    try {
      setSubmittingTransfer(true)

      // 1. Transfer bilgilerini al ve durumunu kontrol et
      const { data: transfer, error: transferError } = await supabase
        .from('production_to_qc_transfers')
        .select('item_id, quantity, status')
        .eq('id', transferId)
        .single()

      if (transferError) throw transferError

      // Eğer transfer zaten işlenmişse uyar
      if (transfer.status !== 'pending') {
        alert('⚠️ Bu transfer zaten işlenmiş!')
        return
      }

      // 2. Transfer durumunu güncelle (sadece pending olanları)
      // Database trigger otomatik olarak kaliteye ekleme yapacak
      const { data: updatedTransfer, error: updateTransferError } = await supabase
        .from('production_to_qc_transfers')
        .update({
          status: 'approved',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('status', 'pending') // Sadece pending olanları güncelle
        .select()

      console.log('✅ Transfer güncellendi:', updatedTransfer)

      if (updateTransferError) throw updateTransferError

      // Eğer hiçbir satır güncellenmediysede (başka biri önce onaylamış), işlemi durdur
      if (!updatedTransfer || updatedTransfer.length === 0) {
        console.log('❌ Transfer güncellenemedi - zaten işlenmiş olabilir')
        alert('⚠️ Bu transfer zaten işlenmiş veya bulunamadı!')
        return
      }

      console.log('🎉 Transfer onaylandı! Trigger otomatik olarak kaliteye ekleyecek.')

      // 3. Üretim çıktılarının durumunu güncelle (Bekliyor → KK'da)
      const { error: outputsUpdateError } = await supabase
        .from('production_outputs')
        .update({ transfer_status: 'sent_to_qc' })
        .eq('output_item_id', transfer.item_id)
        .eq('transfer_status', 'pending')

      if (outputsUpdateError) {
        console.error('⚠️ Üretim çıktıları güncellenemedi:', outputsUpdateError)
        // Kritik değil, devam et
      } else {
        console.log('✅ Üretim çıktıları "KK\'da" olarak güncellendi')
      }

      // NOT: Kaliteye ekleme işlemi database trigger tarafından yapılıyor
      // approve_production_to_qc_transfer() trigger fonksiyonu:
      // - Sadece kalite kontrol deposuna quantity kadar ekliyor
      // - Üretimden düşme JavaScript tarafında zaten yapılmış durumda

      alert('✅ Transfer onaylandı! Stok kalite kontrol deposuna eklendi.')
      loadData()
    } catch (error: any) {
      console.error('Error approving transfer:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const handleRejectIncoming = async (transferId: string) => {
    if (!confirm('Bu transferi reddetmek istediğinizden emin misiniz? Ürün üretim deposuna geri dönecek.')) return
    if (submittingTransfer) return // Çift tıklama engelle

    try {
      setSubmittingTransfer(true)

      // 1. Transfer bilgilerini al ve durumunu kontrol et
      const { data: transfer, error: transferError } = await supabase
        .from('production_to_qc_transfers')
        .select('item_id, quantity, status')
        .eq('id', transferId)
        .single()

      if (transferError) throw transferError

      // Eğer transfer zaten işlenmişse uyar
      if (transfer.status !== 'pending') {
        alert('⚠️ Bu transfer zaten işlenmiş!')
        return
      }

      // 2. ÖNCE transfer durumunu güncelle (sadece pending olanları)
      const { data: updatedTransfer, error: updateTransferError } = await supabase
        .from('production_to_qc_transfers')
        .update({
          status: 'rejected',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('status', 'pending') // Sadece pending olanları güncelle
        .select()

      if (updateTransferError) throw updateTransferError

      // Eğer hiçbir satır güncellenmediysede, işlemi durdur
      if (!updatedTransfer || updatedTransfer.length === 0) {
        alert('⚠️ Bu transfer zaten işlenmiş veya bulunamadı!')
        return
      }

      // 3. SONRA üretim deposuna geri ekle
      const { data: existingStock, error: checkError } = await supabase
        .from('production_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', transfer.item_id)
        .eq('item_type', 'finished_product')
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') throw checkError

      if (existingStock) {
        // Varsa güncelle
        const { error: updateError } = await supabase
          .from('production_inventory')
          .update({
            current_stock: existingStock.current_stock + transfer.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('item_id', transfer.item_id)
          .eq('item_type', 'finished_product')

        if (updateError) throw updateError
      } else {
        // Yoksa yeni kayıt oluştur
        const { error: insertError } = await supabase
          .from('production_inventory')
          .insert({
            company_id: companyId,
            item_id: transfer.item_id,
            current_stock: transfer.quantity,
            item_type: 'finished_product',
            notes: 'Kalite kontrolden reddedilen ürün'
          })

        if (insertError) throw insertError
      }

      alert('✅ Transfer reddedildi. Ürün üretim deposuna geri döndü.')
      loadData()
    } catch (error: any) {
      console.error('Error rejecting transfer:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const handleCreateOutgoingTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    if (submittingTransfer) return // Çift tıklama engelle

    try {
      setSubmittingTransfer(true)

      // 1. ÖNCE KALİTE INVENTORY KONTROLÜ (hem passed hem failed için)
      const { data: qcStock, error: qcCheckError } = await supabase
        .from('quality_control_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', transferForm.item_id)
        .single()

      if (qcCheckError) {
        throw new Error('Kalite kontrol stoğu bulunamadı!')
      }

      // Stok yeterli mi kontrol et
      if (qcStock.current_stock < transferForm.quantity) {
        alert(`❌ Yetersiz stok!\n\nKalite deposunda: ${qcStock.current_stock} birim\nGöndermek istediğiniz: ${transferForm.quantity} birim`)
        return
      }

      // 2. Kalite inventory'den stoğu düş
      const { error: qcStockError } = await supabase
        .from('quality_control_inventory')
        .update({
          current_stock: qcStock.current_stock - transferForm.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('item_id', transferForm.item_id)

      if (qcStockError) throw qcStockError

      if (transferForm.quality_result === 'passed') {
        // GEÇERSE: Direkt ana depoya ekle (onay bekleme)
        // NOT: Manuel stok güncelleme kaldırıldı - warehouse_transactions trigger'ı otomatik güncelliyor

        // Warehouse transactions kayıt ekle (trigger otomatik olarak stoku güncelleyecek)
        const { error: transactionError } = await supabase
          .from('warehouse_transactions')
          .insert({
            company_id: companyId,
            item_id: transferForm.item_id,
            type: 'entry',
            quantity: transferForm.quantity,
            supplier: 'Kalite Kontrol',
            reference_number: `KK-${new Date().getTime()}`,
            notes: `Kalite testini geçti - ${transferForm.notes || ''}`,
            created_by: currentUserId,
            transaction_date: new Date().toISOString().split('T')[0],
          })

        if (transactionError) throw transactionError

        // 3. Transfer kaydı oluştur (kayıt amaçlı, approved olarak)
        const { error: transferError } = await supabase
          .from('qc_to_warehouse_transfers')
          .insert({
            company_id: companyId,
            item_id: transferForm.item_id,
            quantity: transferForm.quantity,
            quality_result: transferForm.quality_result,
            notes: transferForm.notes,
            requested_by: currentUserId,
            status: 'approved',
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          })

        if (transferError) throw transferError

        alert('✅ Kalite test sonucu kaydedildi! Ürün kalite deposundan düşüldü ve ana depoya eklendi.')
      } else {
        // KALIRSA: Direkt tashih olarak üretime geri gönder (onay bekleme)
        // NOT: Kalite inventory'den stok düşme işlemi yukarıda yapıldı

        // Üretim deposuna tashih olarak ekle - önce kontrol et var mı
        const { data: existingTashih, error: tashihCheckError } = await supabase
          .from('production_inventory')
          .select('current_stock')
          .eq('company_id', companyId)
          .eq('item_id', transferForm.item_id)
          .eq('item_type', 'tashih')
          .maybeSingle()

        if (tashihCheckError && tashihCheckError.code !== 'PGRST116') throw tashihCheckError

        if (existingTashih) {
          // Varsa güncelle
          const { error: updateError } = await supabase
            .from('production_inventory')
            .update({
              current_stock: existingTashih.current_stock + transferForm.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId)
            .eq('item_id', transferForm.item_id)
            .eq('item_type', 'tashih')

          if (updateError) throw updateError
        } else {
          // Yoksa yeni kayıt oluştur
          const { error: insertError } = await supabase
            .from('production_inventory')
            .insert({
              company_id: companyId,
              item_id: transferForm.item_id,
              current_stock: transferForm.quantity,
              item_type: 'tashih',
              notes: `KK reddetti - ${transferForm.notes || 'Kalite testinden geçemedi'}`
            })

          if (insertError) throw insertError
        }

        alert('✅ Kalite test sonucu kaydedildi! Ürün tashih için üretim deposuna gönderildi.')
      }

      setShowTransferModal(false)
      resetTransferForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating transfer:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  const handleUploadPDF = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pdfForm.file || !selectedTransferId || !companyId) return

    setUploadingPDF(true)

    try {
      const timestamp = Date.now()
      const sanitizedFileName = sanitizeFileName(pdfForm.file.name)
      const filePath = `${companyId}/${timestamp}_${sanitizedFileName}`

      const { error: uploadError } = await supabase.storage
        .from('quality-control-docs')
        .upload(filePath, pdfForm.file)

      if (uploadError) throw uploadError

      if (selectedRecordType === 'qc_transfer') {
        const { error: dbError } = await supabase
          .from('quality_control_documents')
          .insert({
            company_id: companyId,
            qc_transfer_id: selectedTransferId,
            document_type: pdfForm.document_type,
            document_title: pdfForm.document_title,
            file_url: filePath,
            file_name: pdfForm.file.name,
            file_size: pdfForm.file.size,
            notes: pdfForm.notes,
            uploaded_by: currentUserId
          })

        if (dbError) throw dbError
      } else {
        const { error: dbError } = await supabase
          .from('warehouse_qc_documents')
          .insert({
            company_id: companyId,
            warehouse_qc_request_id: selectedTransferId,
            document_type: pdfForm.document_type,
            document_title: pdfForm.document_title,
            file_url: filePath,
            file_name: pdfForm.file.name,
            file_size: pdfForm.file.size,
            notes: pdfForm.notes,
            uploaded_by: currentUserId
          })

        if (dbError) throw dbError
      }

      alert('✅ Doküman başarıyla yüklendi!')
      setShowPDFModal(false)
      setPdfForm({
        document_type: 'test_report',
        document_title: '',
        notes: '',
        file: null
      })
      loadData()
    } catch (error: any) {
      console.error('Error uploading PDF:', error)
      alert('❌ Hata: ' + error.message)
    } finally {
      setUploadingPDF(false)
    }
  }

  const handleDeleteDocument = async (docId: string, filePath: string, recordType: 'qc_transfer' | 'warehouse_qc') => {
    if (!confirm('Bu dokümanı silmek istediğinizden emin misiniz?')) return

    try {
      await supabase.storage
        .from('quality-control-docs')
        .remove([filePath])

      const tableName = recordType === 'qc_transfer' ? 'quality_control_documents' : 'warehouse_qc_documents'

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', docId)

      if (error) throw error

      alert('✅ Doküman silindi!')
      loadData()
    } catch (error: any) {
      console.error('Error deleting document:', error)
      alert('❌ Hata: ' + error.message)
    }
  }

  const resetTransferForm = () => {
    setTransferForm({
      item_id: '',
      quantity: 0,
      quality_result: 'passed',
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
    <PermissionGuard module="quality_control" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Kalite Kontrol</h2>
            <p className="text-gray-600">Ürün kalite testi ve onay yönetimi</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bekleyen Testler */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-orange-100 rounded-lg">
                <ClipboardCheck className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.pendingTests}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Bekleyen Ürünler</h3>
            <p className="text-xs text-gray-600 mt-1">Test edilecek ürün sayısı</p>
          </div>

          {/* Bugün Geçen */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-green-100 rounded-lg">
                <ClipboardCheck className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.passedToday}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Bugün Geçen</h3>
            <p className="text-xs text-gray-600 mt-1">Kalite testini geçti</p>
          </div>

          {/* Bugün Kalan */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.failedToday}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">Bugün Kalan</h3>
            <p className="text-xs text-gray-600 mt-1">Kalite testinden geçemedi</p>
          </div>

          {/* KK Deposu */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Factory className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.totalInQC}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">KK Deposu</h3>
            <p className="text-xs text-gray-600 mt-1">Toplam ürün miktarı</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'inventory', label: 'KK Deposu', count: qcInventory.length },
              { id: 'incoming', label: 'Gelen Ürünler', count: incomingTransfers.filter((t: any) => t.status === 'pending').length },
              { id: 'outgoing', label: 'Test Sonuçları', count: outgoingTransfers.filter((t: any) => t.status === 'pending').length },
              { id: 'warehouse-qc', label: 'Depo Kontrol Talepleri', count: warehouseQCRequests.filter((r: any) => r.status === 'pending').length },
              { id: 'history', label: 'Geçmiş', count: history.length },
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
              </button>
            ))}
          </nav>
        </div>

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Test bekleyen ürünler</p>
              <button
                onClick={() => setShowTransferModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                + Test Sonucu Kaydet
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kod</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mevcut Stok</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {qcInventory.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item?.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{item.item?.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {item.item?.category?.name || 'Diğer'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-gray-900">
                          {item.current_stock} <span className="text-sm text-gray-600">{item.item?.unit}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {qcInventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Kalite kontrol deposunda ürün yok</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INCOMING TAB */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                <Factory className="w-5 h-5" />
                Üretimden Gelen Ürünler
              </h3>
              <p className="text-sm text-orange-700">
                Üretim bölümünden kalite kontrole gönderilen ürünleri onaylayın.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {incomingTransfers.map((transfer: any) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                return (
                  <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{transfer.item?.name || 'Bilinmiyor'}</h4>
                        <p className="text-sm text-gray-500">{transfer.item?.code || '-'}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                        {transfer.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{transfer.quantity} {transfer.item?.unit || ''}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Gönderen</span>
                        <span className="text-gray-900">{transfer.requested_by?.full_name || 'Bilinmiyor'}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(transfer.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {transfer.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{transfer.notes}</p>
                        </div>
                      )}
                    </div>

                    {transfer.status === 'pending' && (
                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleApproveIncoming(transfer.id)}
                          disabled={submittingTransfer}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✅ Kabul Et
                        </button>
                        <button
                          onClick={() => handleRejectIncoming(transfer.id)}
                          disabled={submittingTransfer}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ❌ Reddet
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {incomingTransfers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz gelen ürün yok</p>
              </div>
            )}
          </div>
        )}

        {/* OUTGOING TAB */}
        {activeTab === 'outgoing' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                Tüm Kalite Test Sonuçları
              </h3>
              <p className="text-sm text-blue-700">
                Üretimden gelen test sonuçları ve depo giriş kontrol sonuçları.
              </p>
            </div>

            {/* Üretimden Gelen Test Sonuçları */}
            {outgoingTransfers.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <Factory className="w-5 h-5 text-orange-600" />
                  Üretim Test Sonuçları
                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold">
                    {outgoingTransfers.length}
                  </span>
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {outgoingTransfers.map((transfer: any) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                const qualityColors: Record<string, string> = {
                  passed: 'bg-green-100 text-green-700',
                  failed: 'bg-red-100 text-red-700'
                }

                return (
                  <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{transfer.item?.name || 'Bilinmiyor'}</h4>
                        <p className="text-sm text-gray-500">{transfer.item?.code || '-'}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${qualityColors[transfer.quality_result] || 'bg-gray-100 text-gray-700'}`}>
                          {transfer.quality_result === 'passed' ? 'GEÇTİ' : 'KALDI'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                          {transfer.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{transfer.quantity} {transfer.item?.unit || ''}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Test Eden</span>
                        <span className="text-gray-900">{transfer.requested_by?.full_name || 'Bilinmiyor'}</span>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Hedef</span>
                        <span className="font-semibold text-gray-900">
                          {transfer.quality_result === 'passed' ? '→ Ana Depo' : '→ Üretim (Geri Dönüş)'}
                        </span>
                      </div>
                      {transfer.notes && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Not</span>
                          <p className="text-gray-900">{transfer.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* PDF Dokümanlar */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-gray-700">Test Dokümanları</span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {qcDocuments[transfer.id]?.length || 0}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTransferId(transfer.id)
                            setSelectedRecordType('qc_transfer')
                            setShowPDFModal(true)
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                        >
                          <Upload className="w-3 h-3" />
                          PDF Yükle
                        </button>
                      </div>

                      {qcDocuments[transfer.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {qcDocuments[transfer.id].map((doc: any) => (
                            <div key={doc.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-gray-900">{doc.document_title}</div>
                                <div className="text-xs text-gray-600 flex items-center gap-2 mt-1">
                                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                    {doc.document_type === 'test_report' ? 'Test Raporu' :
                                     doc.document_type === 'certificate' ? 'Sertifika' :
                                     doc.document_type === 'measurement' ? 'Ölçüm Sonucu' :
                                     doc.document_type === 'photo' ? 'Fotoğraf' : 'Diğer'}
                                  </span>
                                  <span>{doc.file_name}</span>
                                  <span>({(doc.file_size / 1024).toFixed(1)} KB)</span>
                                </div>
                                {doc.notes && (
                                  <div className="text-xs text-gray-500 mt-1 italic">Not: {doc.notes}</div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(doc.uploaded_at).toLocaleString('tr-TR')}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    const { data, error } = await supabase.storage
                                      .from('quality-control-docs')
                                      .createSignedUrl(doc.file_url, 60)
                                    if (!error && data) {
                                      window.open(data.signedUrl, '_blank')
                                    } else {
                                      alert('❌ Dosya açılamadı: ' + error?.message)
                                    }
                                  }}
                                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc.id, doc.file_url, 'qc_transfer')}
                                  className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                          Henüz doküman yüklenmemiş
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
              </div>
            )}

            {/* Depo Giriş Kontrol Sonuçları */}
            {warehouseQCRequests.filter((r: any) => r.status !== 'pending').length > 0 && (
              <div className="space-y-2 mt-6">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Depo Giriş Kontrol Sonuçları
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                    {warehouseQCRequests.filter((r: any) => r.status !== 'pending').length}
                  </span>
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {warehouseQCRequests.filter((r: any) => r.status !== 'pending').map((request: any) => {
                    const statusColors: Record<string, string> = {
                      approved: 'bg-green-100 text-green-700',
                      rejected: 'bg-red-100 text-red-700'
                    }

                    return (
                      <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-gray-800">{request.item?.name || 'Bilinmiyor'}</h4>
                            <p className="text-sm text-gray-500">{request.item?.code || '-'}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[request.status] || 'bg-gray-100 text-gray-700'}`}>
                            {request.status === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                            <span className="font-semibold text-gray-900">{request.quantity} {request.item?.unit || ''}</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                            <span className="text-gray-900">{request.requested_by_user?.full_name || 'Bilinmiyor'}</span>
                          </div>
                          {request.supplier && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <span className="text-gray-500 text-xs block mb-1">Tedarikçi</span>
                              <span className="text-gray-900">{request.supplier}</span>
                            </div>
                          )}
                          {request.reference_number && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <span className="text-gray-500 text-xs block mb-1">İrsaliye No</span>
                              <span className="text-gray-900">{request.reference_number}</span>
                            </div>
                          )}
                          <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-500 text-xs block mb-1">İnceleme Tarihi</span>
                            <span className="text-gray-900">{new Date(request.reviewed_at).toLocaleString('tr-TR')}</span>
                          </div>
                          {request.review_notes && (
                            <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                              <span className="text-gray-500 text-xs block mb-1">İnceleme Notu</span>
                              <p className="text-gray-900">{request.review_notes}</p>
                            </div>
                          )}
                        </div>

                        {/* PDF Dokümanlar */}
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-semibold text-gray-700">Kontrol Dokümanları</span>
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                {warehouseQCDocuments[request.id]?.length || 0}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedTransferId(request.id)
                                setSelectedRecordType('warehouse_qc')
                                setShowPDFModal(true)
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
                            >
                              <Upload className="w-3 h-3" />
                              PDF Yükle
                            </button>
                          </div>

                          {warehouseQCDocuments[request.id]?.length > 0 ? (
                            <div className="space-y-2">
                              {warehouseQCDocuments[request.id].map((doc: any) => (
                                <div key={doc.id} className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold text-sm text-gray-900">{doc.document_title}</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-2 mt-1">
                                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                        {doc.document_type === 'test_report' ? 'Test Raporu' :
                                         doc.document_type === 'certificate' ? 'Sertifika' :
                                         doc.document_type === 'measurement' ? 'Ölçüm Sonucu' :
                                         doc.document_type === 'photo' ? 'Fotoğraf' : 'Diğer'}
                                      </span>
                                      <span>{doc.file_name}</span>
                                      <span>({(doc.file_size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                    {doc.notes && (
                                      <div className="text-xs text-gray-500 mt-1 italic">Not: {doc.notes}</div>
                                    )}
                                    <div className="text-xs text-gray-500 mt-1">
                                      {new Date(doc.uploaded_at).toLocaleString('tr-TR')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={async () => {
                                        const { data, error } = await supabase.storage
                                          .from('quality-control-docs')
                                          .createSignedUrl(doc.file_url, 60)
                                        if (!error && data) {
                                          window.open(data.signedUrl, '_blank')
                                        } else {
                                          alert('❌ Dosya açılamadı: ' + error?.message)
                                        }
                                      }}
                                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDocument(doc.id, doc.file_url, 'warehouse_qc')}
                                      className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                              Henüz doküman yüklenmemiş
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {outgoingTransfers.length === 0 && warehouseQCRequests.filter((r: any) => r.status !== 'pending').length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz test sonucu yok</p>
              </div>
            )}
          </div>
        )}

        {/* WAREHOUSE QC TAB */}
        {activeTab === 'warehouse-qc' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-gray-900 mb-2">📦 Depo Giriş Kontrol Talepleri</h3>
              <p className="text-sm text-gray-700">
                Depoya kalite kontrol gerektiren ürün giriş talepleri. Onaylandığında otomatik olarak depoya eklenecek.
              </p>
            </div>

            {warehouseQCRequests.length > 0 ? (
              <div className="space-y-3">
                {warehouseQCRequests.map((request: any) => (
                  <div key={request.id} className={`border rounded-lg p-4 ${
                    request.status === 'pending' ? 'bg-yellow-50 border-yellow-300' :
                    request.status === 'approved' ? 'bg-green-50 border-green-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">
                          {request.item?.name || 'Ürün Bilgisi Yok'}
                        </div>
                        <div className="text-sm text-gray-600">
                          Kod: {request.item?.code} | Miktar: {request.quantity} {request.item?.unit}
                        </div>
                        {request.supplier && (
                          <div className="text-xs text-gray-500 mt-1">
                            Tedarikçi: {request.supplier}
                          </div>
                        )}
                        {request.reference_number && (
                          <div className="text-xs text-gray-500">
                            İrsaliye: {request.reference_number}
                          </div>
                        )}
                        {request.notes && (
                          <div className="text-xs text-gray-600 mt-2 italic">
                            Not: {request.notes}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          Talep Eden: {request.requested_by_user?.full_name} • {new Date(request.requested_at).toLocaleString('tr-TR')}
                        </div>
                        {request.status !== 'pending' && request.reviewed_by_user && (
                          <div className="text-xs text-gray-600 mt-1">
                            {request.status === 'approved' ? '✅ Onaylayan' : '❌ Reddeden'}: {request.reviewed_by_user?.full_name} • {new Date(request.reviewed_at).toLocaleString('tr-TR')}
                          </div>
                        )}
                        {request.review_notes && (
                          <div className="text-xs text-gray-700 mt-1 font-semibold">
                            Kontrol Notu: {request.review_notes}
                          </div>
                        )}
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => {
                              const notes = prompt('Onay notu (opsiyonel):')
                              if (notes !== null) {
                                handleApproveWarehouseQC(request.id, notes)
                              }
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                          >
                            ✅ Onayla
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt('Red nedeni:')
                              if (notes) {
                                handleRejectWarehouseQC(request.id, notes)
                              }
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
                          >
                            ❌ Reddet
                          </button>
                        </div>
                      )}

                      {request.status !== 'pending' && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                          request.status === 'approved' ? 'bg-green-200 text-green-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {request.status === 'approved' ? '✅ Onaylandı' : '❌ Reddedildi'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Henüz kalite kontrol talebi yok</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-gray-900 mb-2">📋 Tüm Kalite Kontrol İşlemleri</h3>
              <p className="text-sm text-gray-700">
                Onaylanan ve reddedilen tüm kalite kontrol transferlerinin geçmişi.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {history.map((item: any) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700'
                }

                const qualityColors: Record<string, string> = {
                  passed: 'bg-green-100 text-green-700',
                  failed: 'bg-red-100 text-red-700'
                }

                const isIncoming = item.transfer_type === 'incoming'
                const isOutgoing = item.transfer_type === 'outgoing'

                return (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {isIncoming && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">← Üretimden Gelen</span>}
                          {isOutgoing && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">→ KK'dan Giden</span>}
                        </div>
                        <h4 className="font-bold text-gray-800">{item.item?.name || 'Bilinmiyor'}</h4>
                        <p className="text-sm text-gray-500">{item.item?.code || '-'}</p>
                      </div>
                      <div className="flex gap-2">
                        {isOutgoing && item.quality_result && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${qualityColors[item.quality_result]}`}>
                            {item.quality_result === 'passed' ? 'GEÇTİ' : 'KALDI'}
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[item.status]}`}>
                          {item.status === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Miktar</span>
                        <span className="font-semibold text-gray-900">{item.quantity} {item.item?.unit || ''}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Talep Eden</span>
                        <span className="text-gray-900">{item.requested_by?.full_name || 'Bilinmiyor'}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">Tarih</span>
                        <span className="text-gray-900">{new Date(item.requested_at).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="text-gray-500 text-xs block mb-1">{isIncoming ? 'İnceleyen' : 'Onaylayan'}</span>
                        <span className="text-gray-900">
                          {item.reviewed_by_user?.full_name || item.approved_by?.full_name || '-'}
                        </span>
                      </div>
                      {isOutgoing && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-500 text-xs block mb-1">Hedef</span>
                          <span className="font-semibold text-gray-900">
                            {item.quality_result === 'passed' ? '→ Ana Depo' : '→ Üretim (Geri Dönüş)'}
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

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Kalite Test Sonucu Kaydet</h3>

              <form onSubmit={handleCreateOutgoingTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ürün <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={transferForm.item_id}
                      onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçin...</option>
                      {qcInventory.map((item: any) => (
                        <option key={item.id} value={item.item_id}>
                          {item.item?.code} - {item.item?.name} (Stok: {item.current_stock} {item.item?.unit})
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kalite Test Sonucu <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={transferForm.quality_result}
                      onChange={(e) => setTransferForm({ ...transferForm, quality_result: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    >
                      <option value="passed">✅ Geçti (Ana Depoya Gönder)</option>
                      <option value="failed">❌ Kaldı (Üretime Geri Gönder)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Test Notları</label>
                    <textarea
                      value={transferForm.notes}
                      onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Kalite test detayları..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    disabled={submittingTransfer}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingTransfer ? 'İşlem yapılıyor...' : 'Sonucu Kaydet & Gönder'}
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

        {/* PDF Upload Modal */}
        {showPDFModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Test Dokümanı Yükle</h3>
                <button
                  onClick={() => {
                    setShowPDFModal(false)
                    setPdfForm({
                      document_type: 'test_report',
                      document_title: '',
                      notes: '',
                      file: null
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUploadPDF} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Doküman Türü <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pdfForm.document_type}
                    onChange={(e) => setPdfForm({ ...pdfForm, document_type: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  >
                    <option value="test_report">Test Raporu</option>
                    <option value="certificate">Sertifika</option>
                    <option value="measurement">Ölçüm Sonucu</option>
                    <option value="photo">Fotoğraf</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Doküman Başlığı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pdfForm.document_title}
                    onChange={(e) => setPdfForm({ ...pdfForm, document_title: e.target.value })}
                    placeholder="Örn: Kalite Test Raporu - 27.02.2026"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PDF Dosyası <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setPdfForm({ ...pdfForm, file })
                    }}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">PDF veya resim dosyası yükleyebilirsiniz</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={pdfForm.notes}
                    onChange={(e) => setPdfForm({ ...pdfForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Ek notlar..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    disabled={uploadingPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingPDF ? 'Yükleniyor...' : 'Dokümanı Yükle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPDFModal(false)
                      setPdfForm({
                        document_type: 'test_report',
                        document_title: '',
                        notes: '',
                        file: null
                      })
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

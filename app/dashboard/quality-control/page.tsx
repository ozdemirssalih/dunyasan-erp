'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { Package, Factory, ClipboardCheck } from 'lucide-react'

type Tab = 'inventory' | 'incoming' | 'outgoing' | 'history'

export default function QualityControlPage() {
  const { canCreate } = usePermissions()

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

      // 2. Kalite kontrol deposuna ekle (varsa güncelle, yoksa oluştur)
      const { data: existingStock, error: checkError } = await supabase
        .from('quality_control_inventory')
        .select('current_stock')
        .eq('company_id', companyId)
        .eq('item_id', transfer.item_id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') throw checkError

      if (existingStock) {
        // Varsa güncelle
        const { error: updateError } = await supabase
          .from('quality_control_inventory')
          .update({
            current_stock: existingStock.current_stock + transfer.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('item_id', transfer.item_id)

        if (updateError) throw updateError
      } else {
        // Yoksa yeni kayıt oluştur
        const { error: insertError } = await supabase
          .from('quality_control_inventory')
          .insert({
            company_id: companyId,
            item_id: transfer.item_id,
            current_stock: transfer.quantity,
            notes: 'Üretimden gelen ürün'
          })

        if (insertError) throw insertError
      }

      // 3. Transfer durumunu güncelle (sadece pending olanları)
      const { error } = await supabase
        .from('production_to_qc_transfers')
        .update({
          status: 'approved',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('status', 'pending') // Sadece pending olanları güncelle

      if (error) throw error

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

      // 2. Üretim deposuna geri ekle
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

      // 3. Transfer durumunu güncelle (sadece pending olanları)
      const { error } = await supabase
        .from('production_to_qc_transfers')
        .update({
          status: 'rejected',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('status', 'pending') // Sadece pending olanları güncelle

      if (error) throw error

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
        // GEÇERSE: Ana depoya transfer talebi oluştur (depo onayı bekle)
        const { error } = await supabase
          .from('qc_to_warehouse_transfers')
          .insert({
            company_id: companyId,
            item_id: transferForm.item_id,
            quantity: transferForm.quantity,
            quality_result: transferForm.quality_result,
            notes: transferForm.notes,
            requested_by: currentUserId,
            status: 'pending',
          })

        if (error) throw error

        alert('✅ Kalite test sonucu kaydedildi! Kalite deposundan düşüldü. Ana depoya transfer talebi oluşturuldu, depo onayını bekliyor.')
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
              {canCreate('production') && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  + Test Sonucu Kaydet
                </button>
              )}
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
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
                        >
                          ✅ Kabul Et
                        </button>
                        <button
                          onClick={() => handleRejectIncoming(transfer.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
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
                Test Sonuçları
              </h3>
              <p className="text-sm text-blue-700">
                Kalite test sonuçları. Geçenler ana depoya, kalanlar üretim deposuna geri gönderilir.
              </p>
            </div>

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

                    <div className="grid grid-cols-2 gap-3 text-sm">
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
                  </div>
                )
              })}
            </div>

            {outgoingTransfers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Henüz test sonucu yok</p>
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
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Sonucu Kaydet & Gönder
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

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { FileDown, Upload, Check, X, Clock } from 'lucide-react'

interface Waybill {
  id: string
  waybill_number: string
  waybill_date: string
  waybill_type: 'inbound' | 'outbound'
  status: 'pending' | 'completed' | 'cancelled'
  document_url: string | null
  notes: string | null
  customer_id: string | null
  supplier_id: string | null
  created_at: string
}

type Tab = 'requests' | 'invoices' | 'waybills'

export default function WaybillsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('requests')
  const [waybills, setWaybills] = useState<Waybill[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedWaybill, setSelectedWaybill] = useState<Waybill | null>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)
      await loadWaybills(fetchedCompanyId)
      await loadItems(fetchedCompanyId)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWaybills = async (companyId: string) => {
    const { data } = await supabase
      .from('waybills')
      .select('*')
      .eq('company_id', companyId)
      .order('waybill_date', { ascending: false })

    setWaybills(data || [])
  }

  const loadItems = async (companyId: string) => {
    const { data } = await supabase
      .from('warehouse_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)

    setItems(data || [])
  }

  const handleUploadDocument = async (waybillId: string) => {
    if (!documentFile || !companyId || !userId) return

    try {
      setUploadingId(waybillId)

      // Get waybill data
      const { data: waybill, error: waybillError } = await supabase
        .from('waybills')
        .select('*')
        .eq('id', waybillId)
        .single()

      if (waybillError) throw waybillError
      if (!waybill?.notes) throw new Error('İrsaliye bilgileri bulunamadı')

      // Parse form data from notes
      const formData = JSON.parse(waybill.notes)

      // Upload PDF
      const fileName = `${companyId}/waybills/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(fileName, documentFile)

      if (uploadError) throw uploadError

      // Create warehouse transaction (actual stock exit)
      const { data: transaction, error: transactionError } = await supabase
        .from('warehouse_transactions')
        .insert({
          company_id: companyId,
          item_id: formData.item_id,
          type: 'exit',
          quantity: parseFloat(formData.quantity),
          shipment_destination: formData.shipment_destination,
          reference_number: formData.reference_number,
          notes: formData.notes,
          created_by: userId,
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Update waybill with document and transaction link
      const { error: updateError } = await supabase
        .from('waybills')
        .update({
          document_url: fileName,
          status: 'completed',
          inventory_transaction_id: transaction.id
        })
        .eq('id', waybillId)

      if (updateError) throw updateError

      alert('✅ İrsaliye yüklendi ve stok çıkışı gerçekleştirildi!')
      setDocumentFile(null)
      setSelectedWaybill(null)
      loadWaybills(companyId)
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    } finally {
      setUploadingId(null)
    }
  }

  const handleDownloadDocument = async (documentPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('accounting-documents')
        .createSignedUrl(documentPath, 60)

      if (error) throw error
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (error: any) {
      alert('Belge indirilemedi: ' + error.message)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Yükleniyor...</div>
  }

  const pendingRequests = waybills.filter(w => w.status === 'pending')
  const completedWaybills = waybills.filter(w => w.status === 'completed')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Faturalar ve İrsaliyeler</h1>
        <p className="text-gray-600 mt-2">İrsaliye talepleri ve belge yönetimi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Talepler ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('waybills')}
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'waybills'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          📄 İrsaliyeler ({completedWaybills.length})
        </button>
      </div>

      {/* Talepler Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
              Bekleyen talep yok
            </div>
          ) : (
            pendingRequests.map((wb) => {
              const formData = wb.notes ? JSON.parse(wb.notes) : {}
              const item = items.find(i => i.id === formData.item_id)

              return (
                <div key={wb.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {wb.waybill_number}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded ${
                          wb.waybill_type === 'outbound' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {wb.waybill_type === 'outbound' ? '↑ Çıkış' : '↓ Giriş'}
                        </span>
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 text-xs rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Bekliyor
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Talep Tarihi: {new Date(wb.created_at).toLocaleDateString('tr-TR')} {new Date(wb.created_at).toLocaleTimeString('tr-TR')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Ürün</p>
                      <p className="font-semibold text-gray-900">
                        {item?.code} - {item?.name || 'Ürün bulunamadı'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Miktar</p>
                      <p className="font-semibold text-gray-900">
                        {formData.quantity} {item?.unit || 'adet'}
                      </p>
                    </div>
                    {formData.shipment_destination && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Sevkiyat Hedefi</p>
                        <p className="font-semibold text-blue-600">
                          {formData.shipment_destination}
                        </p>
                      </div>
                    )}
                    {formData.reference_number && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Referans No</p>
                        <p className="font-semibold text-gray-900">
                          {formData.reference_number}
                        </p>
                      </div>
                    )}
                    {formData.notes && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Notlar</p>
                        <p className="text-gray-700">{formData.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">İrsaliye PDF Yükle</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setDocumentFile(file)
                            setSelectedWaybill(wb)
                          }
                        }}
                        className="text-sm"
                      />
                      {documentFile && selectedWaybill?.id === wb.id && (
                        <button
                          onClick={() => handleUploadDocument(wb.id)}
                          disabled={uploadingId === wb.id}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingId === wb.id ? 'Yükleniyor...' : 'PDF Yükle ve Çıkış Yap'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 PDF yüklendiğinde stok otomatik olarak çıkış yapacaktır.
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* İrsaliyeler Tab */}
      {activeTab === 'waybills' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İrsaliye No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Belge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {completedWaybills.map((wb) => (
                  <tr key={wb.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {wb.waybill_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(wb.waybill_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        wb.waybill_type === 'outbound' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {wb.waybill_type === 'outbound' ? '↑ Çıkış' : '↓ Giriş'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded flex items-center gap-1 w-fit bg-green-100 text-green-800">
                        <Check className="w-3 h-3" />
                        Tamamlandı
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {wb.document_url ? (
                        <button
                          onClick={() => handleDownloadDocument(wb.document_url!)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                        >
                          <FileDown className="w-4 h-4" />
                          PDF İndir
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">Yok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {completedWaybills.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Henüz tamamlanmış irsaliye yok
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

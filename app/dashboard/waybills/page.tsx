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

export default function WaybillsPage() {
  const [waybills, setWaybills] = useState<Waybill[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)
      await loadWaybills(fetchedCompanyId)
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

  const handleUploadDocument = async (waybillId: string) => {
    if (!documentFile || !companyId) return

    try {
      setUploadingId(waybillId)

      // Upload PDF
      const fileName = `${companyId}/waybills/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(fileName, documentFile)

      if (uploadError) throw uploadError

      // Update waybill
      const { error: updateError } = await supabase
        .from('waybills')
        .update({
          document_url: fileName,
          status: 'completed'
        })
        .eq('id', waybillId)

      if (updateError) throw updateError

      alert('✅ İrsaliye yüklendi ve tamamlandı!')
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Faturalar ve İrsaliyeler</h1>
        <p className="text-gray-600 mt-2">İrsaliye talepleri ve belge yönetimi</p>
      </div>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {waybills.map((wb) => (
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
                    <span className={`px-2 py-1 text-xs rounded flex items-center gap-1 w-fit ${
                      wb.status === 'completed' ? 'bg-green-100 text-green-800' :
                      wb.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {wb.status === 'completed' && <Check className="w-3 h-3" />}
                      {wb.status === 'cancelled' && <X className="w-3 h-3" />}
                      {wb.status === 'pending' && <Clock className="w-3 h-3" />}
                      {wb.status === 'completed' ? 'Tamamlandı' :
                       wb.status === 'cancelled' ? 'İptal' : 'Bekliyor'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {wb.document_url ? (
                      <button
                        onClick={() => handleDownloadDocument(wb.document_url!)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                      >
                        <FileDown className="w-4 h-4" />
                        İndir
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">Yok</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {wb.status === 'pending' && !wb.document_url && (
                      <div className="flex items-center gap-2">
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
                          className="text-xs"
                        />
                        {documentFile && selectedWaybill?.id === wb.id && (
                          <button
                            onClick={() => handleUploadDocument(wb.id)}
                            disabled={uploadingId === wb.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50"
                          >
                            <Upload className="w-3 h-3" />
                            {uploadingId === wb.id ? 'Yükleniyor...' : 'Gönder'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {waybills.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Henüz irsaliye talebi yok
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

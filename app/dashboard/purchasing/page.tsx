'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Plus, Edit3, Trash2, Search, Check, X, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface PurchasingRecord {
  id: string
  sira_no: number
  siparis_tarihi: string
  firma_adi: string
  satinalma_sorumlusu: string | null
  parca_kodu: string | null
  po_numarasi: string | null
  malzeme_talep_no: string | null
  satinalma_teklif_no: string | null
  fiyat: number | null
  siparis_detayi: string | null
  miktar: number | null
  sevk_irsaliye_no: string | null
  fatura_numarasi: string | null
  satinalma_onay: boolean
  satinalma_red: boolean
  aciklama: string | null
  created_at: string
}

const emptyForm = {
  siparis_tarihi: new Date().toISOString().split('T')[0],
  firma_adi: '',
  satinalma_sorumlusu: '',
  parca_kodu: '',
  po_numarasi: '',
  malzeme_talep_no: '',
  satinalma_teklif_no: '',
  fiyat: '',
  siparis_detayi: '',
  miktar: '',
  sevk_irsaliye_no: '',
  fatura_numarasi: '',
  satinalma_onay: false,
  satinalma_red: false,
  aciklama: ''
}

export default function PurchasingPage() {
  const [records, setRecords] = useState<PurchasingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string>('')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...emptyForm })

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all')
  const [sortField, setSortField] = useState<string>('siparis_tarihi')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Detail view
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, full_name')
        .eq('id', user.id)
        .single()

      const fetchedCompanyId = profile?.company_id
      if (!fetchedCompanyId) return

      setCompanyId(fetchedCompanyId)
      setCurrentUser(profile?.full_name || '')

      const { data, error } = await supabase
        .from('purchasing_tracking')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateNextNumbers = async () => {
    let nextNumber = 1
    try {
      if (companyId) {
        const { data } = await supabase
          .from('purchasing_tracking')
          .select('po_numarasi')
          .eq('company_id', companyId)
          .like('po_numarasi', 'DNYS-%')
          .order('created_at', { ascending: false })
          .limit(1)

        if (data && data.length > 0 && data[0].po_numarasi) {
          const match = data[0].po_numarasi.match(/DNYS-(\d+)/)
          if (match) {
            nextNumber = parseInt(match[1]) + 1
          }
        }
      }
    } catch (err) {
      console.error('PO numarası alınamadı:', err)
    }

    const poNo = `DNYS-${nextNumber}`
    return {
      po_numarasi: poNo,
      malzeme_talep_no: `${poNo}-TLP`,
      satinalma_teklif_no: `${poNo}-TLF`,
    }
  }

  const handleSubmit = async () => {
    if (!formData.firma_adi) {
      alert('Firma adı zorunludur!')
      return
    }

    if (formData.satinalma_onay && formData.satinalma_red) {
      alert('Bir kayıt hem onaylanmış hem reddedilmiş olamaz!')
      return
    }

    try {
      const payload = {
        company_id: companyId,
        siparis_tarihi: formData.siparis_tarihi,
        firma_adi: formData.firma_adi,
        satinalma_sorumlusu: formData.satinalma_sorumlusu || null,
        parca_kodu: formData.parca_kodu || null,
        po_numarasi: formData.po_numarasi || null,
        malzeme_talep_no: formData.malzeme_talep_no || null,
        satinalma_teklif_no: formData.satinalma_teklif_no || null,
        fiyat: formData.fiyat ? parseFloat(formData.fiyat) : null,
        siparis_detayi: formData.siparis_detayi || null,
        miktar: formData.miktar ? parseFloat(formData.miktar) : null,
        sevk_irsaliye_no: formData.sevk_irsaliye_no || null,
        fatura_numarasi: formData.fatura_numarasi || null,
        satinalma_onay: formData.satinalma_onay,
        satinalma_red: formData.satinalma_red,
        aciklama: formData.aciklama || null
      }

      if (editingId) {
        const { error } = await supabase
          .from('purchasing_tracking')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)

        if (error) throw error
        alert('Kayıt güncellendi!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('purchasing_tracking')
          .insert({ ...payload, created_by: user?.id })

        if (error) throw error
        alert('Yeni kayıt eklendi!')
      }

      setShowModal(false)
      setEditingId(null)
      setFormData({ ...emptyForm })
      loadData()
    } catch (error: any) {
      console.error('Error saving:', error)
      alert('Kayıt kaydedilirken hata oluştu: ' + (error.message || ''))
    }
  }

  const handleEdit = (record: PurchasingRecord) => {
    setEditingId(record.id)
    setFormData({
      siparis_tarihi: record.siparis_tarihi,
      firma_adi: record.firma_adi,
      satinalma_sorumlusu: record.satinalma_sorumlusu || '',
      parca_kodu: record.parca_kodu || '',
      po_numarasi: record.po_numarasi || '',
      malzeme_talep_no: record.malzeme_talep_no || '',
      satinalma_teklif_no: record.satinalma_teklif_no || '',
      fiyat: record.fiyat?.toString() || '',
      siparis_detayi: record.siparis_detayi || '',
      miktar: record.miktar?.toString() || '',
      sevk_irsaliye_no: record.sevk_irsaliye_no || '',
      fatura_numarasi: record.fatura_numarasi || '',
      satinalma_onay: record.satinalma_onay,
      satinalma_red: record.satinalma_red,
      aciklama: record.aciklama || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('purchasing_tracking')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('Kayıt silindi!')
      loadData()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Kayıt silinirken hata oluştu!')
    }
  }

  const handleApproval = async (id: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('purchasing_tracking')
        .update({
          satinalma_onay: approved,
          satinalma_red: !approved,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error updating approval:', error)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Sıra', 'Sipariş Tarihi', 'Firma Adı', 'Satınalma Sorumlusu', 'Parça Kodu',
      'PO Numarası', 'Malzeme Talep No', 'Satınalma Teklif No', 'Fiyat',
      'Sipariş Detayı', 'Miktar', 'Sevk İrsaliye No', 'Fatura Numarası',
      'Onay', 'Red', 'Açıklama'
    ]

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      new Date(r.siparis_tarihi).toLocaleDateString('tr-TR'),
      r.firma_adi,
      r.satinalma_sorumlusu || '',
      r.parca_kodu || '',
      r.po_numarasi || '',
      r.malzeme_talep_no || '',
      r.satinalma_teklif_no || '',
      r.fiyat || '',
      r.siparis_detayi || '',
      r.miktar || '',
      r.sevk_irsaliye_no || '',
      r.fatura_numarasi || '',
      r.satinalma_onay ? 'Evet' : 'Hayır',
      r.satinalma_red ? 'Evet' : 'Hayır',
      r.aciklama || ''
    ])

    const csvContent = '\uFEFF' + [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `satinalma-takip-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Filter and sort records
  const filteredRecords = records
    .filter(r => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const match = [
          r.firma_adi, r.parca_kodu, r.po_numarasi, r.malzeme_talep_no,
          r.satinalma_teklif_no, r.siparis_detayi, r.satinalma_sorumlusu,
          r.sevk_irsaliye_no, r.fatura_numarasi, r.aciklama
        ].some(field => field?.toLowerCase().includes(term))
        if (!match) return false
      }

      // Status filter
      if (filterStatus === 'approved') return r.satinalma_onay
      if (filterStatus === 'rejected') return r.satinalma_red
      if (filterStatus === 'pending') return !r.satinalma_onay && !r.satinalma_red

      return true
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

  // Stats
  const totalRecords = records.length
  const approvedCount = records.filter(r => r.satinalma_onay).length
  const rejectedCount = records.filter(r => r.satinalma_red).length
  const pendingCount = records.filter(r => !r.satinalma_onay && !r.satinalma_red).length
  const totalAmount = records.reduce((sum, r) => sum + (r.fiyat || 0), 0)

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Yükleniyor...
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Satınalma Takip</h2>
            <p className="text-gray-600">Satınalma siparişlerini takip edin ve yönetin</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV İndir</span>
            </button>
            <button
              onClick={async () => {
                setEditingId(null)
                const nums = await generateNextNumbers()
                setFormData({
                  ...emptyForm,
                  satinalma_sorumlusu: currentUser,
                  po_numarasi: nums.po_numarasi,
                  malzeme_talep_no: nums.malzeme_talep_no,
                  satinalma_teklif_no: nums.satinalma_teklif_no,
                })
                setShowModal(true)
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Yeni Kayıt</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500">Toplam Kayıt</p>
            <p className="text-2xl font-bold text-gray-800">{totalRecords}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500">Bekleyen</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Onaylanan</p>
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-500">Reddedilen</p>
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-500">Toplam Tutar</p>
            <p className="text-2xl font-bold text-purple-600">{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Firma, parça kodu, PO no, sorumlu ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tümü</option>
                <option value="pending">Bekleyen</option>
                <option value="approved">Onaylanan</option>
                <option value="rejected">Reddedilen</option>
              </select>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Sıra
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('siparis_tarihi')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Sipariş Tarihi</span>
                        <SortIcon field="siparis_tarihi" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('firma_adi')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Firma Adı</span>
                        <SortIcon field="firma_adi" />
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Sorumlu
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Parça Kodu
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      PO No
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Malzeme Talep No
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Teklif No
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('fiyat')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Fiyat</span>
                        <SortIcon field="fiyat" />
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Miktar
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Durum
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => (
                    <>
                      <tr
                        key={record.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          record.satinalma_onay ? 'bg-green-50/30' : record.satinalma_red ? 'bg-red-50/30' : ''
                        }`}
                        onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                      >
                        <td className="px-3 py-3 text-sm text-gray-500 font-mono">{index + 1}</td>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          {new Date(record.siparis_tarihi).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-900">{record.firma_adi}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{record.satinalma_sorumlusu || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 font-mono">{record.parca_kodu || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 font-mono">{record.po_numarasi || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{record.malzeme_talep_no || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{record.satinalma_teklif_no || '-'}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                          {record.fiyat != null ? `${record.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{record.miktar ?? '-'}</td>
                        <td className="px-3 py-3">
                          {record.satinalma_onay ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Onaylandı
                            </span>
                          ) : record.satinalma_red ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              Reddedildi
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                              Bekliyor
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleApproval(record.id, true)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                record.satinalma_onay
                                  ? 'bg-green-100 text-green-600'
                                  : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                              }`}
                              title="Onayla"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApproval(record.id, false)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                record.satinalma_red
                                  ? 'bg-red-100 text-red-600'
                                  : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                              }`}
                              title="Reddet"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(record)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Düzenle"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Detail Row */}
                      {expandedRow === record.id && (
                        <tr key={`${record.id}-detail`} className="bg-blue-50/50">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 font-medium">Sipariş Detayı:</span>
                                <p className="text-gray-800 mt-1">{record.siparis_detayi || '-'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium">Sevk İrsaliye No:</span>
                                <p className="text-gray-800 mt-1">{record.sevk_irsaliye_no || '-'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium">Fatura Numarası:</span>
                                <p className="text-gray-800 mt-1">{record.fatura_numarasi || '-'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium">Açıklama:</span>
                                <p className="text-gray-800 mt-1">{record.aciklama || '-'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Henüz satınalma kaydı yok</p>
              <p className="text-gray-400 text-sm mt-1">Yeni kayıt eklemek için yukarıdaki butonu kullanın</p>
            </div>
          )}
        </div>

        {/* Results count */}
        {filteredRecords.length > 0 && (
          <div className="text-sm text-gray-500 text-right">
            {filteredRecords.length} / {totalRecords} kayıt gösteriliyor
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingId ? 'Kaydı Düzenle' : 'Yeni Satınalma Kaydı'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditingId(null)
                    setFormData({ ...emptyForm })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Row 1: Date, Company, Responsible */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sipariş Tarihi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.siparis_tarihi}
                      onChange={(e) => setFormData({ ...formData, siparis_tarihi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firma Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firma_adi}
                      onChange={(e) => setFormData({ ...formData, firma_adi: e.target.value })}
                      placeholder="Firma adını girin"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Satınalma Sorumlusu</label>
                    <input
                      type="text"
                      value={formData.satinalma_sorumlusu}
                      onChange={(e) => setFormData({ ...formData, satinalma_sorumlusu: e.target.value })}
                      placeholder="Sorumlu kişi"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Row 2: Codes & Numbers */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parça Kodu</label>
                    <input
                      type="text"
                      value={formData.parca_kodu}
                      onChange={(e) => setFormData({ ...formData, parca_kodu: e.target.value })}
                      placeholder="Parça kodu"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş (PO) Numarası</label>
                    <input
                      type="text"
                      value={formData.po_numarasi}
                      onChange={(e) => {
                        const po = e.target.value
                        setFormData({
                          ...formData,
                          po_numarasi: po,
                          malzeme_talep_no: po ? `${po}-TLP` : '',
                          satinalma_teklif_no: po ? `${po}-TLF` : '',
                        })
                      }}
                      placeholder="DNYS-588"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Malzeme Talep No</label>
                    <input
                      type="text"
                      value={formData.malzeme_talep_no}
                      onChange={(e) => setFormData({ ...formData, malzeme_talep_no: e.target.value })}
                      placeholder="DNYS-588-TLP"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Satınalma Teklif No</label>
                    <input
                      type="text"
                      value={formData.satinalma_teklif_no}
                      onChange={(e) => setFormData({ ...formData, satinalma_teklif_no: e.target.value })}
                      placeholder="DNYS-588-TLF"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Row 3: Price, Quantity, Detail */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fiyat}
                      onChange={(e) => setFormData({ ...formData, fiyat: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.miktar}
                      onChange={(e) => setFormData({ ...formData, miktar: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş Detayı</label>
                    <input
                      type="text"
                      value={formData.siparis_detayi}
                      onChange={(e) => setFormData({ ...formData, siparis_detayi: e.target.value })}
                      placeholder="Sipariş detayı"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Row 4: Waybill, Invoice */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sevk İrsaliye No</label>
                    <input
                      type="text"
                      value={formData.sevk_irsaliye_no}
                      onChange={(e) => setFormData({ ...formData, sevk_irsaliye_no: e.target.value })}
                      placeholder="İrsaliye numarası"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fatura Numarası</label>
                    <input
                      type="text"
                      value={formData.fatura_numarasi}
                      onChange={(e) => setFormData({ ...formData, fatura_numarasi: e.target.value })}
                      placeholder="Fatura numarası"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Row 5: Approval & Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Onay Durumu</label>
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.satinalma_onay}
                          onChange={(e) => setFormData({
                            ...formData,
                            satinalma_onay: e.target.checked,
                            satinalma_red: e.target.checked ? false : formData.satinalma_red
                          })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-green-700 font-medium">Onaylandı</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.satinalma_red}
                          onChange={(e) => setFormData({
                            ...formData,
                            satinalma_red: e.target.checked,
                            satinalma_onay: e.target.checked ? false : formData.satinalma_onay
                          })}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-red-700 font-medium">Reddedildi</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                    <textarea
                      value={formData.aciklama}
                      onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                      placeholder="Ek açıklama..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditingId(null)
                    setFormData({ ...emptyForm })
                  }}
                  className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

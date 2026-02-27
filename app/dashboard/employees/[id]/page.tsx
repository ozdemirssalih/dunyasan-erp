'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, Calendar, Factory, User, FileText, Upload, Download, Trash2, Plus, X } from 'lucide-react'

interface Employee {
  id: string
  employee_code: string
  full_name: string
  department?: string
  position?: string
  phone?: string
  email?: string
  hire_date?: string
  salary?: number
  status: string
}

interface DailyProduction {
  id: string
  production_date: string
  capacity_target: number
  actual_production: number
  defect_count: number
  efficiency_rate: number
  shift: string
  notes: string
  created_at: string
  project?: {
    project_code: string
    project_name: string
  }
  machine?: {
    machine_code: string
    machine_name: string
  }
}

interface EmployeeRecord {
  id: string
  record_type: string
  record_title: string
  file_url: string
  file_name: string
  file_size: number
  notes?: string
  uploaded_at: string
  uploaded_by?: {
    full_name: string
  }
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [dailyProductions, setDailyProductions] = useState<DailyProduction[]>([])
  const [records, setRecords] = useState<EmployeeRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    totalProduced: 0,
    totalScrap: 0,
    efficiency: 0,
    totalDays: 0
  })

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    record_type: 'tutanak',
    record_title: '',
    notes: '',
    file: null as File | null
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    loadEmployeeData()
  }, [employeeId])

  const loadEmployeeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)

      // Load employee details
      const { data: employeeData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single()

      setEmployee(employeeData)

      // Load daily production records
      const { data: dailyProductionData, error: dailyError } = await supabase
        .from('machine_daily_production')
        .select(`
          *,
          project:projects(project_code, project_name),
          machine:machines!machine_daily_production_machine_id_fkey(machine_code, machine_name)
        `)
        .eq('employee_id', employeeId)
        .order('production_date', { ascending: false })

      if (dailyError) {
        console.error('Error loading productions:', dailyError)
      }

      setDailyProductions(dailyProductionData || [])

      // Calculate stats
      if (dailyProductionData) {
        const totalProduced = dailyProductionData.reduce((sum, p) => sum + p.actual_production, 0)
        const totalScrap = dailyProductionData.reduce((sum, p) => sum + p.defect_count, 0)
        const avgEfficiency = dailyProductionData.length > 0
          ? dailyProductionData.reduce((sum, p) => sum + p.efficiency_rate, 0) / dailyProductionData.length
          : 0

        setStats({
          totalProduced,
          totalScrap,
          efficiency: avgEfficiency,
          totalDays: dailyProductionData.length
        })
      }

      // Load employee records (PDF documents)
      await loadRecords(profile.company_id)
    } catch (error) {
      console.error('Error loading employee data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecords = async (cId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_records')
        .select(`
          *,
          uploaded_by:profiles(full_name)
        `)
        .eq('company_id', cId)
        .eq('employee_id', employeeId)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error loading records:', error)
        return
      }

      setRecords(data || [])
    } catch (error) {
      console.error('Error in loadRecords:', error)
    }
  }

  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Diğer özel karakterleri alt çizgi yap
      .replace(/_+/g, '_') // Birden fazla alt çizgiyi teke indir
      .replace(/^_|_$/g, '') // Baştaki ve sondaki alt çizgileri kaldır
  }

  const handleFileUpload = async () => {
    if (!uploadForm.file || !uploadForm.record_title || !companyId) {
      alert('Lütfen tüm gerekli alanları doldurun ve bir dosya seçin!')
      return
    }

    // Sadece PDF kabul et
    if (uploadForm.file.type !== 'application/pdf') {
      alert('Sadece PDF dosyaları yüklenebilir!')
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Kullanıcı bulunamadı')

      // Generate unique file name with sanitized filename
      const fileExt = 'pdf'
      const sanitizedName = sanitizeFileName(uploadForm.file.name)
      const fileName = `${employeeId}/${Date.now()}_${sanitizedName}`

      // Upload to Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('employee-records')
        .upload(fileName, uploadForm.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-records')
        .getPublicUrl(fileName)

      // Save record to database
      const { error: dbError } = await supabase
        .from('employee_records')
        .insert({
          company_id: companyId,
          employee_id: employeeId,
          record_type: uploadForm.record_type,
          record_title: uploadForm.record_title,
          file_url: publicUrl,
          file_name: uploadForm.file.name,
          file_size: uploadForm.file.size,
          notes: uploadForm.notes || null,
          uploaded_by: user.id
        })

      if (dbError) throw dbError

      alert('✅ Dosya başarıyla yüklendi!')
      setShowUploadModal(false)
      setUploadForm({
        record_type: 'tutanak',
        record_title: '',
        notes: '',
        file: null
      })
      await loadRecords(companyId)
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`❌ Yükleme hatası: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteRecord = async (recordId: string, fileName: string) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return

    try {
      // Delete from storage
      const filePath = fileName.split('employee-records/')[1]
      if (filePath) {
        await supabase.storage
          .from('employee-records')
          .remove([filePath])
      }

      // Delete from database
      const { error } = await supabase
        .from('employee_records')
        .delete()
        .eq('id', recordId)

      if (error) throw error

      alert('✅ Kayıt silindi!')
      if (companyId) await loadRecords(companyId)
    } catch (error: any) {
      console.error('Delete error:', error)
      alert(`❌ Silme hatası: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Personel bulunamadı</p>
          <button
            onClick={() => router.push('/dashboard/employees')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/employees')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Personel Listesine Dön</span>
        </button>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-4 bg-blue-100 rounded-lg">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{employee.full_name}</h1>
                <p className="text-gray-600">#{employee.employee_code}</p>
                {employee.position && (
                  <p className="text-sm text-gray-600 mt-1">{employee.position}</p>
                )}
                {employee.department && (
                  <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                    {employee.department}
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                employee.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {employee.status === 'active' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
            {employee.phone && (
              <div>
                <p className="text-xs text-gray-600">Telefon</p>
                <p className="text-sm font-medium">{employee.phone}</p>
              </div>
            )}
            {employee.email && (
              <div>
                <p className="text-xs text-gray-600">E-posta</p>
                <p className="text-sm font-medium">{employee.email}</p>
              </div>
            )}
            {employee.hire_date && (
              <div>
                <p className="text-xs text-gray-600">İşe Başlama</p>
                <p className="text-sm font-medium">
                  {new Date(employee.hire_date).toLocaleDateString('tr-TR')}
                </p>
              </div>
            )}
            {employee.salary && (
              <div>
                <p className="text-xs text-gray-600">Maaş</p>
                <p className="text-sm font-medium text-green-600">
                  {employee.salary.toLocaleString('tr-TR')} ₺
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Factory className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Toplam Üretim</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalProduced.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.totalDays} gün</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Toplam Fire</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalScrap.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Ortalama Verimlilik</h3>
          </div>
          <p className={`text-3xl font-bold ${
            stats.efficiency >= 80 ? 'text-green-600' :
            stats.efficiency >= 60 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            %{stats.efficiency.toFixed(1)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Çalışma Günü</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.totalDays}</p>
        </div>
      </div>

      {/* Daily Productions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Günlük Üretim Kayıtları</h2>
          </div>
          <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
            {dailyProductions.length} kayıt
          </span>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {dailyProductions.length > 0 ? (
            dailyProductions.map(record => (
              <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-gray-900">
                      {new Date(record.production_date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {record.project && (
                      <div className="text-sm text-blue-600">
                        {record.project.project_name} ({record.project.project_code})
                      </div>
                    )}
                    {record.machine && (
                      <div className="text-sm text-gray-600 mt-1">
                        🔧 {record.machine.machine_name} ({record.machine.machine_code})
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Vardiya: {record.shift || 'Belirtilmemiş'}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    record.efficiency_rate >= 80 ? 'bg-green-100 text-green-700' :
                    record.efficiency_rate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    %{record.efficiency_rate.toFixed(1)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-600">Hedef</div>
                    <div className="text-sm font-bold text-gray-900">{record.capacity_target}</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-gray-600">Üretilen</div>
                    <div className="text-sm font-bold text-green-600">{record.actual_production}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-xs text-gray-600">Fire</div>
                    <div className="text-sm font-bold text-red-600">{record.defect_count}</div>
                  </div>
                </div>

                {record.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 italic">{record.notes}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Henüz üretim kaydı bulunmuyor</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee Records (PDFs) */}
      <div className="bg-white rounded-xl shadow-md p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">Belgeler & Tutanaklar</h2>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            <span>PDF Yükle</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.length > 0 ? (
            records.map(record => (
              <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm">{record.record_title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(record.uploaded_at).toLocaleDateString('tr-TR')}
                      </p>
                      <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {record.record_type === 'tutanak' ? 'Tutanak' :
                         record.record_type === 'sertifika' ? 'Sertifika' :
                         record.record_type === 'disiplin' ? 'Disiplin' : 'Diğer'}
                      </span>
                    </div>
                  </div>
                </div>

                {record.notes && (
                  <p className="text-xs text-gray-600 mb-3 italic">{record.notes}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {(record.file_size / 1024).toFixed(1)} KB
                  </span>
                  <div className="flex space-x-2">
                    <a
                      href={record.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Görüntüle"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteRecord(record.id, record.file_url)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Henüz belge yüklenmemiş</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">PDF Belge Yükle</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Belge Türü <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadForm.record_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, record_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="tutanak">Tutanak</option>
                  <option value="sertifika">Sertifika</option>
                  <option value="disiplin">Disiplin Kaydı</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Belge Başlığı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadForm.record_title}
                  onChange={(e) => setUploadForm({ ...uploadForm, record_title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Örn: İş Sağlığı ve Güvenliği Eğitimi"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  PDF Dosya <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Sadece PDF dosyaları kabul edilir</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Ek açıklamalar..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={uploading}
              >
                İptal
              </button>
              <button
                onClick={handleFileUpload}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={uploading || !uploadForm.file || !uploadForm.record_title}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Yükle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

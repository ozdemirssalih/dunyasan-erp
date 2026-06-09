'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Users, Plus, Phone, Mail, Briefcase, Calendar, Trash2, Edit, BadgeCheck, DollarSign, Eye, Printer, Filter } from 'lucide-react'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'

interface Employee {
  id: string
  employee_code: string
  full_name: string
  department?: string
  position?: string
  phone?: string
  email?: string
  id_number?: string
  hire_date?: string
  salary?: number
  address?: string
  body_size?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  birth_date?: string
  status: string
  notes?: string
  staff_category?: string
  created_at: string
  efficiency_rate?: number
  total_productions?: number
}

const STAFF_CATEGORIES = [
  { value: 'ana_personel', label: 'Ana Personel', color: 'bg-blue-100 text-blue-700' },
  { value: 'idari_personel', label: 'İdari Personel', color: 'bg-purple-100 text-purple-700' },
  { value: 'stajyer', label: 'Stajyer', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'cirak', label: 'Çırak', color: 'bg-orange-100 text-orange-700' },
]

const getCategoryInfo = (value?: string) => STAFF_CATEGORIES.find(c => c.value === value)

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    department: '',
    position: '',
    phone: '',
    email: '',
    id_number: '',
    hire_date: '',
    salary: '',
    address: '',
    body_size: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    birth_date: '',
    status: 'active',
    staff_category: '',
    notes: ''
  })
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
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

      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('employee_code', { ascending: true })

      // Her personel için verimlilik hesapla
      const employeesWithEfficiency = await Promise.all(
        (data || []).map(async (employee) => {
          const { data: prodById } = await supabase
            .from('machine_daily_production')
            .select('id, efficiency_rate')
            .eq('employee_id', employee.id)

          const { data: prodByIds } = await supabase
            .from('machine_daily_production')
            .select('id, efficiency_rate')
            .contains('employee_ids', [employee.id])

          const allProds = [...(prodById || []), ...(prodByIds || [])]
          const uniqueProds = Array.from(new Map(allProds.map(p => [p.id, p])).values())
          const productions = uniqueProds
          const totalProductions = productions.length
          const avgEfficiency = productions && productions.length > 0
            ? productions.reduce((sum, p) => sum + (p.efficiency_rate || 0), 0) / productions.length
            : 0

          return {
            ...employee,
            efficiency_rate: avgEfficiency,
            total_productions: totalProductions
          }
        })
      )

      setEmployees(employeesWithEfficiency)
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      employee_code: '',
      full_name: '',
      department: '',
      position: '',
      phone: '',
      email: '',
      id_number: '',
      hire_date: '',
      salary: '',
      address: '',
      body_size: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      birth_date: '',
      status: 'active',
      staff_category: '',
      notes: ''
    })
    setEditingEmployee(null)
  }

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee)
      setFormData({
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        department: employee.department || '',
        position: employee.position || '',
        phone: employee.phone || '',
        email: employee.email || '',
        id_number: employee.id_number || '',
        hire_date: employee.hire_date || '',
        salary: employee.salary?.toString() || '',
        address: employee.address || '',
        body_size: (employee as any).body_size || '',
        emergency_contact_name: (employee as any).emergency_contact_name || '',
        emergency_contact_phone: (employee as any).emergency_contact_phone || '',
        birth_date: (employee as any).birth_date || '',
        status: employee.status,
        staff_category: employee.staff_category || '',
        notes: employee.notes || ''
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleSaveEmployee = async () => {
    if (!formData.employee_code || !formData.full_name || !companyId) {
      alert('Personel kodu ve ad soyad zorunludur!')
      return
    }

    try {
      const employeeData = {
        company_id: companyId,
        employee_code: formData.employee_code,
        full_name: formData.full_name,
        department: formData.department || null,
        position: formData.position || null,
        phone: formData.phone || null,
        email: formData.email || null,
        id_number: formData.id_number || null,
        hire_date: formData.hire_date || null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        address: formData.address || null,
        body_size: formData.body_size || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        birth_date: formData.birth_date || null,
        status: formData.status,
        staff_category: formData.staff_category || null,
        notes: formData.notes || null
      }

      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id)

        if (error) {
          console.error('❌ Supabase Error:', error)
          throw error
        }

        alert('✅ Personel başarıyla güncellendi!')
      } else {
        // Create new employee
        const { error } = await supabase
          .from('employees')
          .insert(employeeData)

        if (error) {
          console.error('❌ Supabase Error:', error)
          throw error
        }

        alert('✅ Personel başarıyla eklendi!')
      }

      resetForm()
      setShowModal(false)
      await loadEmployees()
    } catch (error: any) {
      console.error('❌ Error saving employee:', error)
      alert(`Personel kaydedilirken hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!confirm(`"${employeeName}" personelini silmek istediğinizden emin misiniz?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId)

      if (error) {
        console.error('❌ Supabase Error:', error)
        throw error
      }

      alert('✅ Personel başarıyla silindi!')
      await loadEmployees()
    } catch (error: any) {
      console.error('❌ Error deleting employee:', error)
      alert(`Personel silinirken hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const filteredEmployees = categoryFilter
    ? employees.filter(e => e.staff_category === categoryFilter)
    : employees
  const activeEmployees = filteredEmployees.filter(e => e.status === 'active')
  const inactiveEmployees = filteredEmployees.filter(e => e.status === 'inactive')

  const handlePrintAll = () => {
    const printWin = window.open('', '_blank', 'width=1000,height=700')
    if (!printWin) return

    const today = new Date().toLocaleDateString('tr-TR')
    const rows = filteredEmployees.map((emp, i) => {
      const cat = getCategoryInfo(emp.staff_category)?.label || '-'
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${emp.employee_code || ''}</td>
          <td>${emp.full_name || ''}</td>
          <td>${cat}</td>
          <td>${emp.department || '-'}</td>
          <td>${emp.position || '-'}</td>
          <td>${emp.phone || '-'}</td>
          <td>${emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('tr-TR') : '-'}</td>
          <td>${emp.status === 'active' ? 'Aktif' : 'Pasif'}</td>
        </tr>
      `
    }).join('')

    const filterLabel = categoryFilter ? getCategoryInfo(categoryFilter)?.label || '' : 'Tümü'

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Personel Listesi - ${today}</title>
        <style>
          @page { size: A4 landscape; margin: 1.2cm; }
          * { box-sizing: border-box; }
          body { font-family: 'Helvetica', Arial, sans-serif; color: #111; margin: 0; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { margin: 0; font-size: 22px; color: #1e40af; }
          .meta { font-size: 11px; color: #555; text-align: right; }
          .summary { display: flex; gap: 12px; margin-bottom: 14px; }
          .summary-box { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #f9fafb; }
          .summary-box .label { font-size: 10px; color: #555; text-transform: uppercase; }
          .summary-box .value { font-size: 18px; font-weight: 700; color: #111; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          thead { background: #1e40af; color: #fff; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          tbody tr:nth-child(even) { background: #f5f7fb; }
          .footer { margin-top: 18px; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>DÜNYASAN — Personel Listesi</h1>
            <div style="font-size: 10px; color: #555; margin-top: 4px;">
              <strong>Doküman No:</strong> DF42 &nbsp;|&nbsp;
              <strong>Doküman Tarihi:</strong> 06.03.2026/00
            </div>
          </div>
          <div class="meta">
            <div><strong>Tarih:</strong> ${today}</div>
            <div><strong>Kategori:</strong> ${filterLabel}</div>
            <div><strong>Toplam:</strong> ${filteredEmployees.length} kişi</div>
          </div>
        </div>

        <div class="summary">
          <div class="summary-box"><div class="label">Toplam</div><div class="value">${filteredEmployees.length}</div></div>
          <div class="summary-box"><div class="label">Aktif</div><div class="value">${activeEmployees.length}</div></div>
          <div class="summary-box"><div class="label">Pasif</div><div class="value">${inactiveEmployees.length}</div></div>
          ${STAFF_CATEGORIES.map(c => `
            <div class="summary-box">
              <div class="label">${c.label}</div>
              <div class="value">${filteredEmployees.filter(e => e.staff_category === c.value).length}</div>
            </div>
          `).join('')}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Personel Kodu</th>
              <th>Ad Soyad</th>
              <th>Kategori</th>
              <th>Departman</th>
              <th>Pozisyon</th>
              <th>Telefon</th>
              <th>İşe Giriş</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <div>Bu liste ${today} tarihinde sistem tarafından otomatik oluşturulmuştur.</div>
          <div>Hazırlayan: __________________</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `)
    printWin.document.close()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <PermissionGuard module="employees" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Personel Yönetimi</h2>
            <p className="text-gray-600">Şirket personelinizi yönetin ve takip edin</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-sm focus:outline-none"
              >
                <option value="">Tüm Kategoriler</option>
                {STAFF_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePrintAll}
              className="flex items-center space-x-2 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
              title="Tüm personeli PDF olarak yazdır"
            >
              <Printer className="w-5 h-5" />
              <span className="font-semibold">PDF İndir</span>
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Yeni Personel</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Personel</p>
                <p className="text-3xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <Users className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Aktif Personel</p>
                <p className="text-3xl font-bold text-green-600">{activeEmployees.length}</p>
              </div>
              <BadgeCheck className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pasif Personel</p>
                <p className="text-3xl font-bold text-gray-600">{inactiveEmployees.length}</p>
              </div>
              <Users className="w-12 h-12 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Employees Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => {
            const isBirthday = (() => {
              if (!(employee as any).birth_date) return false
              const today = new Date()
              const birth = new Date((employee as any).birth_date)
              return today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth()
            })()
            return (
            <div
              key={employee.id}
              className={`rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow relative ${
                employee.status === 'inactive' ? 'opacity-60 bg-white' : isBirthday ? 'bg-gradient-to-br from-pink-50 via-yellow-50 to-purple-50 border-2 border-pink-300 ring-2 ring-pink-200' : 'bg-white'
              }`}
            >
              {isBirthday && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg animate-bounce">
                  🎂 Doğum Günü Kutlu Olsun! 🎉
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-3 rounded-lg ${
                    isBirthday ? 'bg-pink-100' : employee.status === 'active' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {isBirthday ? (
                      <span className="text-2xl">🎂</span>
                    ) : (
                      <Users className={`w-6 h-6 ${employee.status === 'active' ? 'text-blue-600' : 'text-gray-600'}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold ${isBirthday ? 'text-pink-700' : 'text-gray-800'}`}>
                      {employee.full_name} {isBirthday && '🎉'}
                    </h3>
                    <p className="text-xs text-gray-500">#{employee.employee_code}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {employee.staff_category && (() => {
                        const cat = getCategoryInfo(employee.staff_category)
                        return cat ? (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-semibold ${cat.color}`}>
                            {cat.label}
                          </span>
                        ) : null
                      })()}
                      {employee.status === 'inactive' && (
                        <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                          Pasif
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Link
                    href={`/dashboard/employees/${employee.id}`}
                    className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                    title="Detay"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleOpenModal(employee)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Düzenle"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEmployee(employee.id, employee.full_name)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {employee.position && (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <Briefcase className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{employee.position}</span>
                  </div>
                )}
                {employee.department && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                      {employee.department}
                    </span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                )}
                {employee.hire_date && (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>
                      {new Date(employee.hire_date).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                )}
                {employee.salary && (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="font-semibold text-green-600">
                      {employee.salary.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                )}
              </div>

              {/* Verimlilik Barı */}
              {employee.status === 'active' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">Verimlilik</span>
                    <span className={`text-sm font-bold ${
                      (employee.efficiency_rate || 0) >= 80 ? 'text-green-600' :
                      (employee.efficiency_rate || 0) >= 60 ? 'text-yellow-600' :
                      (employee.efficiency_rate || 0) > 0 ? 'text-red-600' :
                      'text-gray-400'
                    }`}>
                      {employee.efficiency_rate ? `%${employee.efficiency_rate.toFixed(1)}` : 'Veri Yok'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        (employee.efficiency_rate || 0) >= 80 ? 'bg-green-500' :
                        (employee.efficiency_rate || 0) >= 60 ? 'bg-yellow-500' :
                        (employee.efficiency_rate || 0) > 0 ? 'bg-red-500' :
                        'bg-gray-300'
                      }`}
                      style={{ width: `${Math.min(employee.efficiency_rate || 0, 100)}%` }}
                    />
                  </div>
                  {employee.total_productions !== undefined && employee.total_productions > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {employee.total_productions} üretim kaydı
                    </p>
                  )}
                </div>
              )}

              {employee.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 line-clamp-2">{employee.notes}</p>
                </div>
              )}
            </div>
          )})}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-24 h-24 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">
              {categoryFilter ? 'Bu kategoride personel bulunamadı' : 'Henüz personel eklenmemiş'}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {categoryFilter ? 'Farklı bir kategori seçin veya yeni personel ekleyin' : 'İlk personelinizi ekleyerek başlayın'}
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Yeni Personel Ekle</span>
            </button>
          </div>
        )}

        {/* Create/Edit Employee Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">
                  {editingEmployee ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Employee Code and Full Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Personel Kodu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.employee_code}
                      onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Örn: EMP001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Durum <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Pasif</option>
                    </select>
                  </div>
                </div>

                {/* Personel Kategorisi */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Personel Kategorisi
                  </label>
                  <select
                    value={formData.staff_category}
                    onChange={(e) => setFormData({ ...formData, staff_category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçin...</option>
                    {STAFF_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ad Soyad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>

                {/* Department and Position */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Departman
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Örn: Üretim"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pozisyon
                    </label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Örn: Operatör"
                    />
                  </div>
                </div>

                {/* Phone and Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0555 XXX XX XX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      E-posta
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="personel@firma.com"
                    />
                  </div>
                </div>

                {/* ID Number and Hire Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      TC Kimlik No
                    </label>
                    <input
                      type="text"
                      value={formData.id_number}
                      onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="XXXXXXXXXXX"
                      maxLength={11}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      İşe Giriş Tarihi
                    </label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Salary */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Maaş (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Personel adresi..."
                  />
                </div>

                {/* Birth Date & Body Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Doğum Tarihi</label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Beden</label>
                  <select
                    value={formData.body_size}
                    onChange={(e) => setFormData({ ...formData, body_size: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçin...</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="3XL">3XL</option>
                  </select>
                </div>
                </div>

                {/* Emergency Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Yakını Adı</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Acil durumda aranacak kişi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Yakını Telefon</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0532..."
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notlar
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Ek notlar..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveEmployee}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={!formData.employee_code || !formData.full_name}
                >
                  {editingEmployee ? 'Güncelle' : 'Personel Ekle'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

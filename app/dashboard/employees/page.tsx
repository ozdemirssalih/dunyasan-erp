'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Users, Plus, Phone, Mail, Briefcase, Calendar, Trash2, Edit, BadgeCheck, DollarSign } from 'lucide-react'
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
  status: string
  notes?: string
  created_at: string
}

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
    status: 'active',
    notes: ''
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

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

      setEmployees(data || [])
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
      status: 'active',
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
        status: employee.status,
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
        status: formData.status,
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

  const activeEmployees = employees.filter(e => e.status === 'active')
  const inactiveEmployees = employees.filter(e => e.status === 'inactive')

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Personel Yönetimi</h2>
            <p className="text-gray-600">Şirket personelinizi yönetin ve takip edin</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Yeni Personel</span>
          </button>
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
          {employees.map((employee) => (
            <div
              key={employee.id}
              className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow relative ${
                employee.status === 'inactive' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-3 rounded-lg ${
                    employee.status === 'active' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Users className={`w-6 h-6 ${
                      employee.status === 'active' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{employee.full_name}</h3>
                    <p className="text-xs text-gray-500">#{employee.employee_code}</p>
                    {employee.status === 'inactive' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                        Pasif
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
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
              </div>

              {employee.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 line-clamp-2">{employee.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {employees.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-24 h-24 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Henüz personel eklenmemiş</p>
            <p className="text-gray-400 text-sm mb-6">İlk personelinizi ekleyerek başlayın</p>
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

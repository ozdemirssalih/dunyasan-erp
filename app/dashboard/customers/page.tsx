'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, Plus, Phone, Mail, User, MapPin } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'

interface Customer {
  id: string
  customer_name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  tax_number?: string
  tax_office?: string
  created_at: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_number: '',
    tax_office: ''
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
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
        .from('customer_companies')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('customer_name', { ascending: true })

      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!formData.customer_name || !companyId) {
      alert('Müşteri adı zorunludur!')
      return
    }

    try {
      const { error } = await supabase
        .from('customer_companies')
        .insert({
          company_id: companyId,
          customer_name: formData.customer_name,
          contact_person: formData.contact_person || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          tax_number: formData.tax_number || null,
          tax_office: formData.tax_office || null
        })

      if (error) {
        console.error('❌ Supabase Error:', error)
        throw error
      }

      // Reset form and close modal
      setFormData({
        customer_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        tax_office: ''
      })
      setShowModal(false)

      // Reload customers
      await loadCustomers()
    } catch (error: any) {
      console.error('❌ Error creating customer:', error)
      alert(`Müşteri oluşturulurken hata oluştu!\n${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <PermissionGuard module="customers" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Müşteri Yönetimi</h2>
          <p className="text-gray-600">Müşterilerinizi yönetin ve takip edin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Yeni Müşteri</span>
        </button>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <div key={customer.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start space-x-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800">{customer.customer_name}</h3>
                {customer.tax_number && (
                  <p className="text-xs text-gray-500">VKN: {customer.tax_number}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {customer.contact_person && (
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{customer.contact_person}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start space-x-2 text-sm text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                  <span className="line-clamp-2">{customer.address}</span>
                </div>
              )}
            </div>

            {customer.tax_office && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600">Vergi Dairesi: {customer.tax_office}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {customers.length === 0 && (
        <div className="text-center py-16">
          <Building2 className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Henüz müşteri eklenmemiş</p>
          <p className="text-gray-400 text-sm mb-6">İlk müşterinizi ekleyerek başlayın</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Müşteri Ekle</span>
          </button>
        </div>
      )}

      {/* Create Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Yeni Müşteri Ekle</h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({
                    customer_name: '',
                    contact_person: '',
                    phone: '',
                    email: '',
                    address: '',
                    tax_number: '',
                    tax_office: ''
                  })
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Müşteri Adı / Şirket Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Örn: ABC Savunma Teknolojileri A.Ş."
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Yetkili Kişi
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Örn: Ahmet Yılmaz"
                />
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0312 XXX XX XX"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="info@firma.com"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Şirket adresi..."
                />
              </div>

              {/* Tax Number and Office */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vergi Numarası
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="XXXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    value={formData.tax_office}
                    onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Örn: Çankaya"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({
                    customer_name: '',
                    contact_person: '',
                    phone: '',
                    email: '',
                    address: '',
                    tax_number: '',
                    tax_office: ''
                  })
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleCreateCustomer}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!formData.customer_name}
              >
                Müşteri Ekle
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PermissionGuard>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Building2, Calendar, Package } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface SalesOrder {
  id: string
  order_number: string
  order_date: string
  delivery_date?: string
  status: string
  product_name: string
  product_code?: string
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  notes?: string
  customer: {
    id: string
    customer_name: string
    contact_person?: string
  }
  project?: {
    id: string
    project_name: string
    project_code?: string
  }
}

export default function SalesOrdersPage() {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Form states
  const [showModal, setShowModal] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [formData, setFormData] = useState({
    customer_id: '',
    project_id: '',
    order_number: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    product_name: '',
    product_code: '',
    quantity: '',
    unit: 'adet',
    unit_price: '',
    notes: ''
  })

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

      // Load sales orders
      const { data: ordersData } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customer_companies(id, customer_name, contact_person),
          project:projects(id, project_name, project_code)
        `)
        .eq('company_id', fetchedCompanyId)
        .order('order_date', { ascending: false })

      setSalesOrders(ordersData || [])

      // Load customers
      const { data: customersData } = await supabase
        .from('customer_companies')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .eq('is_active', true)
        .order('customer_name')

      setCustomers(customersData || [])

      // Load projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, project_name, project_code')
        .eq('company_id', fetchedCompanyId)
        .order('project_name')

      setProjects(projectsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.customer_id || !formData.order_number || !formData.product_name || !formData.quantity || !formData.unit_price) {
      alert('Lütfen tüm zorunlu alanları doldurun!')
      return
    }

    try {
      const quantity = parseFloat(formData.quantity)
      const unitPrice = parseFloat(formData.unit_price)
      const totalAmount = quantity * unitPrice

      const { error } = await supabase
        .from('sales_orders')
        .insert({
          company_id: companyId,
          customer_id: formData.customer_id,
          project_id: formData.project_id || null,
          order_number: formData.order_number,
          order_date: formData.order_date,
          delivery_date: formData.delivery_date || null,
          product_name: formData.product_name,
          product_code: formData.product_code || null,
          quantity,
          unit: formData.unit,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: 'pending',
          notes: formData.notes || null
        })

      if (error) throw error

      alert('Satış siparişi başarıyla oluşturuldu!')
      setShowModal(false)
      setFormData({
        customer_id: '',
        project_id: '',
        order_number: '',
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        product_name: '',
        product_code: '',
        quantity: '',
        unit: 'adet',
        unit_price: '',
        notes: ''
      })
      loadData()
    } catch (error: any) {
      console.error('Error creating sales order:', error)
      alert('Sipariş oluşturulurken hata oluştu!')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu satış siparişini silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Sipariş silindi!')
      loadData()
    } catch (error) {
      console.error('Error deleting sales order:', error)
      alert('Sipariş silinirken hata oluştu!')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_production: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    const labels: any = {
      pending: 'Beklemede',
      confirmed: 'Onaylandı',
      in_production: 'Üretimde',
      completed: 'Tamamlandı',
      cancelled: 'İptal'
    }
    return { class: badges[status] || badges.pending, label: labels[status] || status }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-600">Yükleniyor...</div></div>
  }

  return (
    <PermissionGuard module="planning" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Satış Siparişleri</h2>
            <p className="text-gray-600">Müşterilerden gelen siparişleri yönetin</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Sipariş</span>
          </button>
        </div>

        {/* Sales Orders List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {salesOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sipariş No</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Müşteri</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Miktar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sipariş Tarihi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Teslim Tarihi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tutar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesOrders.map((order) => {
                    const statusBadge = getStatusBadge(order.status)
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{order.customer?.customer_name}</div>
                          {order.project && (
                            <div className="text-xs text-blue-600">Proje: {order.project.project_name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{order.product_name}</div>
                          {order.product_code && (
                            <div className="text-xs text-gray-600">{order.product_code}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {order.quantity} {order.unit}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(order.order_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-green-600">
                          {order.total_amount?.toFixed(2)} ₺
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDelete(order.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Henüz satış siparişi yok</p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800">Yeni Satış Siparişi</h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Müşteri <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Müşteri Seçin</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.customer_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Proje (Opsiyonel)
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Proje Seçin</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_name} {project.project_code ? `(${project.project_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sipariş No <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.order_number}
                      onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="ÖRN: SO-2024-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sipariş Tarihi
                    </label>
                    <input
                      type="date"
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Teslim Tarihi
                    </label>
                    <input
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ürün Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Ürün adı"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ürün Kodu
                    </label>
                    <input
                      type="text"
                      value={formData.product_code}
                      onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Ürün kodu"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim Fiyat (₺) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {formData.quantity && formData.unit_price && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-green-700 mb-1">Toplam Tutar</div>
                    <div className="text-2xl font-bold text-green-800">
                      {(parseFloat(formData.quantity) * parseFloat(formData.unit_price)).toFixed(2)} ₺
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Sipariş Oluştur
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

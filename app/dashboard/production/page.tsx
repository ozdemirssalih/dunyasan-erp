'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface ProductionOrder {
  id: string
  order_number: string
  project_name: string
  quantity: number
  produced_quantity: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  created_at: string
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    order_number: string
    project_name: string
    quantity: number
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    start_date: string
    end_date: string
  }>({
    order_number: '',
    project_name: '',
    quantity: 0,
    status: 'pending',
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    loadOrders()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('production_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => {
        loadOrders()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadOrders = async () => {
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

      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingOrder) {
        // Update existing order
        const { error } = await supabase
          .from('production_orders')
          .update({
            order_number: formData.order_number,
            project_name: formData.project_name,
            quantity: formData.quantity,
            status: formData.status,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
          })
          .eq('id', editingOrder.id)

        if (error) throw error
      } else {
        // Create new order
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
          .from('production_orders')
          .insert({
            company_id: companyId,
            order_number: formData.order_number,
            project_name: formData.project_name,
            quantity: formData.quantity,
            status: formData.status,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            created_by: user?.id,
          })

        if (error) throw error
      }

      // Reset form and close modal
      setFormData({
        order_number: '',
        project_name: '',
        quantity: 0,
        status: 'pending',
        start_date: '',
        end_date: '',
      })
      setEditingOrder(null)
      setShowModal(false)
      loadOrders()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleEdit = (order: ProductionOrder) => {
    setEditingOrder(order)
    setFormData({
      order_number: order.order_number,
      project_name: order.project_name,
      quantity: order.quantity,
      status: order.status,
      start_date: order.start_date || '',
      end_date: order.end_date || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu siparişi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadOrders()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    const labels = {
      pending: 'Beklemede',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getProgressPercentage = (order: ProductionOrder) => {
    return order.quantity > 0 ? Math.round((order.produced_quantity / order.quantity) * 100) : 0
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Üretim Takip</h2>
          <p className="text-gray-600">Üretim emirlerini yönetin</p>
        </div>
        <button
          onClick={() => {
            setEditingOrder(null)
            setFormData({
              order_number: '',
              project_name: '',
              quantity: 0,
              status: 'pending',
              start_date: '',
              end_date: '',
            })
            setShowModal(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Yeni Sipariş
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Sipariş No</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Proje Adı</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Miktar</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">İlerleme</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Durum</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Başlangıç</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.length > 0 ? (
              orders.map((order) => {
                const progress = getProgressPercentage(order)
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{order.order_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{order.project_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {order.produced_quantity} / {order.quantity}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            progress === 100 ? 'bg-green-600' : progress > 50 ? 'bg-blue-600' : 'bg-orange-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 mt-1">%{progress}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {order.start_date ? new Date(order.start_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                          title="Düzenle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Sil"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Henüz üretim emri bulunmuyor. Yeni sipariş oluşturun.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingOrder ? 'Siparişi Düzenle' : 'Yeni Sipariş'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sipariş No</label>
                <input
                  type="text"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proje Adı</label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Miktar</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="pending">Beklemede</option>
                  <option value="in_progress">Devam Ediyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  {editingOrder ? 'Güncelle' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingOrder(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

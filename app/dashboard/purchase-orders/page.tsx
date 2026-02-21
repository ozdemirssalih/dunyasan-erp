'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, Plus, Eye, Trash2, Package, Calendar, User } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface PurchaseOrder {
  id: string
  order_number: string
  order_date: string
  expected_delivery_date?: string
  status: string
  total_amount: number
  notes?: string
  supplier: {
    id: string
    company_name: string
    contact_person?: string
  }
}

export default function PurchaseOrdersPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders')
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Form states
  const [showModal, setShowModal] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    supplier_id: '',
    order_number: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    notes: ''
  })

  // Items states
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])

  const [newItem, setNewItem] = useState({
    item_type: 'material',
    item_id: '',
    item_name: '',
    item_code: '',
    quantity: '',
    unit: 'kg',
    unit_price: '',
    notes: ''
  })

  // Supplier modal states
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierFormData, setSupplierFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_number: '',
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

      // Load purchase orders
      const { data: ordersData } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, company_name, contact_person)
        `)
        .eq('company_id', fetchedCompanyId)
        .order('order_date', { ascending: false })

      setPurchaseOrders(ordersData || [])

      // Load suppliers
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .eq('is_active', true)
        .order('company_name')

      console.log('✅ Loaded suppliers:', suppliersData?.length || 0)
      setSuppliers(suppliersData || [])

      // Load materials
      const { data: materialsData } = await supabase
        .from('materials')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .eq('is_active', true)
        .order('material_name')

      setMaterials(materialsData || [])

      // Load tools
      const { data: toolsData } = await supabase
        .from('tools')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .eq('is_active', true)
        .order('tool_name')

      setTools(toolsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    if (!newItem.item_name || !newItem.quantity || !newItem.unit_price) {
      alert('Lütfen tüm alanları doldurun!')
      return
    }

    const quantity = parseFloat(newItem.quantity)
    const unitPrice = parseFloat(newItem.unit_price)
    const totalPrice = quantity * unitPrice

    setOrderItems([...orderItems, {
      ...newItem,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice
    }])

    setNewItem({
      item_type: 'material',
      item_id: '',
      item_name: '',
      item_code: '',
      quantity: '',
      unit: 'kg',
      unit_price: '',
      notes: ''
    })
  }

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const handleItemTypeChange = (itemId: string) => {
    if (newItem.item_type === 'material') {
      const material = materials.find(m => m.id === itemId)
      if (material) {
        setNewItem({
          ...newItem,
          item_id: material.id,
          item_name: material.material_name,
          item_code: material.material_code || '',
          unit: material.unit || 'kg'
        })
      }
    } else if (newItem.item_type === 'tool') {
      const tool = tools.find(t => t.id === itemId)
      if (tool) {
        setNewItem({
          ...newItem,
          item_id: tool.id,
          item_name: tool.tool_name,
          item_code: tool.tool_code || '',
          unit: 'adet',
          unit_price: tool.unit_price?.toString() || ''
        })
      }
    }
  }

  const handleSubmit = async () => {
    if (!formData.supplier_id || !formData.order_number || orderItems.length === 0) {
      alert('Lütfen tedarikçi, sipariş numarası seçin ve en az bir ürün ekleyin!')
      return
    }

    try {
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0)

      // Create purchase order
      const { data: newOrder, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          supplier_id: formData.supplier_id,
          order_number: formData.order_number,
          order_date: formData.order_date,
          expected_delivery_date: formData.expected_delivery_date || null,
          total_amount: totalAmount,
          status: 'draft',
          notes: formData.notes || null
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const itemInserts = orderItems.map(item => ({
        purchase_order_id: newOrder.id,
        item_type: item.item_type,
        item_id: item.item_id || null,
        item_name: item.item_name,
        item_code: item.item_code || null,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes || null
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemInserts)

      if (itemsError) throw itemsError

      alert('Satın alma siparişi başarıyla oluşturuldu!')
      setShowModal(false)
      setFormData({
        supplier_id: '',
        order_number: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        notes: ''
      })
      setOrderItems([])
      loadData()
    } catch (error: any) {
      console.error('Error creating purchase order:', error)
      alert('Sipariş oluşturulurken hata oluştu!')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu satın alma siparişini silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Sipariş silindi!')
      loadData()
    } catch (error) {
      console.error('Error deleting purchase order:', error)
      alert('Sipariş silinirken hata oluştu!')
    }
  }

  // Supplier functions
  const handleAddSupplier = async () => {
    if (!supplierFormData.company_name) {
      alert('Tedarikçi adı zorunludur!')
      return
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          company_id: companyId,
          company_name: supplierFormData.company_name,
          contact_person: supplierFormData.contact_person || null,
          phone: supplierFormData.phone || null,
          email: supplierFormData.email || null,
          address: supplierFormData.address || null,
          tax_number: supplierFormData.tax_number || null,
          notes: supplierFormData.notes || null,
          is_active: true
        })

      if (error) throw error

      alert('Tedarikçi başarıyla eklendi!')
      setShowSupplierModal(false)
      setSupplierFormData({
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        notes: ''
      })
      loadData()
    } catch (error: any) {
      console.error('Error adding supplier:', error)
      alert('Tedarikçi eklenirken hata oluştu!')
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Bu tedarikçiyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      alert('Tedarikçi silindi!')
      loadData()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Tedarikçi silinirken hata oluştu!')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    const labels: any = {
      draft: 'Taslak',
      pending: 'Beklemede',
      approved: 'Onaylandı',
      received: 'Teslim Alındı',
      cancelled: 'İptal'
    }
    return { class: badges[status] || badges.draft, label: labels[status] || status }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-600">Yükleniyor...</div></div>
  }

  return (
    <PermissionGuard module="inventory" permission="view">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('orders')}
              className={`${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Siparişler
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`${
                activeTab === 'suppliers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Tedarikçiler
            </button>
          </nav>
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Satın Alma Siparişleri</h2>
                <p className="text-gray-600">Tedarikçilerden yapılan siparişleri yönetin</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Yeni Sipariş</span>
              </button>
            </div>

        {/* Purchase Orders List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {purchaseOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sipariş No</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tedarikçi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sipariş Tarihi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Teslim Tarihi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tutar</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseOrders.map((order) => {
                    const statusBadge = getStatusBadge(order.status)
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{order.supplier?.company_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(order.order_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('tr-TR') : '-'}
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
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Henüz satın alma siparişi yok</p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800">Yeni Satın Alma Siparişi</h3>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tedarikçi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tedarikçi Seçin</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.company_name}
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ÖRN: PO-2024-001"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Beklenen Teslim Tarihi
                    </label>
                    <input
                      type="date"
                      value={formData.expected_delivery_date}
                      onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Add Items */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">Ürün Ekle</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Tipi</label>
                      <select
                        value={newItem.item_type}
                        onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value, item_id: '', item_name: '', item_code: '' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="material">Malzeme</option>
                        <option value="tool">Takım</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>

                    {newItem.item_type === 'material' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Malzeme</label>
                        <select
                          value={newItem.item_id}
                          onChange={(e) => handleItemTypeChange(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Malzeme Seçin</option>
                          {materials.map((mat) => (
                            <option key={mat.id} value={mat.id}>
                              {mat.material_name} ({mat.material_code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {newItem.item_type === 'tool' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Takım</label>
                        <select
                          value={newItem.item_id}
                          onChange={(e) => handleItemTypeChange(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Takım Seçin</option>
                          {tools.map((tool) => (
                            <option key={tool.id} value={tool.id}>
                              {tool.tool_name} ({tool.tool_code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {newItem.item_type === 'other' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Adı</label>
                          <input
                            type="text"
                            value={newItem.item_name}
                            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Ürün Kodu</label>
                          <input
                            type="text"
                            value={newItem.item_code}
                            onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Miktar</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Birim</label>
                      <input
                        type="text"
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Birim Fiyat (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddItem}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ürünü Ekle</span>
                  </button>
                </div>

                {/* Items List */}
                {orderItems.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-4">Sipariş Kalemleri</h4>
                    <div className="space-y-2">
                      {orderItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{item.item_name}</div>
                            <div className="text-sm text-gray-600">
                              {item.quantity} {item.unit} × {item.unit_price} ₺ = {item.total_price.toFixed(2)} ₺
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="text-right pt-3 border-t">
                        <span className="text-lg font-bold text-gray-800">
                          Toplam: {orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)} ₺
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setOrderItems([])
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Sipariş Oluştur
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Tedarikçiler</h2>
                <p className="text-gray-600">Tedarikçileri yönetin</p>
              </div>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Yeni Tedarikçi</span>
              </button>
            </div>

            {/* Suppliers List */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {suppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tedarikçi Adı</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Yetkili</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Telefon</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">E-posta</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vergi No</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{supplier.company_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{supplier.contact_person || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{supplier.phone || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{supplier.email || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{supplier.tax_number || '-'}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteSupplier(supplier.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Henüz tedarikçi yok</p>
                </div>
              )}
            </div>

            {/* Supplier Modal */}
            {showSupplierModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-800">Yeni Tedarikçi</h3>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tedarikçi Adı <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.company_name}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, company_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Yetkili Kişi</label>
                        <input
                          type="text"
                          value={supplierFormData.contact_person}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Telefon</label>
                        <input
                          type="text"
                          value={supplierFormData.phone}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">E-posta</label>
                        <input
                          type="email"
                          value={supplierFormData.email}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Vergi Numarası</label>
                        <input
                          type="text"
                          value={supplierFormData.tax_number}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, tax_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                        <textarea
                          value={supplierFormData.address}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Notlar</label>
                        <textarea
                          value={supplierFormData.notes}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowSupplierModal(false)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleAddSupplier}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Tedarikçi Ekle
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  )
}

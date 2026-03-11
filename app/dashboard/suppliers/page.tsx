'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, Plus, Edit, Trash2, Search, Users, Truck } from 'lucide-react'

type EntityType = 'supplier' | 'customer'
type TabFilter = 'all' | 'supplier' | 'customer'

interface UnifiedEntity {
  id: string
  rawId: string // Gerçek database ID
  type: EntityType // supplier veya customer
  company_name: string
  contact_person?: string
  phone?: string
  email?: string
  tax_number?: string
  tax_office?: string // Sadece customer'da var
  address?: string
  category?: string // Sadece supplier'da var
  notes?: string // Sadece supplier'da var
  is_active: boolean
}

export default function SuppliersPage() {
  const [entities, setEntities] = useState<UnifiedEntity[]>([])
  const [filteredEntities, setFilteredEntities] = useState<UnifiedEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEntity, setEditingEntity] = useState<UnifiedEntity | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [formData, setFormData] = useState({
    type: 'supplier' as EntityType,
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_number: '',
    tax_office: '',
    address: '',
    category: '',
    notes: '',
    is_active: true
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterEntities()
  }, [searchTerm, tabFilter, categoryFilter, entities])

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

      // Tedarikçileri çek
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('company_name', { ascending: true })

      const suppliers: UnifiedEntity[] = (suppliersData || []).map(s => ({
        id: `supplier-${s.id}`,
        rawId: s.id,
        type: 'supplier',
        company_name: s.company_name,
        contact_person: s.contact_person || undefined,
        phone: s.phone || undefined,
        email: s.email || undefined,
        tax_number: s.tax_number || undefined,
        address: s.address || undefined,
        category: s.category || undefined,
        notes: s.notes || undefined,
        is_active: s.is_active ?? true
      }))

      // Müşterileri çek
      const { data: customersData } = await supabase
        .from('customer_companies')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .order('customer_name', { ascending: true })

      const customers: UnifiedEntity[] = (customersData || []).map(c => ({
        id: `customer-${c.id}`,
        rawId: c.id,
        type: 'customer',
        company_name: c.customer_name,
        contact_person: c.contact_person || undefined,
        phone: c.phone || undefined,
        email: c.email || undefined,
        tax_number: c.tax_number || undefined,
        tax_office: c.tax_office || undefined,
        address: c.address || undefined,
        is_active: true // customer_companies'de is_active yok, varsayılan true
      }))

      setEntities([...suppliers, ...customers])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEntities = () => {
    let filtered = entities

    // Tab filter
    if (tabFilter !== 'all') {
      filtered = filtered.filter(e => e.type === tabFilter)
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(e =>
        e.company_name.toLowerCase().includes(term) ||
        e.contact_person?.toLowerCase().includes(term) ||
        e.phone?.includes(term) ||
        e.email?.toLowerCase().includes(term)
      )
    }

    // Category filter (sadece supplier'lar için)
    if (categoryFilter) {
      filtered = filtered.filter(e => e.type === 'supplier' && e.category === categoryFilter)
    }

    setFilteredEntities(filtered)
  }

  const handleCreateOrUpdate = async () => {
    if (!formData.company_name || !companyId) {
      alert('Şirket adı zorunludur!')
      return
    }

    try {
      if (editingEntity) {
        // Update
        if (editingEntity.type === 'supplier') {
          const { error } = await supabase
            .from('suppliers')
            .update({
              company_name: formData.company_name,
              contact_person: formData.contact_person || null,
              phone: formData.phone || null,
              email: formData.email || null,
              tax_number: formData.tax_number || null,
              address: formData.address || null,
              category: formData.category || null,
              notes: formData.notes || null,
              is_active: formData.is_active,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingEntity.rawId)

          if (error) throw error
          alert('✅ Tedarikçi güncellendi!')
        } else {
          // Customer update
          const { error } = await supabase
            .from('customer_companies')
            .update({
              customer_name: formData.company_name,
              contact_person: formData.contact_person || null,
              phone: formData.phone || null,
              email: formData.email || null,
              tax_number: formData.tax_number || null,
              tax_office: formData.tax_office || null,
              address: formData.address || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingEntity.rawId)

          if (error) throw error
          alert('✅ Müşteri güncellendi!')
        }
      } else {
        // Create
        if (formData.type === 'supplier') {
          const { error } = await supabase
            .from('suppliers')
            .insert({
              company_id: companyId,
              company_name: formData.company_name,
              contact_person: formData.contact_person || null,
              phone: formData.phone || null,
              email: formData.email || null,
              tax_number: formData.tax_number || null,
              address: formData.address || null,
              category: formData.category || null,
              notes: formData.notes || null,
              is_active: formData.is_active
            })

          if (error) throw error
          alert('✅ Tedarikçi eklendi!')
        } else {
          // Customer create
          const { error } = await supabase
            .from('customer_companies')
            .insert({
              company_id: companyId,
              customer_name: formData.company_name,
              contact_person: formData.contact_person || null,
              phone: formData.phone || null,
              email: formData.email || null,
              tax_number: formData.tax_number || null,
              tax_office: formData.tax_office || null,
              address: formData.address || null
            })

          if (error) throw error
          alert('✅ Müşteri eklendi!')
        }
      }

      resetForm()
      setShowModal(false)
      await loadData()
    } catch (error: any) {
      console.error('Error saving:', error)
      alert(`❌ Hata: ${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleEdit = (entity: UnifiedEntity) => {
    setEditingEntity(entity)
    setFormData({
      type: entity.type,
      company_name: entity.company_name,
      contact_person: entity.contact_person || '',
      phone: entity.phone || '',
      email: entity.email || '',
      tax_number: entity.tax_number || '',
      tax_office: entity.tax_office || '',
      address: entity.address || '',
      category: entity.category || '',
      notes: entity.notes || '',
      is_active: entity.is_active
    })
    setShowModal(true)
  }

  const handleDelete = async (entity: UnifiedEntity) => {
    if (!confirm(`"${entity.company_name}" kaydını silmek istediğinizden emin misiniz?`)) {
      return
    }

    try {
      if (entity.type === 'supplier') {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', entity.rawId)

        if (error) throw error
        alert('✅ Tedarikçi silindi!')
      } else {
        const { error } = await supabase
          .from('customer_companies')
          .delete()
          .eq('id', entity.rawId)

        if (error) throw error
        alert('✅ Müşteri silindi!')
      }

      await loadData()
    } catch (error: any) {
      console.error('Error deleting:', error)
      alert(`❌ Hata: ${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'supplier',
      company_name: '',
      contact_person: '',
      phone: '',
      email: '',
      tax_number: '',
      tax_office: '',
      address: '',
      category: '',
      notes: '',
      is_active: true
    })
    setEditingEntity(null)
  }

  const categories = Array.from(new Set(entities.filter(e => e.type === 'supplier' && e.category).map(e => e.category!)))
  const supplierCount = entities.filter(e => e.type === 'supplier').length
  const customerCount = entities.filter(e => e.type === 'customer').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Tedarikçiler & Müşteriler</h2>
          <p className="text-gray-600">Tedarikçi ve müşterilerinizi tek sayfada yönetin</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Yeni Ekle</span>
        </button>
      </div>

      {/* Stats + Tabs */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-3">
            <button
              onClick={() => setTabFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                tabFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tümü ({entities.length})
            </button>
            <button
              onClick={() => setTabFilter('supplier')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                tabFilter === 'supplier'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              Tedarikçiler ({supplierCount})
            </button>
            <button
              onClick={() => setTabFilter('customer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                tabFilter === 'customer'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Müşteriler ({customerCount})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Şirket adı, yetkili, telefon veya e-mail ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {tabFilter !== 'customer' && (
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Kategoriler</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Toplam {filteredEntities.length} kayıt gösteriliyor
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Şirket Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yetkili</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntities.map((entity) => (
                <tr key={entity.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      entity.type === 'supplier'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {entity.type === 'supplier' ? 'Tedarikçi' : 'Müşteri'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{entity.company_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entity.contact_person || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entity.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entity.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {entity.category ? (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {entity.category}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      entity.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {entity.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(entity)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entity)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingEntity
                  ? `${editingEntity.type === 'supplier' ? 'Tedarikçi' : 'Müşteri'} Düzenle`
                  : `Yeni ${formData.type === 'supplier' ? 'Tedarikçi' : 'Müşteri'}`
                }
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
              {/* Tip Seçimi - Sadece yeni kayıtta */}
              {!editingEntity && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tip <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'supplier' })}
                      className={`px-4 py-3 rounded-lg border-2 font-semibold transition-colors flex items-center justify-center gap-2 ${
                        formData.type === 'supplier'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Truck className="w-5 h-5" />
                      Tedarikçi
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'customer' })}
                      className={`px-4 py-3 rounded-lg border-2 font-semibold transition-colors flex items-center justify-center gap-2 ${
                        formData.type === 'customer'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Users className="w-5 h-5" />
                      Müşteri
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şirket Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: ABC Tedarik A.Ş."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Yetkili Kişi
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: 0532 123 45 67"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: info@firma.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vergi No
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: 1234567890"
                  />
                </div>
              </div>

              {/* Müşteri için Vergi Dairesi */}
              {(formData.type === 'customer' || editingEntity?.type === 'customer') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    value={formData.tax_office}
                    onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Kadıköy"
                  />
                </div>
              )}

              {/* Tedarikçi için Kategori */}
              {(formData.type === 'supplier' || editingEntity?.type === 'supplier') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: KESİCİ TAKIM, HAMMADDE, vb."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Tam adres..."
                />
              </div>

              {/* Tedarikçi için Notlar */}
              {(formData.type === 'supplier' || editingEntity?.type === 'supplier') && (
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
              )}

              {/* Tedarikçi için Aktif/Pasif */}
              {(formData.type === 'supplier' || editingEntity?.type === 'supplier') && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Aktif
                  </label>
                </div>
              )}
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
                onClick={handleCreateOrUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!formData.company_name}
              >
                {editingEntity ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

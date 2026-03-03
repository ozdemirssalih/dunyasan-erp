'use client'
import PermissionGuard from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Tag, TrendingUp, TrendingDown, X } from 'lucide-react'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  description: string | null
  color: string | null
  is_active: boolean
}

export function CategoriesTab() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'income' as 'income' | 'expense',
    description: '',
    color: '#3B82F6',
  })

  const COLORS = [
    { name: 'Mavi', value: '#3B82F6' },
    { name: 'Yeşil', value: '#10B981' },
    { name: 'Kırmızı', value: '#EF4444' },
    { name: 'Turuncu', value: '#F59E0B' },
    { name: 'Mor', value: '#8B5CF6' },
    { name: 'Pembe', value: '#EC4899' },
    { name: 'Turkuaz', value: '#14B8A6' },
    { name: 'Sarı', value: '#EAB308' },
  ]

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

      if (!profile?.company_id) return

      setCompanyId(profile.company_id)
      await loadCategories(profile.company_id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async (companyId: string) => {
    const { data } = await supabase
      .from('accounting_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: true })
      .order('name', { ascending: true })

    setCategories(data || [])
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setForm({
      name: category.name,
      type: category.type,
      description: category.description || '',
      color: category.color || '#3B82F6',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('accounting_categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadCategories(companyId!)
      alert('Kategori silindi!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('accounting_categories')
          .update({
            name: form.name,
            type: form.type,
            description: form.description || null,
            color: form.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('accounting_categories')
          .insert({
            company_id: companyId,
            name: form.name,
            type: form.type,
            description: form.description || null,
            color: form.color,
            is_active: true,
          })

        if (error) throw error
      }

      setShowModal(false)
      setEditingCategory(null)
      setForm({ name: '', type: 'income', description: '', color: '#3B82F6' })
      await loadCategories(companyId)
      alert(editingCategory ? 'Kategori güncellendi!' : 'Kategori oluşturuldu!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const incomeCategories = categories.filter(c => c.type === 'income' && c.is_active)
  const expenseCategories = categories.filter(c => c.type === 'expense' && c.is_active)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gelir/Gider Kategorileri</h1>
            <p className="text-gray-600 mt-1">İşlem kategorilerini yönetin</p>
          </div>
          <button
            onClick={() => {
              setEditingCategory(null)
              setForm({ name: '', type: 'income', description: '', color: '#3B82F6' })
              setShowModal(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-5 h-5" />
            Yeni Kategori
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingUp className="w-7 h-7" />
              </div>
              <Tag className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{incomeCategories.length}</div>
            <div className="text-green-100 text-sm font-medium">Gelir Kategorisi</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-lg p-3">
                <TrendingDown className="w-7 h-7" />
              </div>
              <Tag className="w-5 h-5 opacity-70" />
            </div>
            <div className="text-3xl font-bold mb-1">{expenseCategories.length}</div>
            <div className="text-red-100 text-sm font-medium">Gider Kategorisi</div>
          </div>
        </div>

        {/* Income Categories */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-green-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Gelir Kategorileri
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Renk</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incomeCategories.length > 0 ? (
                  incomeCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: category.color || '#3B82F6' }}></div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{category.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{category.description || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGuard module="accounting" permission="edit">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(category)}
                              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <PermissionGuard module="accounting" permission="delete">
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Henüz gelir kategorisi yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-red-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Gider Kategorileri
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Renk</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kategori Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenseCategories.length > 0 ? (
                  expenseCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: category.color || '#3B82F6' }}></div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{category.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{category.description || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGuard module="accounting" permission="edit">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(category)}
                              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <PermissionGuard module="accounting" permission="delete">
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Henüz gider kategorisi yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tip *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'income' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'income'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      💰 Gelir
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'expense' })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        form.type === 'expense'
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      💸 Gider
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori Adı *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Satış Geliri, Kira Gideri"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Kategori açıklaması..."
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Renk</label>
                  <div className="grid grid-cols-4 gap-3">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setForm({ ...form, color: color.value })}
                        className={`h-12 rounded-lg transition-all ${
                          form.color === color.value ? 'ring-4 ring-blue-500 ring-offset-2' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    {editingCategory ? 'Güncelle' : 'Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  )
}

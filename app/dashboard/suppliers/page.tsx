'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Building2, Plus, Edit, Trash2, Search, Printer } from 'lucide-react'

interface Supplier {
  id: string
  company_name: string
  contact_person?: string
  phone?: string
  email?: string
  tax_number?: string
  address?: string
  category?: string
  notes?: string
  is_active: boolean
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_number: '',
    address: '',
    category: '',
    notes: '',
    is_active: true
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    filterSuppliers()
  }, [searchTerm, categoryFilter, suppliers])

  const loadSuppliers = async () => {
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
        .from('suppliers')
        .select('*')
        .eq('company_id', fetchedCompanyId)
        .eq('is_active', true)
        .order('company_name', { ascending: true })

      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrintApprovedList = () => {
    const today = new Date().toLocaleDateString('tr-TR')
    const list = filteredSuppliers.length > 0 ? filteredSuppliers : suppliers
    const rows = list.map((s, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><strong>${(s.company_name || '').toUpperCase()}</strong></td>
        <td>${s.category || '-'}</td>
        <td>${s.contact_person || '-'}</td>
        <td>${s.phone || '-'}</td>
        <td>${s.tax_number || '-'}</td>
        <td style="text-align:center;">✓</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Onaylı Tedarikçi Listesi - DF18</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #000; margin: 0; padding: 0; }

    .doc-header { border: 2px solid #000; margin-bottom: 12px; }
    .doc-header table { width: 100%; border-collapse: collapse; }
    .doc-header td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
    .logo-cell { width: 25%; text-align: center; font-weight: bold; font-size: 14px; }
    .title-cell { width: 50%; text-align: center; font-weight: bold; font-size: 14px; text-transform: uppercase; padding: 10px !important; }
    .meta-cell { width: 25%; font-size: 9px; }
    .meta-row { display: flex; justify-content: space-between; padding: 1px 0; }
    .meta-row strong { font-weight: 600; }

    table.data { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    table.data th { background: #d9e2f3; border: 1px solid #000; padding: 6px 4px; font-size: 10px; font-weight: bold; text-align: left; }
    table.data td { border: 1px solid #000; padding: 5px 6px; font-size: 9.5px; vertical-align: middle; }
    table.data tr:nth-child(even) td { background: #f5f5f5; }

    .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; }
    .signature { width: 200px; }
    .signature-line { border-top: 1px solid #000; margin-top: 35px; padding-top: 4px; text-align: center; font-weight: 600; }

    .summary { margin-top: 10px; font-size: 10px; font-weight: 600; text-align: right; padding-right: 4px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <table>
      <tr>
        <td rowspan="3" class="logo-cell">DÜNYASAN</td>
        <td rowspan="3" class="title-cell">ONAYLI TEDARİKÇİ LİSTESİ</td>
        <td class="meta-cell"><div class="meta-row"><strong>Doküman No:</strong><span>DF18</span></div></td>
      </tr>
      <tr>
        <td class="meta-cell"><div class="meta-row"><strong>Yayın Tarihi:</strong><span>02.03.2026</span></div></td>
      </tr>
      <tr>
        <td class="meta-cell"><div class="meta-row"><strong>Revizyon No:</strong><span>00</span></div></td>
      </tr>
    </table>
  </div>

  <table class="data">
    <thead>
      <tr>
        <th style="width:5%; text-align:center;">No</th>
        <th style="width:35%;">Firma Adı</th>
        <th style="width:18%;">Kategori</th>
        <th style="width:15%;">Yetkili Kişi</th>
        <th style="width:12%;">Telefon</th>
        <th style="width:10%;">Vergi No</th>
        <th style="width:5%; text-align:center;">Onay</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="summary">Toplam Onaylı Tedarikçi: ${list.length}</div>

  <div class="footer">
    <div>Baskı Tarihi: ${today}</div>
    <div class="signature">
      <div class="signature-line">Hazırlayan / Onaylayan</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) {
      alert('Pop-up engellendi. Lütfen pop-up izni verin.')
      return
    }
    w.document.open()
    w.document.write(html)
    w.document.close()
  }

  const filterSuppliers = () => {
    let filtered = suppliers

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.company_name.toLowerCase().includes(term) ||
        s.contact_person?.toLowerCase().includes(term) ||
        s.phone?.includes(term) ||
        s.email?.toLowerCase().includes(term)
      )
    }

    if (categoryFilter) {
      filtered = filtered.filter(s => s.category === categoryFilter)
    }

    setFilteredSuppliers(filtered)
  }

  const handleCreateOrUpdate = async () => {
    if (!formData.company_name || !companyId) {
      alert('Şirket adı zorunludur!')
      return
    }

    try {
      if (editingSupplier) {
        // Update
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
          })
          .eq('id', editingSupplier.id)

        if (error) throw error
        alert('✅ Tedarikçi güncellendi!')
      } else {
        // Create
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
            is_active: true
          })

        if (error) throw error
        alert('✅ Tedarikçi eklendi!')
      }

      resetForm()
      setShowModal(false)
      await loadSuppliers()
    } catch (error: any) {
      console.error('Error saving supplier:', error)
      alert(`❌ Hata: ${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      company_name: supplier.company_name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      tax_number: supplier.tax_number || '',
      address: supplier.address || '',
      category: supplier.category || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string, companyName: string) => {
    if (!confirm(`"${companyName}" tedarikçisini silmek istediğinizden emin misiniz?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('✅ Tedarikçi silindi!')
      await loadSuppliers()
    } catch (error: any) {
      console.error('Error deleting supplier:', error)
      alert(`❌ Hata: ${error?.message || 'Bilinmeyen hata'}`)
    }
  }

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_person: '',
      phone: '',
      email: '',
      tax_number: '',
      address: '',
      category: '',
      notes: '',
      is_active: true
    })
    setEditingSupplier(null)
  }

  const categories = Array.from(new Set(suppliers.map(s => s.category).filter(Boolean)))

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
          <h2 className="text-3xl font-bold text-gray-800">Tedarikçiler</h2>
          <p className="text-gray-600">Tedarikçilerinizi yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintApprovedList}
            className="flex items-center space-x-2 px-5 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
            title="DF18 - Onaylı Tedarikçi Listesi"
          >
            <Printer className="w-5 h-5" />
            <span className="font-semibold">Onaylı Liste Yazdır</span>
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Yeni Tedarikçi</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
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
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Toplam {filteredSuppliers.length} tedarikçi gösteriliyor
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
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
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{supplier.company_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {supplier.contact_person || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {supplier.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {supplier.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {supplier.category || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      supplier.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {supplier.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id, supplier.company_name)}
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
                {editingSupplier ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}
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
                {editingSupplier ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

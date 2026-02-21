'use client'

import { useState, useEffect } from 'react'
import { Calculator, TrendingUp, Save } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase/client'

interface Project {
  id: string
  project_code: string
  project_name: string
}

interface ToolData {
  id: string
  code: string
  name: string
  breakageRate: number
  unitPrice: number
  projectToolId?: string
}

export default function CostCalculationPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [orderQuantity, setOrderQuantity] = useState(0)
  const [toolsData, setToolsData] = useState<ToolData[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  // Projeleri yükle
  const loadProjects = async () => {
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

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .eq('company_id', fetchedCompanyId)
        .order('project_name', { ascending: true })

      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  // Proje değiştiğinde takımları yükle
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId)
    if (!projectId) {
      setToolsData([])
      return
    }

    try {
      // Projeye atanmış takımları çek
      const { data: projectToolsData } = await supabase
        .from('project_tools')
        .select(`
          id,
          breakage_rate,
          tool:tools(
            id,
            tool_code,
            tool_name,
            unit_price
          )
        `)
        .eq('project_id', projectId)

      if (projectToolsData && projectToolsData.length > 0) {
        const tools = projectToolsData.map((pt: any) => ({
          id: pt.tool.id,
          code: pt.tool.tool_code,
          name: pt.tool.tool_name,
          breakageRate: pt.breakage_rate || 0,
          unitPrice: pt.tool.unit_price || 0,
          projectToolId: pt.id
        }))
        setToolsData(tools)
      } else {
        setToolsData([])
      }
    } catch (error) {
      console.error('Error loading project tools:', error)
      setToolsData([])
    }
  }

  // Takım verisi güncelleme ve kaydetme
  const updateToolData = async (index: number, field: 'breakageRate' | 'unitPrice', value: number) => {
    const updated = [...toolsData]
    updated[index][field] = field === 'breakageRate' ? value : value

    // Kırılma oranı değişirse veritabanına kaydet
    if (field === 'breakageRate' && updated[index].projectToolId) {
      try {
        await supabase
          .from('project_tools')
          .update({ breakage_rate: value })
          .eq('id', updated[index].projectToolId)
      } catch (error) {
        console.error('Error updating breakage rate:', error)
      }
    }

    setToolsData(updated)
  }

  // Hesaplamalar
  const calculations = toolsData.map(tool => {
    const costPerPiece = tool.breakageRate > 0 ? tool.unitPrice / tool.breakageRate : 0
    const requiredQuantity = orderQuantity > 0 && tool.breakageRate > 0
      ? Math.ceil(orderQuantity / tool.breakageRate)
      : 0
    const totalCost = requiredQuantity * tool.unitPrice

    return {
      code: tool.code,
      costPerPiece,
      requiredQuantity,
      totalCost,
    }
  })

  // Genel toplamlar
  const totalCuttingCost = calculations.reduce((sum, item) => sum + item.totalCost, 0)
  const costPerPieceTotal = orderQuantity > 0 ? totalCuttingCost / orderQuantity : 0

  // Hesaplamaları kaydet
  const handleSaveCalculations = async () => {
    if (!selectedProjectId || toolsData.length === 0) {
      alert('Kaydedilecek hesaplama yok!')
      return
    }

    if (orderQuantity <= 0) {
      alert('Sipariş adedi girilmelidir!')
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()

      // Her takım için hesaplanan parça başı maliyeti kaydet
      const updates = toolsData.map((tool, index) => {
        const calc = calculations[index]
        return supabase
          .from('project_tools')
          .update({
            calculated_unit_cost: calc.costPerPiece,
            last_calculation_date: now
          })
          .eq('id', tool.projectToolId)
      })

      await Promise.all(updates)

      // Projeye toplam maliyetleri kaydet
      await supabase
        .from('projects')
        .update({
          last_calculated_total_cost: totalCuttingCost,
          last_calculated_unit_cost: costPerPieceTotal,
          last_order_quantity: orderQuantity,
          last_cost_calculation_date: now
        })
        .eq('id', selectedProjectId)

      alert('Hesaplamalar başarıyla kaydedildi!')
    } catch (error) {
      console.error('Error saving calculations:', error)
      alert('Hesaplamalar kaydedilirken hata oluştu!')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard module="costs" permission="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Maliyet Hesaplama</h2>
            <p className="text-gray-600">Kesici takım maliyet hesaplama aracı</p>
          </div>
          <Calculator className="w-12 h-12 text-blue-600" />
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Proje Seçimi */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Proje Seçiniz <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Proje seçiniz</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_name} {project.project_code ? `(${project.project_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Sipariş Adedi */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sipariş Adedi <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={orderQuantity || ''}
                onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                min="0"
                placeholder="Örn: 1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Takım Listesi */}
        {selectedProjectId && toolsData.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Kesici Takımlar</h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Takım Kodu</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kırılma Oranı<br /><span className="text-xs font-normal text-gray-500">(kaç işte bir)</span></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Birim Fiyat<br /><span className="text-xs font-normal text-gray-500">(EUR)</span></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Parça Başı<br />Maliyet (EUR)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Gerekli<br />Adet</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Toplam<br />Maliyet (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {toolsData.map((tool, index) => {
                    const calc = calculations[index]
                    return (
                      <tr key={tool.code} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-gray-900">{tool.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={tool.breakageRate || ''}
                            onChange={(e) => updateToolData(index, 'breakageRate', parseInt(e.target.value) || 0)}
                            min="0"
                            placeholder="0"
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={tool.unitPrice || ''}
                            onChange={(e) => updateToolData(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            min="0"
                            placeholder="0.00"
                            className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-blue-600">
                            {calc.costPerPiece.toFixed(4)} €
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">
                            {calc.requiredQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-green-600">
                            {calc.totalCost.toFixed(2)} €
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Özet Kartlar */}
        {selectedProjectId && orderQuantity > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Toplam Kesici Maliyeti */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-l-4 border-green-500 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">TOPLAM KESİCİ MALİYETİ</h4>
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-green-700 mb-1">
                  {totalCuttingCost.toFixed(2)} €
                </div>
                <p className="text-xs text-gray-600">
                  {orderQuantity.toLocaleString()} adet sipariş için toplam kesici takım maliyeti
                </p>
              </div>

              {/* Parça Başı Toplam Kesici Maliyeti */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-l-4 border-blue-500 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">PARÇA BAŞI TOPLAM MALİYET</h4>
                  <Calculator className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-4xl font-bold text-blue-700 mb-1">
                  {costPerPieceTotal.toFixed(4)} €
                </div>
                <p className="text-xs text-gray-600">
                  Her bir parça için kesici takım maliyeti
                </p>
              </div>
            </div>

            {/* Kaydet Butonu */}
            <div className="flex justify-center">
              <button
                onClick={handleSaveCalculations}
                disabled={saving}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Kaydediliyor...' : 'Hesaplamaları Kaydet'}</span>
              </button>
            </div>
          </>
        )}

        {/* Uyarı: Proje seçilmiş ama takım yok */}
        {selectedProjectId && toolsData.length === 0 && (
          <div className="bg-orange-50 rounded-xl shadow-md p-12 text-center border-2 border-orange-200">
            <Calculator className="w-24 h-24 text-orange-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-orange-700 mb-2">Bu Projeye Takım Atanmamış</h3>
            <p className="text-orange-600">
              Maliyet hesaplayabilmek için önce proje detay sayfasından takım eklemeniz gerekiyor
            </p>
          </div>
        )}

        {/* Boş Durum */}
        {!selectedProjectId && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Calculator className="w-24 h-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Hesaplama Başlatın</h3>
            <p className="text-gray-500">
              Maliyet hesaplamaya başlamak için yukarıdan bir proje seçin ve sipariş adedini girin
            </p>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

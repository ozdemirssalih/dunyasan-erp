'use client'

import { useState, useEffect } from 'react'
import { Calculator, TrendingUp, Save, Clock, Package, Scissors, Weight } from 'lucide-react'
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

  // Tezgah Çalışma Maliyeti
  const [machineMinutes, setMachineMinutes] = useState(0) // dakika
  const [machineCostPerMin, setMachineCostPerMin] = useState(6) // TL/dk

  // Malzeme Alış Maliyeti
  const [materialPricePerKg, setMaterialPricePerKg] = useState(0) // TL/kg
  const [materialWeightPerPiece, setMaterialWeightPerPiece] = useState(0) // kg (hammadde ağırlığı)

  // Fire Hesaplama
  const [finishedPartWeight, setFinishedPartWeight] = useState(0) // kg (bitmiş parça ağırlığı)

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

  // Genel toplamlar - Kesici
  const totalCuttingCost = calculations.reduce((sum, item) => sum + item.totalCost, 0)
  const costPerPieceTotal = orderQuantity > 0 ? totalCuttingCost / orderQuantity : 0

  // Tezgah Çalışma Maliyeti Hesaplama
  const machineCostPerPiece = machineMinutes * machineCostPerMin // 1 parça için tezgah maliyeti (TL)
  const totalMachineCost = machineCostPerPiece * orderQuantity // toplam tezgah maliyeti (TL)

  // Malzeme Maliyeti Hesaplama
  const materialCostPerPiece = materialWeightPerPiece * materialPricePerKg // 1 parça hammadde maliyeti (TL)
  const totalMaterialCost = materialCostPerPiece * orderQuantity // toplam hammadde maliyeti (TL)

  // Fire Hesaplama
  const scrapWeightPerPiece = materialWeightPerPiece > 0 && finishedPartWeight > 0
    ? materialWeightPerPiece - finishedPartWeight : 0 // 1 parça fire kg
  const scrapPercentage = materialWeightPerPiece > 0
    ? (scrapWeightPerPiece / materialWeightPerPiece) * 100 : 0 // fire yüzdesi
  const totalScrapWeight = scrapWeightPerPiece * orderQuantity // toplam fire kg
  const totalScrapCost = totalScrapWeight * materialPricePerKg // fire maliyeti (TL)

  // GENEL TOPLAM MALİYET (TL)
  const grandTotalPerPiece = machineCostPerPiece + materialCostPerPiece // parça başı toplam TL
  const grandTotal = totalMachineCost + totalMaterialCost // genel toplam TL

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

        {/* ============================================= */}
        {/* TEZGAH ÇALIŞMA MALİYETİ */}
        {/* ============================================= */}
        {selectedProjectId && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Tezgah Çalışma Maliyeti</h3>
                <p className="text-sm text-gray-500">CNC tezgah çalışma süresi bazında maliyet hesaplama</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Parça Başı Çalışma Süresi (dk)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={machineMinutes || ''}
                  onChange={(e) => setMachineMinutes(parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="Örn: 15"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dakika Maliyeti (TL/dk)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={machineCostPerMin || ''}
                  onChange={(e) => setMachineCostPerMin(parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Varsayılan: 6 TL/dk</p>
              </div>
              <div className="flex items-end">
                <div className="w-full bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="text-xs text-gray-500 mb-1">Parça Başı Tezgah Maliyeti</div>
                  <div className="text-2xl font-bold text-orange-700">{machineCostPerPiece.toFixed(2)} ₺</div>
                  {orderQuantity > 0 && (
                    <div className="text-xs text-gray-500 mt-1">Toplam: {totalMachineCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================= */}
        {/* MALZEME ALIŞ MALİYETİ + FİRE HESAPLAMA */}
        {/* ============================================= */}
        {selectedProjectId && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Weight className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Malzeme & Fire Hesaplama</h3>
                <p className="text-sm text-gray-500">Kg bazında malzeme maliyeti ve fire hesaplama</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Malzeme Alış Fiyatı (TL/kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={materialPricePerKg || ''}
                  onChange={(e) => setMaterialPricePerKg(parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="Örn: 85.50"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hammadde Ağırlığı (kg/parça)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={materialWeightPerPiece || ''}
                  onChange={(e) => setMaterialWeightPerPiece(parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="Örn: 2.500"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">İşlenmeden önceki ağırlık</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bitmiş Parça Ağırlığı (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={finishedPartWeight || ''}
                  onChange={(e) => setFinishedPartWeight(parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="Örn: 1.800"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">İşlendikten sonraki ağırlık</p>
              </div>
            </div>

            {/* Hesaplama Sonuçları */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Malzeme Maliyeti */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-600">MALZEME MALİYETİ</span>
                </div>
                <div className="text-2xl font-bold text-indigo-700">{materialCostPerPiece.toFixed(2)} ₺</div>
                <div className="text-xs text-gray-500">parça başı</div>
                {orderQuantity > 0 && (
                  <div className="text-xs text-indigo-600 mt-1 font-medium">
                    Toplam: {totalMaterialCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                )}
              </div>

              {/* Fire Kg */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <Scissors className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold text-gray-600">FİRE (PARÇA BAŞI)</span>
                </div>
                <div className="text-2xl font-bold text-red-600">{scrapWeightPerPiece.toFixed(3)} kg</div>
                <div className="text-xs text-gray-500">
                  {scrapPercentage > 0 && `%${scrapPercentage.toFixed(1)} fire oranı`}
                </div>
              </div>

              {/* Toplam Fire */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <Scissors className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold text-gray-600">TOPLAM FİRE</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {orderQuantity > 0 ? totalScrapWeight.toFixed(2) : '0'} kg
                </div>
                <div className="text-xs text-gray-500">
                  {orderQuantity > 0 && totalScrapCost > 0 && `${totalScrapCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ kayıp`}
                </div>
              </div>

              {/* Toplam Hammadde İhtiyacı */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600">TOPLAM HAMMADDE</span>
                </div>
                <div className="text-2xl font-bold text-gray-700">
                  {orderQuantity > 0 ? (materialWeightPerPiece * orderQuantity).toFixed(2) : '0'} kg
                </div>
                <div className="text-xs text-gray-500">
                  {orderQuantity > 0 ? `${orderQuantity} parça × ${materialWeightPerPiece} kg` : 'Sipariş adedi girin'}
                </div>
              </div>
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

            {/* Genel Toplam */}
            {(totalMachineCost > 0 || totalMaterialCost > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-l-4 border-purple-500 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">PARÇA BAŞI TOPLAM MALİYET (TL)</h4>
                    <Calculator className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-4xl font-bold text-purple-700 mb-1">
                    {grandTotalPerPiece.toFixed(2)} ₺
                  </div>
                  <p className="text-xs text-gray-600">
                    Tezgah: {machineCostPerPiece.toFixed(2)} ₺ + Malzeme: {materialCostPerPiece.toFixed(2)} ₺
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-l-4 border-red-500 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">GENEL TOPLAM MALİYET (TL)</h4>
                    <TrendingUp className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-4xl font-bold text-red-700 mb-1">
                    {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  <p className="text-xs text-gray-600">
                    {orderQuantity.toLocaleString()} adet için (Tezgah + Malzeme)
                  </p>
                </div>
              </div>
            )}

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

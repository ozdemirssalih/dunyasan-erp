'use client'

import { useState } from 'react'
import { Calculator, TrendingUp } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'

// Statik proje verileri - kesici takımlar
const PROJECTS_DATA: { [key: string]: string[] } = {
  'Proje A': [
    'DCMT11T308LF',
    'TCMT090204FP',
    'DNMG150608MP',
    'DNMG150612MP',
    'VBMT160408LF',
    'WNMG080408MP',
    'DCMT070204LF',
    'VBMT160404LF',
    'WNMG080404MS',
  ],
  'Proje B': [
    'DCMT11T308LF',
    'VBMT160408LF',
    'WNMG080408MP',
  ],
  'Proje C': [
    'TCMT090204FP',
    'DNMG150608MP',
    'DNMG150612MP',
    'DCMT070204LF',
  ],
}

interface ToolData {
  code: string
  breakageRate: number // Kaç işte bir kırılıyor
  unitPrice: number // EUR
}

export default function CostCalculationPage() {
  const [selectedProject, setSelectedProject] = useState('')
  const [orderQuantity, setOrderQuantity] = useState(0)
  const [toolsData, setToolsData] = useState<ToolData[]>([])

  // Proje değiştiğinde takımları yükle
  const handleProjectChange = (projectName: string) => {
    setSelectedProject(projectName)
    if (projectName && PROJECTS_DATA[projectName]) {
      const tools = PROJECTS_DATA[projectName].map(code => ({
        code,
        breakageRate: 0,
        unitPrice: 0,
      }))
      setToolsData(tools)
    } else {
      setToolsData([])
    }
  }

  // Takım verisi güncelleme
  const updateToolData = (index: number, field: 'breakageRate' | 'unitPrice', value: number) => {
    const updated = [...toolsData]
    updated[index][field] = value
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
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Proje seçiniz</option>
                {Object.keys(PROJECTS_DATA).map((projectName) => (
                  <option key={projectName} value={projectName}>
                    {projectName}
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
        {selectedProject && toolsData.length > 0 && (
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
        {selectedProject && orderQuantity > 0 && (
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
        )}

        {/* Boş Durum */}
        {!selectedProject && (
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

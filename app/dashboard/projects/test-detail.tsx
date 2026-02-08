'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { X } from 'lucide-react'

export function TestProjectDetail({ projectId, projectName, onClose }: any) {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      // Test 1: Müşteriler
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .limit(5)

      // Test 2: Tezgahlar
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .limit(5)

      // Test 3: Depo stok
      const { data: warehouseData, error: warehouseError } = await supabase
        .from('warehouse_items')
        .select('*')
        .limit(10)

      // Test 4: Ekipmanlar
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .limit(5)

      setData({
        customers: customersData || [],
        machines: machinesData || [],
        warehouse: warehouseData || [],
        equipment: equipmentData || [],
        errors: {
          customersError: customersError?.message,
          machinesError: machinesError?.message,
          warehouseError: warehouseError?.message,
          equipmentError: equipmentError?.message
        }
      })
    } catch (error: any) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-blue-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{projectName}</h2>
            <p className="text-sm">Test - Veri Kontrolü</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <button
            onClick={loadData}
            disabled={loading}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Verileri Test Et'}
          </button>

          {Object.keys(data).length > 0 && (
            <div className="space-y-4">
              {/* Müşteriler */}
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  Müşteriler ({data.customers?.length || 0})
                  {data.errors?.customersError && (
                    <span className="text-red-600 text-sm ml-2">Hata: {data.errors.customersError}</span>
                  )}
                </h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(data.customers, null, 2)}
                </pre>
              </div>

              {/* Tezgahlar */}
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  Tezgahlar ({data.machines?.length || 0})
                  {data.errors?.machinesError && (
                    <span className="text-red-600 text-sm ml-2">Hata: {data.errors.machinesError}</span>
                  )}
                </h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(data.machines, null, 2)}
                </pre>
              </div>

              {/* Depo Stok */}
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  Depo Stok ({data.warehouse?.length || 0})
                  {data.errors?.warehouseError && (
                    <span className="text-red-600 text-sm ml-2">Hata: {data.errors.warehouseError}</span>
                  )}
                </h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(data.warehouse, null, 2)}
                </pre>
              </div>

              {/* Ekipmanlar */}
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  Ekipmanlar ({data.equipment?.length || 0})
                  {data.errors?.equipmentError && (
                    <span className="text-red-600 text-sm ml-2">Hata: {data.errors.equipmentError}</span>
                  )}
                </h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(data.equipment, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

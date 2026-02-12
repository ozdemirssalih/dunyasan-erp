'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, Package, AlertTriangle, Calendar } from 'lucide-react'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  machine_type: string
  status: string
  capacity: number
  location: string
}

interface Transfer {
  id: string
  quantity: number
  item_type: string
  shift: string
  notes: string
  created_at: string
  transferred_by: string
  warehouse_item: {
    item_code: string
    item_name: string
    unit: string
  }
}

interface DailyProduction {
  id: string
  production_date: string
  capacity_target: number
  actual_production: number
  defect_count: number
  efficiency_rate: number
  shift: string
  notes: string
  created_at: string
  project?: {
    project_code: string
    project_name: string
  }
}

export default function MachineDetailPage() {
  const params = useParams()
  const router = useRouter()
  const machineId = params.id as string

  const [machine, setMachine] = useState<Machine | null>(null)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [dailyProductions, setDailyProductions] = useState<DailyProduction[]>([])
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    totalGiven: 0,
    totalProduced: 0,
    totalScrap: 0,
    efficiency: 0
  })

  useEffect(() => {
    loadMachineData()
  }, [machineId])

  const loadMachineData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Load machine details
      const { data: machineData } = await supabase
        .from('machines')
        .select('*')
        .eq('id', machineId)
        .eq('company_id', profile.company_id)
        .single()

      setMachine(machineData)

      // Load transfers (hammadde verilen)
      const { data: transfersData } = await supabase
        .from('production_to_machine_transfers')
        .select(`
          *,
          warehouse_item:warehouse_items!production_to_machine_transfers_item_id_fkey(item_code, item_name, unit)
        `)
        .eq('machine_id', machineId)
        .order('created_at', { ascending: false })

      setTransfers(transfersData || [])

      // Load daily production records (günlük üretim kayıtları)
      const { data: dailyProductionData } = await supabase
        .from('machine_daily_production')
        .select(`
          *,
          project:projects(project_code, project_name)
        `)
        .eq('machine_id', machineId)
        .order('production_date', { ascending: false })

      setDailyProductions(dailyProductionData || [])

      // Calculate stats
      const totalGiven = transfersData?.reduce((sum, t) => sum + t.quantity, 0) || 0
      const totalProduced = dailyProductionData?.reduce((sum, d) => sum + d.actual_production, 0) || 0
      const totalScrap = dailyProductionData?.reduce((sum, d) => sum + (d.defect_count || 0), 0) || 0
      const efficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

      setStats({ totalGiven, totalProduced, totalScrap, efficiency })

    } catch (error) {
      console.error('Error loading machine data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (!machine) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Tezgah bulunamadı!</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Geri Dön
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{machine.machine_name}</h1>
            <p className="text-gray-600">{machine.machine_code} • {machine.machine_type}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
            machine.status === 'active' ? 'bg-green-100 text-green-800' :
            machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
            machine.status === 'idle' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
            {machine.status === 'active' ? 'Aktif' :
             machine.status === 'maintenance' ? 'Bakımda' :
             machine.status === 'idle' ? 'Boşta' : 'Devre Dışı'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Verilen Hammadde</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalGiven.toFixed(2)}</p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Üretilen</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalProduced.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Fire</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalScrap.toFixed(2)}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Verimlilik</p>
              <p className={`text-2xl font-bold ${
                stats.efficiency >= 80 ? 'text-green-600' :
                stats.efficiency >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                %{stats.efficiency.toFixed(1)}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center" style={{
              borderColor: stats.efficiency >= 80 ? '#10b981' :
                          stats.efficiency >= 60 ? '#f59e0b' : '#ef4444'
            }}>
              <span className="text-xs font-bold text-gray-600">
                {stats.efficiency.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transfers and Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfers */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Package className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Verilen Hammaddeler</h2>
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
              {transfers.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {transfers.length > 0 ? (
              transfers.map(transfer => (
                <div key={transfer.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-900">
                        {transfer.warehouse_item?.item_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transfer.warehouse_item?.item_code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {transfer.quantity} {transfer.warehouse_item?.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transfer.item_type === 'raw_material' ? 'Hammadde' : 'Taşıh'}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t">
                    <span>{transfer.shift}</span>
                    <span>{new Date(transfer.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                  {transfer.notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">
                      Not: {transfer.notes}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">Henüz transfer kaydı yok</p>
            )}
          </div>
        </div>

        {/* Daily Production Records */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Günlük Üretim Kayıtları</h2>
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-semibold">
              {dailyProductions.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {dailyProductions.length > 0 ? (
              dailyProductions.map(record => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-gray-900">
                        {new Date(record.production_date).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      {record.project && (
                        <div className="text-sm text-blue-600">
                          {record.project.project_name} ({record.project.project_code})
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Vardiya: {record.shift || 'Belirtilmemiş'}
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      record.efficiency_rate >= 80 ? 'bg-green-100 text-green-700' :
                      record.efficiency_rate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      %{record.efficiency_rate.toFixed(1)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-600">Hedef</div>
                      <div className="text-sm font-bold text-gray-900">{record.capacity_target}</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs text-gray-600">Üretilen</div>
                      <div className="text-sm font-bold text-green-700">{record.actual_production}</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-xs text-gray-600">Fire</div>
                      <div className="text-sm font-bold text-red-700">{record.defect_count || 0}</div>
                    </div>
                  </div>

                  {record.notes && (
                    <div className="text-xs text-gray-600 mt-2 pt-2 border-t italic">
                      Not: {record.notes}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">Henüz günlük üretim kaydı yok</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

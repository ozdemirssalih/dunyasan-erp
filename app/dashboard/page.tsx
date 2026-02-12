'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    inProgressOrders: 0,
    activeMachines: 0,
    totalMachines: 0,
    lowStockCount: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()

    // Subscribe to real-time updates
    const ordersSubscription = supabase
      .channel('production_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      ordersSubscription.unsubscribe()
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Get production orders stats
      const { data: orders } = await supabase
        .from('production_orders')
        .select('*')
        .eq('company_id', profile.company_id)

      // Get machines stats
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', profile.company_id)

      // Get inventory stats
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', profile.company_id)

      // Calculate stats for each machine
      const machinesWithStats = await Promise.all(
        (machinesData || []).map(async (machine) => {
          // Günlük üretim kayıtlarından veri çek
          const { data: dailyProduction } = await supabase
            .from('machine_daily_production')
            .select('capacity_target, actual_production, defect_count, efficiency_rate')
            .eq('machine_id', machine.id)

          const totalCapacity = dailyProduction?.reduce((sum, item) => sum + item.capacity_target, 0) || 0
          const totalProduced = dailyProduction?.reduce((sum, item) => sum + item.actual_production, 0) || 0
          const totalScrap = dailyProduction?.reduce((sum, item) => sum + (item.defect_count || 0), 0) || 0

          // Ortalama verimlilik
          const avgEfficiency = dailyProduction && dailyProduction.length > 0
            ? dailyProduction.reduce((sum, item) => sum + item.efficiency_rate, 0) / dailyProduction.length
            : 0

          return {
            ...machine,
            totalCapacity,
            totalProduced,
            totalScrap,
            efficiency: avgEfficiency
          }
        })
      )

      setMachines(machinesWithStats)

      // Calculate stats
      setStats({
        totalOrders: orders?.length || 0,
        completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
        inProgressOrders: orders?.filter(o => o.status === 'in_progress').length || 0,
        activeMachines: machinesData?.filter(m => m.status === 'active').length || 0,
        totalMachines: machinesData?.length || 0,
        lowStockCount: inventory?.filter(i => i.quantity < i.min_stock_level).length || 0,
      })

      // Get recent orders
      setRecentOrders(orders?.slice(0, 5) || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  const completionRate = stats.totalOrders > 0
    ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
    : 0

  const machineEfficiency = stats.totalMachines > 0
    ? Math.round((stats.activeMachines / stats.totalMachines) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Ana Dashboard</h2>
        <p className="text-gray-600">Genel üretim durumu ve istatistikler</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Orders */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Toplam Sipariş</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalOrders}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Tamamlanan</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats.completedOrders}</p>
              <p className="text-green-600 text-sm font-semibold mt-1">%{completionRate} Tamamlama</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active Machines */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Aktif Tezgah</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats.activeMachines}/{stats.totalMachines}</p>
              <p className="text-purple-600 text-sm font-semibold mt-1">%{machineEfficiency} Verimlilik</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Düşük Stok</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats.lowStockCount}</p>
              <p className="text-orange-600 text-sm font-semibold mt-1">Uyarı</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Son Siparişler</h3>
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">{order.order_number}</p>
                    <p className="text-sm text-gray-600">{order.project_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">{order.quantity} adet</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status === 'completed' ? 'Tamamlandı' :
                       order.status === 'in_progress' ? 'Devam Ediyor' :
                       order.status === 'cancelled' ? 'İptal' : 'Beklemede'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">Henüz sipariş bulunmuyor</p>
            )}
          </div>
        </div>

        {/* Production Progress */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Üretim İlerlemesi</h3>
          <div className="space-y-4">
            {/* In Progress Orders Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Devam Eden Siparişler</span>
                <span className="text-sm font-semibold text-blue-600">{stats.inProgressOrders}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalOrders > 0 ? (stats.inProgressOrders / stats.totalOrders) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Completed Orders Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Tamamlanan Siparişler</span>
                <span className="text-sm font-semibold text-green-600">{stats.completedOrders}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>

            {/* Machine Efficiency Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Tezgah Verimliliği</span>
                <span className="text-sm font-semibold text-purple-600">%{machineEfficiency}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all"
                  style={{ width: `${machineEfficiency}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/dashboard/production" className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <svg className="w-12 h-12 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Yeni Sipariş</span>
          </a>

          <a href="/dashboard/machines" className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <svg className="w-12 h-12 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Tezgah Durumu</span>
          </a>

          <a href="/dashboard/inventory" className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <svg className="w-12 h-12 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Stok Kontrol</span>
          </a>

          <a href="/dashboard/reports" className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
            <svg className="w-12 h-12 text-orange-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Rapor Oluştur</span>
          </a>
        </div>
      </div>

      {/* Tezgah Durumları */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Tezgah Durumları</h3>
          <a href="/dashboard/machines" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
            Tümünü Gör →
          </a>
        </div>
        {machines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {machines.map(machine => (
              <div key={machine.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow bg-gradient-to-br from-gray-50 to-white">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {/* Machine SVG Icon */}
                    <div className={`p-2 rounded-lg ${
                      machine.status === 'active' ? 'bg-green-100' :
                      machine.status === 'maintenance' ? 'bg-yellow-100' :
                      machine.status === 'idle' ? 'bg-gray-100' :
                      'bg-red-100'
                    }`}>
                      <svg className={`w-6 h-6 ${
                        machine.status === 'active' ? 'text-green-600' :
                        machine.status === 'maintenance' ? 'text-yellow-600' :
                        machine.status === 'idle' ? 'text-gray-600' :
                        'text-red-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{machine.machine_name}</h4>
                      <p className="text-xs text-gray-500">{machine.machine_code}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    machine.status === 'active' ? 'bg-green-100 text-green-800' :
                    machine.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    machine.status === 'idle' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {machine.status === 'active' ? 'Aktif' :
                     machine.status === 'maintenance' ? 'Bakım' :
                     machine.status === 'idle' ? 'Boşta' : 'Devre Dışı'}
                  </span>
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Kapasite:</span>
                    <span className="font-semibold text-blue-600">{machine.totalCapacity?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Üretilen:</span>
                    <span className="font-semibold text-green-600">{machine.totalProduced?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Fire:</span>
                    <span className="font-semibold text-red-600">{machine.totalScrap?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                {/* Efficiency Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">Verimlilik</span>
                    <span className={`font-bold ${
                      (machine.efficiency ?? 0) >= 80 ? 'text-green-600' :
                      (machine.efficiency ?? 0) >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      %{machine.efficiency?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (machine.efficiency ?? 0) >= 80 ? 'bg-green-500' :
                        (machine.efficiency ?? 0) >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(machine.efficiency || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Detail Button */}
                <a
                  href={`/dashboard/machines/${machine.id}`}
                  className="block w-full text-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  📊 Detaylı Geçmiş
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Henüz tezgah bulunmuyor</p>
        )}
      </div>
    </div>
  )
}

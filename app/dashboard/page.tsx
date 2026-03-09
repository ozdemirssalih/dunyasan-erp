'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Clock, Calendar, Package, CheckCircle, Settings, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    inProgressOrders: 0,
    activeMachines: 0,
    totalMachines: 0,
    qcPendingCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      if (profileData?.company_id) {
        await loadStats(profileData.company_id)
      }
    }
    setLoading(false)
  }

  const loadStats = async (companyId: string) => {
    try {
      // Get production orders stats
      const { data: orders } = await supabase
        .from('production_orders')
        .select('*')
        .eq('company_id', companyId)

      // Get machines stats
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', companyId)

      // Get quality control inventory stats
      const { data: qcInventory } = await supabase
        .from('quality_control_inventory')
        .select('*')
        .eq('company_id', companyId)

      setStats({
        totalOrders: orders?.length || 0,
        completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
        inProgressOrders: orders?.filter(o => o.status === 'in_progress').length || 0,
        activeMachines: machinesData?.filter(m => m.status === 'active').length || 0,
        totalMachines: machinesData?.length || 0,
        qcPendingCount: qcInventory?.length || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const updateDateTime = () => {
    const now = new Date()
    setCurrentTime(now.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }))
    setCurrentDate(now.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  const completionRate = stats.totalOrders > 0
    ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Hoş Geldiniz, {profile?.full_name}!</h2>
            <p className="text-blue-100 text-lg">Dünyasan ERP Sistemi</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-2xl font-bold">{currentTime}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Calendar className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-100">{currentDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Orders */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">Toplam Sipariş</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.totalOrders}</p>
          <p className="text-blue-100 text-sm">Sistemdeki tüm siparişler</p>
        </div>

        {/* Completed Orders */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">Tamamlanan</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.completedOrders}</p>
          <p className="text-green-100 text-sm">%{completionRate} tamamlanma oranı</p>
        </div>

        {/* Active Machines */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">Aktif Tezgah</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <Settings className="w-6 h-6" />
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.activeMachines}/{stats.totalMachines}</p>
          <p className="text-purple-100 text-sm">Çalışan tezgah sayısı</p>
        </div>

        {/* In Progress */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">Devam Eden</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.inProgressOrders}</p>
          <p className="text-amber-100 text-sm">Üretimde olan siparişler</p>
        </div>

        {/* QC Pending */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">KK Bekleyen</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.qcPendingCount}</p>
          <p className="text-orange-100 text-sm">Kalite kontrolde bekleyen</p>
        </div>

        {/* System Status */}
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold opacity-90">Sistem Durumu</h3>
            <div className="p-3 bg-white/20 rounded-lg">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-4xl font-bold mb-2">Aktif</p>
          <p className="text-gray-300 text-sm">Tüm sistemler çalışıyor</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Hızlı Erişim</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <a
            href="/dashboard/production"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Üretim</span>
          </a>

          <a
            href="/dashboard/machines"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Tezgahlar</span>
          </a>

          <a
            href="/dashboard/warehouse"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Depo</span>
          </a>

          <a
            href="/dashboard/quality-control"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-orange-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Kalite</span>
          </a>

          <a
            href="/dashboard/accounting"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg hover:from-indigo-100 hover:to-indigo-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-indigo-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Muhasebe</span>
          </a>

          <a
            href="/dashboard/reports"
            className="flex flex-col items-center p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg hover:from-pink-100 hover:to-pink-200 transition-all hover:shadow-md"
          >
            <svg className="w-10 h-10 text-pink-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 text-center">Raporlar</span>
          </a>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Üretim Genel Görünüm</h3>
        <div className="space-y-4">
          {/* Completion Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Tamamlanma Oranı</span>
              <span className="text-lg font-bold text-green-600">%{completionRate}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>

          {/* In Progress Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Devam Eden İşler</span>
              <span className="text-lg font-bold text-blue-600">{stats.inProgressOrders}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${stats.totalOrders > 0 ? (stats.inProgressOrders / stats.totalOrders) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Machine Utilization */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Tezgah Kullanımı</span>
              <span className="text-lg font-bold text-purple-600">
                %{stats.totalMachines > 0 ? Math.round((stats.activeMachines / stats.totalMachines) * 100) : 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-4 rounded-full transition-all"
                style={{ width: `${stats.totalMachines > 0 ? (stats.activeMachines / stats.totalMachines) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

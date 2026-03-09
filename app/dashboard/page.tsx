'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Clock, Calendar, Users, MessageSquare, Bell } from 'lucide-react'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')

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

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* My Tasks Card */}
        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Görevlerim</h3>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-2">-</p>
          <p className="text-sm text-gray-600">Yakında kullanıma açılacak</p>
        </div>

        {/* Messages Card */}
        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Mesajlar</h3>
            <div className="p-3 bg-green-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-2">-</p>
          <p className="text-sm text-gray-600">Yakında kullanıma açılacak</p>
        </div>

        {/* Notifications Card */}
        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Bildirimler</h3>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Bell className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-2">-</p>
          <p className="text-sm text-gray-600">Yakında kullanıma açılacak</p>
        </div>
      </div>

      {/* Quick Access */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Hızlı Erişim</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* User Info */}
      {profile && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kullanıcı Bilgilerim</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Ad Soyad</p>
              <p className="text-base font-semibold text-gray-900">{profile.full_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">E-posta</p>
              <p className="text-base font-semibold text-gray-900">{user?.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Rol</p>
              <p className="text-base font-semibold text-gray-900">{profile.role || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefon</p>
              <p className="text-base font-semibold text-gray-900">{profile.phone || '-'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

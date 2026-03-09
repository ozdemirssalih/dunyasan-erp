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

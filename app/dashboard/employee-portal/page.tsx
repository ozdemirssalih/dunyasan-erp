'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Clock, Calendar, Users, MessageSquare } from 'lucide-react'

export default function EmployeePortalPage() {
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
        .select('*, role:role_id(name)')
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Çalışan Portalı</h1>
              <p className="text-sm text-gray-600 mt-1">Hoş geldiniz, {profile?.full_name || 'Kullanıcı'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Merhaba, {profile?.full_name}!</h2>
              <p className="text-blue-100 text-lg">{profile?.role?.name || 'Çalışan'}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          {/* Announcements Card */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Duyurular</h3>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">-</p>
            <p className="text-sm text-gray-600">Yakında kullanıma açılacak</p>
          </div>
        </div>

        {/* Access Notice */}
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Hoş Geldiniz</h3>
            <p className="text-gray-600 mb-6">
              Çalışan portalına başarıyla giriş yaptınız. Sisteme erişim yetkileriniz için
              yöneticinizle iletişime geçebilirsiniz.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Not:</strong> Dashboard ve diğer modüllere erişim için admin yetkilerine ihtiyacınız var.
                Detaylı bilgi için sistem yöneticinizle görüşün.
              </p>
            </div>
          </div>
        </div>

        {/* User Info */}
        {profile && (
          <div className="mt-8 bg-white rounded-xl shadow-md p-6">
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
                <p className="text-base font-semibold text-gray-900">{profile.role?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefon</p>
                <p className="text-base font-semibold text-gray-900">{profile.phone || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

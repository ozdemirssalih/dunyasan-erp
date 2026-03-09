'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Clock, Calendar, Users, MessageSquare, Bell, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [stats, setStats] = useState({
    pendingTasks: 0,
    unreadMessages: 0,
    notifications: 0,
  })
  const [recentMessages, setRecentMessages] = useState<any[]>([])
  const [pendingWaybills, setPendingWaybills] = useState<any[]>([])
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])

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
        await loadStats(profileData.company_id, user.id)
      }
    }
  }

  const loadStats = async (companyId: string, userId: string) => {
    try {
      // Bekleyen irsaliye talepleri (Görevlerim)
      const { data: waybills } = await supabase
        .from('waybills')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

      setPendingWaybills(waybills || [])

      // Chat mesajları
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*, sender:sender_id(full_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentMessages(messages || [])

      // Bildirimler - Son işlemler (unpaid faturalar, pending purchase requests)
      const { data: unpaidInvoices } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'unpaid')
        .limit(3)

      const { data: pendingRequests } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .limit(3)

      const notifications = [
        ...(unpaidInvoices || []).map(inv => ({
          type: 'invoice',
          message: `Ödenmemiş fatura: ${inv.reference_number}`,
          date: inv.transaction_date
        })),
        ...(pendingRequests || []).map(req => ({
          type: 'request',
          message: `Bekleyen talep: ${req.item_name || 'Ürün'}`,
          date: req.created_at
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

      setRecentNotifications(notifications)

      setStats({
        pendingTasks: waybills?.length || 0,
        unreadMessages: messages?.length || 0,
        notifications: notifications.length || 0,
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
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Görevlerim</h3>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.pendingTasks}</p>
            <p className="text-sm text-gray-600">Bekleyen irsaliye talebi</p>
          </div>
          <div className="p-4">
            {pendingWaybills.length > 0 ? (
              <div className="space-y-2">
                {pendingWaybills.slice(0, 3).map((waybill) => (
                  <div key={waybill.id} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700 font-medium">{waybill.waybill_number}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(waybill.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                ))}
                <Link href="/dashboard/invoices" className="flex items-center justify-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-semibold mt-3">
                  Tümünü Gör <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-4">Bekleyen görev yok</p>
            )}
          </div>
        </div>

        {/* Messages Card */}
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mesajlar</h3>
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.unreadMessages}</p>
            <p className="text-sm text-gray-600">Son mesajlar</p>
          </div>
          <div className="p-4">
            {recentMessages.length > 0 ? (
              <div className="space-y-2">
                {recentMessages.slice(0, 3).map((message) => (
                  <div key={message.id} className="p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{message.sender?.full_name || 'Kullanıcı'}</p>
                        <p className="text-xs text-gray-600 line-clamp-1">{message.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                <button className="flex items-center justify-center gap-1 text-green-600 hover:text-green-700 text-sm font-semibold mt-3 w-full">
                  Chat Panelini Aç <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-4">Henüz mesaj yok</p>
            )}
          </div>
        </div>

        {/* Notifications Card */}
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bildirimler</h3>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Bell className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.notifications}</p>
            <p className="text-sm text-gray-600">Bekleyen işlemler</p>
          </div>
          <div className="p-4">
            {recentNotifications.length > 0 ? (
              <div className="space-y-2">
                {recentNotifications.slice(0, 3).map((notif, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      notif.type === 'invoice' ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(notif.date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/accounting" className="flex items-center justify-center gap-1 text-amber-600 hover:text-amber-700 text-sm font-semibold mt-3">
                  Tümünü Gör <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-4">Bildirim yok</p>
            )}
          </div>
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

'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Minimize2, Paperclip, Smile, Check, CheckCheck, Phone, Video, MoreVertical, Search, Globe, Briefcase, Factory, ShoppingCart, Wrench, Folder } from 'lucide-react'

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  chat_group: string | null
  created_at: string
  sender?: {
    full_name: string
    email: string
    avatar_url?: string
  }
}

interface ChatGroup {
  id: string
  name: string
  last_message?: string
  last_message_time?: string
  unread_count: number
}

export default function CompanyChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [view, setView] = useState<'groups' | 'chat'>('groups')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [userChatGroups, setUserChatGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [groups, setGroups] = useState<ChatGroup[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
      setGroupUnreadCounts(prev => ({
        ...prev,
        [selectedGroup]: 0
      }))
      setUnreadCount(prev => Math.max(0, prev - (groupUnreadCounts[selectedGroup] || 0)))
    }
  }, [isOpen, isMinimized, messages])

  useEffect(() => {
    if (companyId && userChatGroups.length > 0) {
      loadGroups(companyId, userChatGroups)
    }
  }, [companyId, userChatGroups, groupUnreadCounts])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)

      setTimeout(() => audioContext.close(), 300)
    } catch (err) {
    }
  }

  const initChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, chat_group, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    setCompanyId(profile.company_id)
    setUserChatGroups(profile.chat_group || [])
    setCurrentUserName(profile.full_name || user.email || 'Sen')

    await loadGroups(profile.company_id, profile.chat_group || [])

    const channel = supabase
      .channel('company-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_chat_messages',
          filter: `company_id=eq.${profile.company_id}`
        },
        (payload) => {
          const newMsg = payload.new as any

          if (newMsg.sender_id !== user.id) {
            playNotificationSound()

            const msgGroup = newMsg.chat_group || 'all'
            setGroupUnreadCounts(prev => ({
              ...prev,
              [msgGroup]: (prev[msgGroup] || 0) + 1
            }))

            if (!isOpen || isMinimized) {
              setUnreadCount(prev => prev + 1)
            }
          }

          // Grup listesini güncelle
          loadGroups(profile.company_id, profile.chat_group || [])

          // Eğer o grup seçiliyse mesajları yenile
          const msgGroup = newMsg.chat_group || 'all'
          setSelectedGroup(currentGroup => {
            if (currentGroup === msgGroup) {
              loadMessages(profile.company_id, msgGroup)
            }
            return currentGroup
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const loadGroups = async (companyId: string, userGroups: string[]) => {
    const allGroups: ChatGroup[] = [
      {
        id: 'all',
        name: 'Genel Chat',
        unread_count: groupUnreadCounts['all'] || 0
      },
      ...userGroups.map(g => ({
        id: g,
        name: g,
        unread_count: groupUnreadCounts[g] || 0
      }))
    ]

    // Her grup için son mesajı al
    for (const group of allGroups) {
      let query = supabase
        .from('company_chat_messages')
        .select('message, created_at')
        .eq('company_id', companyId)

      if (group.id === 'all') {
        query = query.is('chat_group', null)
      } else {
        query = query.eq('chat_group', group.id)
      }

      const { data } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        group.last_message = data.message
        group.last_message_time = data.created_at
      }
    }

    setGroups(allGroups)
  }

  const loadMessages = async (companyId: string, groupId: string) => {
    let query = supabase
      .from('company_chat_messages')
      .select(`
        *,
        sender:profiles!company_chat_messages_sender_id_fkey(full_name, email, avatar_url)
      `)
      .eq('company_id', companyId)

    if (groupId === 'all') {
      query = query.is('chat_group', null)
    } else {
      query = query.eq('chat_group', groupId)
    }

    const { data } = await query
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setMessages(data)
    }
  }

  const selectGroup = (groupId: string) => {
    setSelectedGroup(groupId)
    setView('chat')
    loadMessages(companyId, groupId)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !companyId || isSubmitting) return

    if (selectedGroup !== 'all' && !userChatGroups.includes(selectedGroup)) {
      alert('Bu gruba mesaj gönderme yetkiniz yok!')
      return
    }

    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from('company_chat_messages')
        .insert({
          company_id: companyId,
          sender_id: currentUserId,
          message: newMessage.trim(),
          chat_group: selectedGroup === 'all' ? null : selectedGroup
        })

      if (error) throw error

      setNewMessage('')
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Mesaj gönderilemedi!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) {
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
    }
  }

  const getGroupIcon = (group: string) => {
    const iconMap: Record<string, JSX.Element> = {
      'all': <Globe size={18} className="text-blue-500" />,
      'Yönetim': <Briefcase size={18} className="text-purple-500" />,
      'Üretim': <Factory size={18} className="text-orange-500" />,
      'Satış': <ShoppingCart size={18} className="text-green-500" />,
      'Teknik': <Wrench size={18} className="text-red-500" />,
    }
    return iconMap[group] || <Folder size={18} className="text-gray-500" />
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  if (!companyId) return null

  return (
    <>
      {/* Floating Chat Button - WhatsApp Style */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-full p-4 shadow-2xl transition-all transform hover:scale-110 z-50 group"
        >
          <MessageCircle className="w-7 h-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-1.5 shadow-lg animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Şirket Sohbeti
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>
      )}

      {/* Chat Window - WhatsApp Style */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 transition-all ${
          isMinimized ? 'w-80 h-16' : 'w-[450px] h-[650px]'
        }`}>
          {/* Header - WhatsApp Green */}
          <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {view === 'chat' && (
                <button
                  onClick={() => setView('groups')}
                  className="hover:bg-green-700/30 rounded-full p-1.5 transition-colors flex-shrink-0"
                  title="Geri"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">
                {view === 'groups' ? <MessageCircle size={20} className="text-white" /> : getGroupIcon(selectedGroup)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base truncate">
                  {view === 'groups' ? 'Şirket Sohbeti' : groups.find(g => g.id === selectedGroup)?.name || 'Sohbet'}
                </h3>
                <p className="text-xs text-green-100 truncate">
                  {view === 'groups' ? `${groups.length} grup` : `${messages.length} mesaj`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-green-700/30 rounded-full p-2 transition-colors"
                title={isMinimized ? "Büyüt" : "Küçült"}
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setView('groups')
                }}
                className="hover:bg-green-700/30 rounded-full p-2 transition-colors"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!isMinimized && view === 'groups' && (
            <>
              {/* Search */}
              <div className="px-4 py-3 bg-white border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Sohbet ara"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Groups List - WhatsApp Style */}
              <div className="flex-1 overflow-y-auto">
                {/* GRUPLAR BÖLÜMÜ */}
                <div className="px-4 py-2 bg-gray-50">
                  <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Gruplar
                  </h3>
                </div>
                {groups
                  .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((group) => (
                  <button
                    key={group.id}
                    onClick={() => selectGroup(group.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                        group.id === 'all' ? 'from-blue-400 to-blue-600' :
                        group.id === 'Yönetim' ? 'from-purple-400 to-purple-600' :
                        group.id === 'Üretim' ? 'from-orange-400 to-orange-600' :
                        group.id === 'Satış' ? 'from-green-400 to-green-600' :
                        group.id === 'Teknik' ? 'from-red-400 to-red-600' :
                        'from-gray-400 to-gray-600'
                      } flex items-center justify-center text-white text-xl shadow-md`}>
                        {getGroupIcon(group.id)}
                      </div>
                      {group.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-bold">
                            {group.unread_count > 9 ? '9+' : group.unread_count}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-bold text-gray-900 truncate text-sm">
                          {group.name}
                        </h4>
                        {group.last_message_time && (
                          <span className="text-xs text-gray-500 ml-2">
                            {formatTime(group.last_message_time)}
                          </span>
                        )}
                      </div>
                      {group.last_message && (
                        <p className="text-sm text-gray-600 truncate">
                          {group.last_message}
                        </p>
                      )}
                      {!group.last_message && (
                        <p className="text-sm text-gray-400 italic">Henüz mesaj yok</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {!isMinimized && view === 'chat' && (
            <>

              {/* Messages - WhatsApp Style Background */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{
                  backgroundColor: '#e5ddd5',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23d9d9d9\' fill-opacity=\'0.08\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
                }}
              >
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6 bg-white/60 backdrop-blur rounded-2xl shadow-sm">
                      <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">Henüz mesaj yok</p>
                      <p className="text-gray-500 text-sm mt-1">İlk mesajı gönder!</p>
                    </div>
                  </div>
                )}

                {messages.map((msg) => {
                  const isOwnMessage = msg.sender_id === currentUserId

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        {!isOwnMessage && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                            {getInitials(msg.sender?.full_name)}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`rounded-xl px-4 py-2.5 shadow-md ${
                            isOwnMessage
                              ? 'bg-gradient-to-br from-green-400 to-green-500 text-white'
                              : 'bg-white text-gray-900'
                          }`}
                          style={{
                            borderRadius: isOwnMessage ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                          }}
                        >
                          {!isOwnMessage && (
                            <div className="text-xs font-bold mb-1 text-green-600">
                              {msg.sender?.full_name || msg.sender?.email || 'Bilinmiyor'}
                            </div>
                          )}
                          <div className="text-sm break-words leading-relaxed">{msg.message}</div>
                          <div className={`flex items-center justify-end gap-1 mt-1.5 ${
                            isOwnMessage ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            <span className="text-xs">
                              {formatTime(msg.created_at)}
                            </span>
                            {isOwnMessage && (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input - WhatsApp Style */}
              <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-200 rounded-full"
                    title="Emoji"
                  >
                    <Smile className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-200 rounded-full"
                    title="Dosya Ekle"
                  >
                    <Paperclip className="w-6 h-6" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Mesaj yaz..."
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-sm"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSubmitting}
                    className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
                    title="Gönder"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

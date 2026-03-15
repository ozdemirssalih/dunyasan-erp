'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Paperclip, Smile, Check, CheckCheck, Phone, Video, MoreVertical, Search, Menu, Users, Archive, Settings, LogOut, Circle, Clock } from 'lucide-react'

interface ChatRoom {
  id: string
  name: string
  type: 'direct' | 'group'
  avatar_url?: string
  last_message_at: string
  participants: any[]
  unread_count: number
  last_message?: {
    message: string
    sender_name: string
    created_at: string
    is_own: boolean
  }
  typing_users?: string[]
  online_users?: string[]
}

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

interface UserPresence {
  user_id: string
  status: 'online' | 'offline' | 'away'
  last_seen: string
}

export default function ChatPage() {
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>({})
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({})
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id)
      subscribeToMessages(selectedRoom.id)
    }
  }, [selectedRoom])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initializeData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, full_name, chat_group')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    setCompanyId(profile.company_id)
    setCurrentUserName(profile.full_name || user.email || '')

    loadRooms(profile.company_id, user.id, profile.chat_group || [])
    subscribeToPresence(user.id)
  }

  const loadRooms = async (compId: string, userId: string, userGroups: string[]) => {
    // Genel chat
    const generalRoom: ChatRoom = {
      id: 'general',
      name: 'Genel Chat',
      type: 'group',
      last_message_at: new Date().toISOString(),
      participants: [],
      unread_count: 0
    }

    // Kullanıcının grupları
    const groupRooms: ChatRoom[] = userGroups.map(group => ({
      id: group,
      name: group,
      type: 'group' as const,
      last_message_at: new Date().toISOString(),
      participants: [],
      unread_count: 0
    }))

    const allRooms = [generalRoom, ...groupRooms]

    // Her oda için son mesajı yükle
    for (const room of allRooms) {
      const { data: lastMsg } = await supabase
        .from('company_chat_messages')
        .select('message, created_at, sender_id, sender:profiles!company_chat_messages_sender_id_fkey(full_name)')
        .eq('company_id', compId)
        .eq(room.id === 'general' ? 'chat_group' : 'chat_group', room.id === 'general' ? null : room.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastMsg) {
        const senderData = lastMsg.sender as any
        room.last_message = {
          message: lastMsg.message,
          sender_name: senderData?.full_name || 'Bilinmeyen',
          created_at: lastMsg.created_at,
          is_own: lastMsg.sender_id === userId
        }
        room.last_message_at = lastMsg.created_at
      }
    }

    setRooms(allRooms.sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ))

    // İlk odayı seç
    if (allRooms.length > 0) {
      setSelectedRoom(allRooms[0])
    }
  }

  const loadMessages = async (roomId: string) => {
    if (!companyId) return

    const { data, error } = await supabase
      .from('company_chat_messages')
      .select(`
        id,
        sender_id,
        message,
        chat_group,
        created_at,
        sender:profiles!company_chat_messages_sender_id_fkey(full_name, email, avatar_url)
      `)
      .eq('company_id', companyId)
      .eq(roomId === 'general' ? 'chat_group' : 'chat_group', roomId === 'general' ? null : roomId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    setMessages((data || []).map((msg: any) => ({
      ...msg,
      sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
    })))
  }

  const subscribeToMessages = (roomId: string) => {
    if (!companyId) return

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_chat_messages',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const newMsg = payload.new as any
          const msgRoomId = newMsg.chat_group || 'general'

          if (msgRoomId === roomId) {
            loadMessages(roomId)
          }

          // Ses çal
          if (newMsg.sender_id !== currentUserId) {
            playNotificationSound()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const subscribeToPresence = async (userId: string) => {
    // Set user online
    await supabase
      .from('user_presence')
      .upsert({
        user_id: userId,
        status: 'online',
        last_seen: new Date().toISOString()
      })

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          if (payload.new) {
            const presence = payload.new as UserPresence
            setOnlineUsers(prev => ({
              ...prev,
              [presence.user_id]: presence
            }))
          }
        }
      )
      .subscribe()

    // Set offline on page unload
    window.addEventListener('beforeunload', () => {
      supabase
        .from('user_presence')
        .update({ status: 'offline', last_seen: new Date().toISOString() })
        .eq('user_id', userId)
    })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedRoom || isSubmitting) return

    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from('company_chat_messages')
        .insert({
          company_id: companyId,
          sender_id: currentUserId,
          message: newMessage.trim(),
          chat_group: selectedRoom.id === 'general' ? null : selectedRoom.id
        })

      if (error) throw error

      setNewMessage('')
      setIsTyping(false)
      scrollToBottom()
    } catch (error: any) {
      alert('❌ Mesaj gönderilemedi: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set typing indicator
    if (!isTyping && e.target.value) {
      setIsTyping(true)
    }

    // Clear typing indicator after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
    }, 2000)
  }

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
      console.log('Ses hatası:', err)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) {
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    } else if (hours < 48) {
      return 'Dün'
    } else if (hours < 168) {
      return date.toLocaleDateString('tr-TR', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    }
  }

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return 'Az önce'
    if (minutes < 60) return `${minutes} dakika önce`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} saat önce`
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  const getGroupIcon = (roomId: string) => {
    const icons: Record<string, string> = {
      'general': '🌍',
      'Yönetim': '👔',
      'Üretim': '🏭',
      'Satış': '💼',
      'Teknik': '🔧'
    }
    return icons[roomId] || '📁'
  }

  const getGroupColor = (roomId: string) => {
    const colors: Record<string, string> = {
      'general': 'from-blue-400 to-blue-600',
      'Yönetim': 'from-purple-400 to-purple-600',
      'Üretim': 'from-orange-400 to-orange-600',
      'Satış': 'from-green-400 to-green-600',
      'Teknik': 'from-red-400 to-red-600'
    }
    return colors[roomId] || 'from-gray-400 to-gray-600'
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
      <div className="flex h-screen bg-gray-100">
        {/* Sol Sidebar - Chat Listesi */}
        <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                {getInitials(currentUserName)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{currentUserName || 'Kullanıcı'}</h3>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Circle className="w-2 h-2 fill-current" />
                  Çevrimiçi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Arşiv">
                <Archive className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Ayarlar">
                <Settings className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Menu">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Arama */}
          <div className="px-3 py-2 bg-white border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Sohbet ara veya yeni başlat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>

          {/* Konuşma Listesi */}
          <div className="flex-1 overflow-y-auto">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedRoom?.id === room.id ? 'bg-gray-100' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getGroupColor(room.id)} flex items-center justify-center text-white text-xl shadow-sm`}>
                    {getGroupIcon(room.id)}
                  </div>
                  {room.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-bold">{room.unread_count > 9 ? '9+' : room.unread_count}</span>
                    </div>
                  )}
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-semibold text-gray-900 truncate text-sm">
                      {room.name}
                    </h4>
                    {room.last_message && (
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTime(room.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {room.last_message && (
                      <>
                        {room.last_message.is_own && (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        )}
                        <p className="text-sm text-gray-600 truncate">
                          {room.last_message.is_own ? '' : `${room.last_message.sender_name}: `}
                          {room.last_message.message}
                        </p>
                      </>
                    )}
                    {!room.last_message && (
                      <p className="text-sm text-gray-400 italic">Henüz mesaj yok</p>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {filteredRooms.length === 0 && (
              <div className="p-8 text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Sohbet bulunamadı</p>
              </div>
            )}
          </div>
        </div>

        {/* Sağ Panel - Aktif Sohbet */}
        {selectedRoom ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGroupColor(selectedRoom.id)} flex items-center justify-center text-white text-lg shadow-sm`}>
                  {getGroupIcon(selectedRoom.id)}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">{selectedRoom.name}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedRoom.type === 'group' ? `Grup sohbeti • ${messages.length} mesaj` : 'Çevrimiçi'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Sesli arama">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2.5 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Görüntülü arama">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2.5 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Daha fazla">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mesajlar */}
            <div
              className="flex-1 overflow-y-auto p-6"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M22 36c6.627 0 12-5.373 12-12s-5.373-12-12-12-12 5.373-12 12 5.373 12 12 12zm96 50c6.627 0 12-5.373 12-12s-5.373-12-12-12-12 5.373-12 12 5.373 12 12 12zm-86-14c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm126 62c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM68 180c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm112-152c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM24 172c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm56-130c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z\' fill=\'%23d4cfbc\' fill-opacity=\'0.12\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
              }}
            >
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg max-w-md">
                    <div className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br ${getGroupColor(selectedRoom.id)} flex items-center justify-center text-white text-3xl shadow-xl`}>
                      {getGroupIcon(selectedRoom.id)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedRoom.name}</h3>
                    <p className="text-gray-600">Henüz mesaj yok. İlk mesajı siz gönderin!</p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                const isOwnMessage = msg.sender_id === currentUserId
                const showDate = index === 0 ||
                  new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()

                return (
                  <div key={msg.id}>
                    {/* Date Separator */}
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-lg shadow-sm">
                          <p className="text-xs font-medium text-gray-600">
                            {new Date(msg.created_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    <div className={`flex mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`flex gap-2 max-w-[65%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Message Bubble */}
                        <div
                          className={`relative px-3 py-2 rounded-lg shadow-sm ${
                            isOwnMessage
                              ? 'bg-[#d9fdd3]'
                              : 'bg-white'
                          }`}
                          style={{
                            borderRadius: isOwnMessage ? '8px 8px 0px 8px' : '8px 8px 8px 0px'
                          }}
                        >
                          {!isOwnMessage && selectedRoom.type === 'group' && (
                            <p className="text-xs font-semibold mb-1" style={{ color: '#00897b' }}>
                              {msg.sender?.full_name || 'Bilinmeyen'}
                            </p>
                          )}
                          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs text-gray-500">
                              {formatTime(msg.created_at)}
                            </span>
                            {isOwnMessage && (
                              <CheckCheck className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                <button
                  type="button"
                  className="p-2.5 hover:bg-gray-200 rounded-full text-gray-600 transition-colors flex-shrink-0"
                  title="Emoji"
                >
                  <Smile className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  className="p-2.5 hover:bg-gray-200 rounded-full text-gray-600 transition-colors flex-shrink-0"
                  title="Dosya ekle"
                >
                  <Paperclip className="w-6 h-6" />
                </button>
                <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-300 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Mesaj yazın"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none text-sm text-gray-900 placeholder-gray-500"
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSubmitting}
                  className="p-3 bg-green-600 hover:bg-green-700 rounded-full text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 flex-shrink-0"
                  title="Gönder"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white border-l border-gray-200">
            <div className="text-center max-w-md px-8">
              <div className="w-64 h-64 mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-10 animate-pulse"></div>
                <div className="absolute inset-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-32 h-32 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">WhatsApp Web</h2>
              <p className="text-gray-600 text-lg mb-6">
                Mesajlaşmaya başlamak için sol taraftan bir sohbet seçin
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Circle className="w-2 h-2 fill-current text-green-600" />
                <span>Bağlı ve çevrimiçi</span>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react'

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  chat_group: string | null
  created_at: string
  sender?: {
    full_name: string
    email: string
  }
}

export default function CompanyChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [userChatGroups, setUserChatGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      // Seçili grubun okunmamış sayısını sıfırla
      setGroupUnreadCounts(prev => ({
        ...prev,
        [selectedGroup]: 0
      }))
      // Toplam okunmamış sayısını yeniden hesapla
      setUnreadCount(prev => Math.max(0, prev - (groupUnreadCounts[selectedGroup] || 0)))
    }
  }, [isOpen, messages])

  useEffect(() => {
    if (companyId) {
      loadMessages(companyId)
      // Seçili gruba geçildiğinde o grubun okunmamış sayısını sıfırla
      if (isOpen) {
        setGroupUnreadCounts(prev => ({
          ...prev,
          [selectedGroup]: 0
        }))
      }
    }
  }, [selectedGroup])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const playNotificationSound = () => {
    try {
      // Web Audio API ile basit bildirim sesi oluştur
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // İki farklı frekans için oscillator oluştur (ding-dong efekti)
      const oscillator1 = audioContext.createOscillator()
      const oscillator2 = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator1.connect(gainNode)
      oscillator2.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // İlk nota (yüksek)
      oscillator1.frequency.value = 800
      oscillator1.type = 'sine'

      // İkinci nota (düşük)
      oscillator2.frequency.value = 600
      oscillator2.type = 'sine'

      // Ses seviyesi
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      // Başlat ve durdur
      oscillator1.start(audioContext.currentTime)
      oscillator1.stop(audioContext.currentTime + 0.15)

      oscillator2.start(audioContext.currentTime + 0.15)
      oscillator2.stop(audioContext.currentTime + 0.3)

      // Cleanup
      setTimeout(() => {
        audioContext.close()
      }, 500)
    } catch (err) {
      console.log('Ses hatası:', err)
    }
  }


  const initChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, chat_group')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    setCompanyId(profile.company_id)
    setUserChatGroups(profile.chat_group || [])

    // Varsayılan olarak Genel Chat'i seç
    setSelectedGroup('all')

    // Load existing messages
    await loadMessages(profile.company_id)

    // Subscribe to realtime changes
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
          console.log('New message received:', payload)
          const newMsg = payload.new as any

          // Kendi mesajımız değilse bildirim gönder
          if (newMsg.sender_id !== user.id) {
            // Sesli bildirim çal
            playNotificationSound()

            // Grup bazlı okunmamış sayıları güncelle
            const msgGroup = newMsg.chat_group || 'all'
            setGroupUnreadCounts(prev => ({
              ...prev,
              [msgGroup]: (prev[msgGroup] || 0) + 1
            }))

            // Toplam okunmamış sayısını artır
            if (!isOpen || selectedGroup !== msgGroup) {
              setUnreadCount(prev => prev + 1)
            }
          }

          loadMessages(profile.company_id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const loadMessages = async (companyId: string) => {
    let query = supabase
      .from('company_chat_messages')
      .select(`
        *,
        sender:profiles!company_chat_messages_sender_id_fkey(full_name, email)
      `)
      .eq('company_id', companyId)

    // Grup filtresi
    if (selectedGroup === 'all') {
      // Genel Chat - chat_group = NULL
      query = query.is('chat_group', null)
    } else {
      // Seçili grup mesajları
      query = query.eq('chat_group', selectedGroup)
    }

    const { data } = await query
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setMessages(data)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !companyId) return

    // Seçili grup kullanıcının gruplarından biri mi veya genel chat mi kontrol et
    if (selectedGroup !== 'all' && !userChatGroups.includes(selectedGroup)) {
      alert('Bu gruba mesaj gönderme yetkiniz yok!')
      return
    }

    // Seçili gruba göre mesaj gönder
    const { error } = await supabase
      .from('company_chat_messages')
      .insert({
        company_id: companyId,
        sender_id: currentUserId,
        message: newMessage.trim(),
        chat_group: selectedGroup === 'all' ? null : selectedGroup
      })

    if (error) {
      console.error('Error sending message:', error)
      alert('Mesaj gönderilemedi!')
      return
    }

    setNewMessage('')
  }

  if (!companyId) return null

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all z-50 flex items-center gap-2 relative"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-1.5 flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <h3 className="font-bold">Şirket Sohbeti</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-700 rounded p-1"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>

            {/* Grup Seçici */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-100">Kanal:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex-1 px-2 py-1 text-sm text-gray-900 rounded border-0 focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">
                  🌍 Genel Chat {groupUnreadCounts.all > 0 ? `(${groupUnreadCounts.all})` : ''}
                </option>
                {userChatGroups.map((group) => (
                  <option key={group} value={group}>
                    📁 {group} {groupUnreadCounts[group] > 0 ? `(${groupUnreadCounts[group]})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
          >
            {messages.map((msg) => {
              const isOwnMessage = msg.sender_id === currentUserId

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg p-3 ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    {!isOwnMessage && (
                      <div className="text-xs font-semibold mb-1 opacity-75">
                        {msg.sender?.full_name || msg.sender?.email || 'Bilinmiyor'}
                      </div>
                    )}
                    <div className="text-sm break-words">{msg.message}</div>
                    <div
                      className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Mesajınızı yazın..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

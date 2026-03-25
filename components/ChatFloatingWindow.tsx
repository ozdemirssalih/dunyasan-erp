'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function ChatFloatingWindow() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getUser()
  }, [])

  // Poll unread count
  useEffect(() => {
    if (!currentUserId) return

    const fetchUnread = async () => {
      try {
        // Get rooms user is in
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', currentUserId)

        if (!participations || participations.length === 0) { setTotalUnread(0); return }

        let total = 0
        for (const p of participations) {
          const { data: otherMsgs } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('room_id', p.room_id)
            .neq('sender_id', currentUserId)
            .eq('is_deleted', false)

          if (otherMsgs && otherMsgs.length > 0) {
            const { data: myReads } = await supabase
              .from('chat_message_reads')
              .select('message_id')
              .eq('user_id', currentUserId)
              .in('message_id', otherMsgs.map(m => m.id))

            const readSet = new Set(myReads?.map(r => r.message_id) || [])
            total += otherMsgs.filter(m => !readSet.has(m.id)).length
          }
        }
        setTotalUnread(total)
      } catch {}
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 15000) // Her 15 saniyede kontrol
    return () => clearInterval(interval)
  }, [currentUserId])

  // Reset unread when opening
  useEffect(() => {
    if (isOpen) setTotalUnread(0)
  }, [isOpen])

  return (
    <>
      {/* Floating Button - sag alt kose */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[9990] group"
          style={{
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <MessageCircle size={22} />
            <span className="font-semibold text-sm">Mesajlar</span>
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shadow-md"
                style={{ animation: 'scaleIn 0.3s ease-out' }}
              >
                {totalUnread}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-[9995] transition-all duration-300 ease-out ${
            isMaximized
              ? 'inset-4'
              : 'bottom-6 right-6 w-[480px] h-[680px]'
          }`}
          style={{
            animation: 'scaleIn 0.2s ease-out',
          }}
        >
          <div className="w-full h-full bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            {/* Window Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-white">
                <MessageCircle size={20} />
                <span className="font-semibold">Mesajlasma</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setIsMaximized(false)
                    router.push('/dashboard/chat')
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Tam sayfa ac"
                >
                  <Maximize2 size={16} className="text-white" />
                </button>
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title={isMaximized ? 'Kucult' : 'Buyut'}
                >
                  {isMaximized ? (
                    <Minimize2 size={16} className="text-white" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setIsOpen(false); setIsMaximized(false) }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Kapat"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* Chat Content - iframe to chat page */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="/dashboard/chat"
                className="w-full h-full border-0"
                style={{ minHeight: 0 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}

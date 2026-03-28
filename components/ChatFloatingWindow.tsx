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
  const [prevUnread, setPrevUnread] = useState(0)

  // Notification sound - louder, more noticeable
  const playNotificationSound = () => {
    try {
      const ctx = new AudioContext()
      // First beep - high pitch
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'square'
      osc1.frequency.setValueAtTime(1200, ctx.currentTime)
      gain1.gain.setValueAtTime(0.4, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.15)

      // Second beep - higher pitch
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'square'
      osc2.frequency.setValueAtTime(1600, ctx.currentTime + 0.18)
      gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.18)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(ctx.currentTime + 0.18)
      osc2.stop(ctx.currentTime + 0.35)

      // Third beep - highest
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'square'
      osc3.frequency.setValueAtTime(2000, ctx.currentTime + 0.38)
      gain3.gain.setValueAtTime(0.6, ctx.currentTime + 0.38)
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55)
      osc3.connect(gain3)
      gain3.connect(ctx.destination)
      osc3.start(ctx.currentTime + 0.38)
      osc3.stop(ctx.currentTime + 0.55)
    } catch {}
  }

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
        if (total > prevUnread) {
          playNotificationSound()
        }
        setPrevUnread(total)
        setTotalUnread(total)
      } catch {}
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 10000) // Her 10 saniyede kontrol
    return () => clearInterval(interval)
  }, [currentUserId])

  // Mark all as read when opening chat + reset unread
  useEffect(() => {
    if (!isOpen || !currentUserId) return
    setTotalUnread(0)

    const markAllRead = async () => {
      try {
        const { data: participations } = await supabase
          .from('chat_participants')
          .select('room_id')
          .eq('user_id', currentUserId)

        if (!participations) return

        for (const p of participations) {
          const { data: unreadMsgs } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('room_id', p.room_id)
            .neq('sender_id', currentUserId)
            .eq('is_deleted', false)

          if (!unreadMsgs || unreadMsgs.length === 0) continue

          const { data: existingReads } = await supabase
            .from('chat_message_reads')
            .select('message_id')
            .eq('user_id', currentUserId)
            .in('message_id', unreadMsgs.map(m => m.id))

          const readIds = new Set(existingReads?.map(r => r.message_id) || [])
          const toInsert = unreadMsgs
            .filter(m => !readIds.has(m.id))
            .map(m => ({ message_id: m.id, user_id: currentUserId, read_at: new Date().toISOString() }))

          if (toInsert.length > 0) {
            await supabase.from('chat_message_reads').insert(toInsert)
          }
        }
      } catch (err) {
        console.error('Mark all read error:', err)
      }
    }
    markAllRead()
  }, [isOpen, currentUserId])

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
          <div className={`relative flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 ${totalUnread > 0 ? 'notify-glow' : ''}`}>
            <MessageCircle size={22} />
            <span className="font-semibold text-sm">Mesajlar</span>
            {totalUnread > 0 && (
              <>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shadow-md notify-badge">
                  {totalUnread}
                </span>
                {/* Yanip sonen isik efekti */}
                <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-400 notify-ping" />
                <span className="absolute inset-0 rounded-2xl notify-border" />
              </>
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
                src="/dashboard/chat?embed=true"
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
        @keyframes notifyPing {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes notifyGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0), 0 4px 12px rgba(0,0,0,0.15); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2), 0 4px 12px rgba(0,0,0,0.15); }
        }
        @keyframes notifyBorder {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4); }
        }
        @keyframes notifyBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .notify-ping {
          animation: notifyPing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        .notify-glow {
          animation: notifyGlow 2s ease-in-out infinite;
        }
        .notify-border {
          animation: notifyBorder 2s ease-in-out infinite;
          pointer-events: none;
          border-radius: 1rem;
        }
        .notify-badge {
          animation: notifyBadgePulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}

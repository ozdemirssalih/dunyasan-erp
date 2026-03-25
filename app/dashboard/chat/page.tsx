'use client'

import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  MessageCircle, X, Send, Paperclip, Smile, Check, CheckCheck,
  Phone, Video, MoreVertical, Search, Users, Archive, Circle,
  Clock, ArrowLeft, Plus, Image as ImageIcon, File as FileIcon,
  Mic, MicOff, Play, Pause, Download, Reply, Edit3, Trash2,
  Forward, Copy, ChevronDown, XCircle, Volume2, UserPlus,
  Hash, Lock, Globe, Camera, AtSign, Star, Pin, Bell, BellOff,
  LogOut, Settings, Loader2, AlertCircle, RefreshCw, StopCircle
} from 'lucide-react'
import dynamic from 'next/dynamic'
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })
import { useDropzone } from 'react-dropzone'

// ============================================================================
// INTERFACES
// ============================================================================

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role_id: string | null
  role_name: string | null
  company_id: string | null
  phone: string | null
  email: string | null
}

interface ChatRoom {
  id: string
  name: string
  type: 'direct' | 'group'
  description: string | null
  avatar_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface ChatParticipant {
  id: string
  room_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profile?: Profile
}

interface ChatMessage {
  id: string
  room_id: string
  sender_id: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'system'
  message: string
  file_url: string | null
  file_name: string | null
  file_size: number | null
  reply_to: string | null
  is_edited: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  sender?: Profile
  reply_to_msg?: ChatMessage
  reactions?: MessageReaction[]
  reads?: MessageRead[]
}

interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  profile?: Profile
}

interface MessageRead {
  id: string
  message_id: string
  user_id: string
  read_at: string
}

interface UserPresence {
  user_id: string
  status: 'online' | 'offline' | 'away'
  last_seen: string
}

interface RoomWithMeta extends ChatRoom {
  participants: ChatParticipant[]
  last_message?: ChatMessage
  unread_count: number
  typing_users: string[]
  online_count: number
  other_user?: Profile
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  message: ChatMessage | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function isYesterday(d: Date, now: Date): boolean {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return isSameDay(d, yesterday)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()

  if (isSameDay(d, now)) return 'Bugün'
  if (isYesterday(d, now)) return 'Dün'

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    return days[d.getDay()]
  }
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Sidebar'daki son mesaj zamanı (WhatsApp tarzı)
function formatSidebarTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()

  if (isSameDay(d, now)) return formatTime(dateStr)
  if (isYesterday(d, now)) return 'Dün'

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    return days[d.getDay()]
  }
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatLastSeen(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60000) return 'az önce çevrimiçiydi'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce çevrimiçiydi`
  if (isSameDay(d, now)) return `bugün saat ${formatTime(dateStr)}`
  if (isYesterday(d, now)) return `dün saat ${formatTime(dateStr)}`
  return `${formatDate(dateStr)} saat ${formatTime(dateStr)}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleLabel(roleName: string | null | undefined): string {
  if (!roleName) return 'Çalışan'
  return roleName
}

// Transform profile with nested role join to flat profile
function mapProfile(p: any): Profile | undefined {
  if (!p) return undefined
  return {
    id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    role_id: p.role_id,
    role_name: p.role?.name || null,
    company_id: p.company_id,
    phone: p.phone,
    email: p.email,
  }
}

// Supabase select string for profiles with role
const PROFILE_SELECT = '*, role:roles(name)'

function getUserColor(userId: string): string {
  const colors = [
    '#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7',
    '#ee7aae', '#6ec9cb', '#faa774', '#82b1ff', '#f48fb1',
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function shouldShowDateSeparator(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return true
  const d1 = new Date(current.created_at).toDateString()
  const d2 = new Date(previous.created_at).toDateString()
  return d1 !== d2
}

function groupReactions(reactions: MessageReaction[]): { emoji: string; count: number; users: string[]; userIds: string[] }[] {
  const map = new Map<string, { count: number; users: string[]; userIds: string[] }>()
  reactions.forEach(r => {
    const existing = map.get(r.emoji)
    if (existing) {
      existing.count++
      existing.users.push(r.profile?.full_name || 'Bilinmeyen')
      existing.userIds.push(r.user_id)
    } else {
      map.set(r.emoji, {
        count: 1,
        users: [r.profile?.full_name || 'Bilinmeyen'],
        userIds: [r.user_id],
      })
    }
  })
  return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }))
}

// Notification sound using Web Audio API - enhanced ding-dong
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    // First tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.setValueAtTime(880, ctx.currentTime)
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.15, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.2)
    // Second tone (higher)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45)
    osc2.start(ctx.currentTime + 0.15)
    osc2.stop(ctx.currentTime + 0.45)
  } catch (e) {
    // Audio not available
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChatPage() {
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [companyId, setCompanyId] = useState<string>('')

  // Room state
  const [rooms, setRooms] = useState<RoomWithMeta[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [roomSearch, setRoomSearch] = useState('')
  const [roomsLoading, setRoomsLoading] = useState(true)

  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [messageSearch, setMessageSearch] = useState('')
  const [showMessageSearch, setShowMessageSearch] = useState(false)
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null)

  // UI state
  const [showSidebar, setShowSidebar] = useState(true)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, message: null })
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [showNewDMModal, setShowNewDMModal] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null)
  const [showDropzone, setShowDropzone] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(false)
  const [showProfileUpload, setShowProfileUpload] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Presence & typing
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map())
  const [typingMap, setTypingMap] = useState<Map<string, string[]>>(new Map())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // New group modal state
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [userSearchText, setUserSearchText] = useState('')

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Selected room derived
  const selectedRoom = useMemo(
    () => rooms.find(r => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  )

  // ============================================================================
  // AUTH & INIT
  // ============================================================================

  useEffect(() => {
    requestNotificationPermission()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, role:roles(name)')
        .eq('id', user.id)
        .single()

      if (profile) {
        const roleName = (profile.role as any)?.name || null
        setCurrentProfile({ ...profile, role_name: roleName })
        setCompanyId(profile.company_id || '')
      }

      // Update presence
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: 'online',
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    init()

    // Update presence on visibility change
    const handleVisibility = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: document.hidden ? 'away' : 'online',
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    document.addEventListener('visibilitychange', handleVisibility)

    // Set offline on unload
    const handleUnload = () => {
      navigator.sendBeacon && navigator.sendBeacon('/api/presence-offline', '')
    }
    window.addEventListener('beforeunload', handleUnload)

    // Presence heartbeat
    const heartbeat = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: 'online',
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }, 30000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleUnload)
      clearInterval(heartbeat)
    }
  }, [])

  // ============================================================================
  // LOAD ROOMS
  // ============================================================================

  const loadRooms = useCallback(async () => {
    if (!currentUserId) return
    setRoomsLoading(true)

    try {
      // Get rooms user participates in
      const { data: participations } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', currentUserId)

      if (!participations || participations.length === 0) {
        setRooms([])
        setRoomsLoading(false)
        return
      }

      const roomIds = participations.map(p => p.room_id)

      // Get room details
      const { data: roomData } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('updated_at', { ascending: false })

      if (!roomData) {
        setRooms([])
        setRoomsLoading(false)
        return
      }

      // Get participants for all rooms
      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('*, profile:profiles(*, role:roles(name))')
        .in('room_id', roomIds)

      // Get last messages for each room
      const roomMetas: RoomWithMeta[] = []

      for (const room of roomData) {
        const roomParticipants = (allParticipants || []).filter(p => p.room_id === room.id)

        // Get last message
        const { data: lastMsgArr } = await supabase
          .from('chat_messages')
          .select('*, sender:profiles!chat_messages_sender_id_fkey(*, role:roles(name))')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMsg = lastMsgArr?.[0] || undefined

        // Get unread count
        const { data: lastRead } = await supabase
          .from('chat_message_reads')
          .select('read_at')
          .eq('user_id', currentUserId)
          .eq('message_id', room.id)
          .maybeSingle()

        // Count unread: messages after last read that aren't from current user
        let unreadCount = 0
        if (lastMsg) {
          const { count } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .neq('sender_id', currentUserId)
            .eq('is_deleted', false)
            .gt('created_at', lastRead?.read_at || '1970-01-01')

          unreadCount = count || 0
        }

        // For DM rooms, find the other user
        let otherUser: Profile | undefined
        if (room.type === 'direct') {
          const other = roomParticipants.find(p => p.user_id !== currentUserId)
          otherUser = other?.profile ? mapProfile(other.profile) : undefined
        }

        // Transform sender role in last message
        const transformedLastMsg = lastMsg ? {
          ...lastMsg,
          sender: lastMsg.sender ? { ...lastMsg.sender, role_name: (lastMsg.sender as any)?.role?.name || null } : undefined,
        } : undefined

        roomMetas.push({
          ...room,
          participants: roomParticipants as any,
          last_message: transformedLastMsg as any,
          unread_count: unreadCount,
          typing_users: [],
          online_count: 0,
          other_user: otherUser,
        })
      }

      // Sort by last message time
      roomMetas.sort((a, b) => {
        const ta = a.last_message?.created_at || a.created_at
        const tb = b.last_message?.created_at || b.created_at
        return new Date(tb).getTime() - new Date(ta).getTime()
      })

      setRooms(roomMetas)
    } catch (err) {
      console.error('Error loading rooms:', err)
    } finally {
      setRoomsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    if (currentUserId) loadRooms()
  }, [currentUserId, loadRooms])

  // ============================================================================
  // LOAD MESSAGES
  // ============================================================================

  const loadMessages = useCallback(async (roomId: string) => {
    setMessagesLoading(true)
    setMessages([])

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(*, role:roles(name)),
          reactions:chat_message_reactions(*, profile:profiles(*, role:roles(name))),
          reads:chat_message_reads(*)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) throw error

      // Load reply-to messages
      const replyIds = (data || []).filter(m => m.reply_to).map(m => m.reply_to)
      let replyMap = new Map<string, ChatMessage>()

      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from('chat_messages')
          .select('*, sender:profiles!chat_messages_sender_id_fkey(*, role:roles(name))')
          .in('id', replyIds)

        replies?.forEach(r => replyMap.set(r.id, r as any))
      }

      const messagesWithReplies = (data || []).map(m => ({
        ...m,
        sender: m.sender ? { ...m.sender, role_name: (m.sender as any)?.role?.name || null } : undefined,
        reply_to_msg: m.reply_to ? (() => {
          const r = replyMap.get(m.reply_to)
          return r ? { ...r, sender: r.sender ? { ...r.sender, role_name: (r.sender as any)?.role?.name || null } : undefined } : undefined
        })() : undefined,
      })) as ChatMessage[]

      setMessages(messagesWithReplies)

      // Mark messages as read
      markMessagesAsRead(roomId)
    } catch (err) {
      console.error('Error loading messages:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedRoomId) {
      loadMessages(selectedRoomId)
    }
  }, [selectedRoomId, loadMessages])

  // ============================================================================
  // MARK AS READ
  // ============================================================================

  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!currentUserId) return

    try {
      // Get unread messages in this room not by current user
      const { data: unreadMsgs } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .neq('sender_id', currentUserId)
        .eq('is_deleted', false)

      if (!unreadMsgs || unreadMsgs.length === 0) return

      // Check which ones are already read
      const { data: existingReads } = await supabase
        .from('chat_message_reads')
        .select('message_id')
        .eq('user_id', currentUserId)
        .in('message_id', unreadMsgs.map(m => m.id))

      const readIds = new Set(existingReads?.map(r => r.message_id) || [])
      const toInsert = unreadMsgs
        .filter(m => !readIds.has(m.id))
        .map(m => ({
          message_id: m.id,
          user_id: currentUserId,
          read_at: new Date().toISOString(),
        }))

      if (toInsert.length > 0) {
        await supabase.from('chat_message_reads').insert(toInsert)
      }

      // Update room unread count
      setRooms(prev => prev.map(r =>
        r.id === roomId ? { ...r, unread_count: 0 } : r
      ))
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }, [currentUserId])

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  useEffect(() => {
    if (!currentUserId) return

    // Subscribe to new messages
    const msgChannel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any

          // Check if this message belongs to a room the user is in
          const roomIds = rooms.map(r => r.id)
          if (!roomIds.includes(newMsg.room_id)) return

          // Get sender profile with role
          const { data: senderRaw } = await supabase
            .from('profiles')
            .select('*, role:roles(name)')
            .eq('id', newMsg.sender_id)
            .single()

          const senderProfile = senderRaw ? { ...senderRaw, role_name: (senderRaw as any)?.role?.name || null } : null

          const fullMsg: ChatMessage = {
            ...newMsg,
            sender: senderProfile || undefined,
            reactions: [],
            reads: [],
          }

          // If reply, fetch the reply
          if (newMsg.reply_to) {
            const { data: replyMsg } = await supabase
              .from('chat_messages')
              .select('*, sender:profiles!chat_messages_sender_id_fkey(*, role:roles(name))')
              .eq('id', newMsg.reply_to)
              .single()
            if (replyMsg) fullMsg.reply_to_msg = replyMsg as any
          }

          // Add to messages if viewing this room
          if (newMsg.room_id === selectedRoomId) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === fullMsg.id)) return prev
              return [...prev, fullMsg]
            })
            // Auto mark as read
            if (newMsg.sender_id !== currentUserId) {
              markMessagesAsRead(newMsg.room_id)
            }
          } else {
            // Increment unread count for other rooms
            if (newMsg.sender_id !== currentUserId) {
              setRooms(prev => prev.map(r =>
                r.id === newMsg.room_id
                  ? { ...r, unread_count: r.unread_count + 1 }
                  : r
              ))
              // Play sound & show notification
              playNotificationSound()
              showBrowserNotification(
                senderProfile?.full_name || 'Yeni mesaj',
                newMsg.message?.substring(0, 100) || 'Dosya gonderdi'
              )
            }
          }

          // Update room last message
          setRooms(prev => {
            const updated = prev.map(r =>
              r.id === newMsg.room_id
                ? { ...r, last_message: fullMsg, updated_at: newMsg.created_at }
                : r
            )
            // Re-sort
            updated.sort((a, b) => {
              const ta = a.last_message?.created_at || a.created_at
              const tb = b.last_message?.created_at || b.created_at
              return new Date(tb).getTime() - new Date(ta).getTime()
            })
            return updated
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updated = payload.new as any
          setMessages(prev => prev.map(m =>
            m.id === updated.id
              ? { ...m, message: updated.message, is_edited: updated.is_edited, is_deleted: updated.is_deleted }
              : m
          ))
        }
      )
      .subscribe()

    // Subscribe to reactions
    const reactionChannel = supabase
      .channel('chat-reactions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_message_reactions',
        },
        async (payload) => {
          // Reload reactions for the affected message
          const msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id
          if (!msgId) return

          const { data: reactions } = await supabase
            .from('chat_message_reactions')
            .select('*, profile:profiles(*, role:roles(name))')
            .eq('message_id', msgId)

          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, reactions: reactions as any || [] } : m
          ))
        }
      )
      .subscribe()

    // Subscribe to read receipts
    const readChannel = supabase
      .channel('chat-reads-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message_reads',
        },
        (payload) => {
          const newRead = payload.new as any
          setMessages(prev => prev.map(m =>
            m.id === newRead.message_id
              ? { ...m, reads: [...(m.reads || []), newRead] }
              : m
          ))
        }
      )
      .subscribe()

    // Subscribe to presence
    const presenceChannel = supabase
      .channel('chat-presence-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          const presence = payload.new as UserPresence
          setPresenceMap(prev => {
            const next = new Map(prev)
            next.set(presence.user_id, presence)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(reactionChannel)
      supabase.removeChannel(readChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [currentUserId, selectedRoomId, rooms.length, markMessagesAsRead])

  // Typing indicator via broadcast
  useEffect(() => {
    if (!selectedRoomId || !currentUserId) return

    const typingChannel = supabase.channel(`typing:${selectedRoomId}`)

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName } = payload.payload
        if (userId === currentUserId) return

        setTypingMap(prev => {
          const next = new Map(prev)
          const current = next.get(selectedRoomId!) || []
          if (!current.includes(userName)) {
            next.set(selectedRoomId!, [...current, userName])
          }
          return next
        })

        // Clear typing after 3 seconds
        setTimeout(() => {
          setTypingMap(prev => {
            const next = new Map(prev)
            const current = next.get(selectedRoomId!) || []
            next.set(selectedRoomId!, current.filter(n => n !== userName))
            return next
          })
        }, 3000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(typingChannel)
    }
  }, [selectedRoomId, currentUserId])

  // ============================================================================
  // LOAD PRESENCE
  // ============================================================================

  useEffect(() => {
    if (rooms.length === 0) return

    const allUserIds = new Set<string>()
    rooms.forEach(r => r.participants.forEach(p => allUserIds.add(p.user_id)))

    const loadPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('*')
        .in('user_id', Array.from(allUserIds))

      if (data) {
        const map = new Map<string, UserPresence>()
        data.forEach(p => map.set(p.user_id, p))
        setPresenceMap(map)
      }
    }

    loadPresence()
  }, [rooms])

  // ============================================================================
  // AUTO SCROLL
  // ============================================================================

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll])

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    setAutoScroll(isNearBottom)
  }, [])

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================

  const sendMessage = useCallback(async () => {
    if (!selectedRoomId || !currentUserId) return
    const text = messageText.trim()
    if (!text && !editingMessage) return

    // If editing
    if (editingMessage) {
      if (!text) return
      await supabase
        .from('chat_messages')
        .update({ message: text, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', editingMessage.id)

      setMessages(prev => prev.map(m =>
        m.id === editingMessage.id ? { ...m, message: text, is_edited: true } : m
      ))
      setEditingMessage(null)
      setMessageText('')
      return
    }

    setMessageText('')
    setReplyingTo(null)

    try {
      const { error } = await supabase.from('chat_messages').insert({
        room_id: selectedRoomId,
        sender_id: currentUserId,
        message_type: 'text',
        message: text,
        reply_to: replyingTo?.id || null,
      })

      if (error) throw error
      // Play send sound
      playNotificationSound()

      // Update room's updated_at
      await supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedRoomId)

    } catch (err) {
      console.error('Error sending message:', err)
      setMessageText(text) // Restore text on failure
    }
  }, [selectedRoomId, currentUserId, messageText, replyingTo, editingMessage])

  // ============================================================================
  // TYPING INDICATOR
  // ============================================================================

  const sendTyping = useCallback(() => {
    if (!selectedRoomId || !currentProfile) return

    const channel = supabase.channel(`typing:${selectedRoomId}`)
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, userName: currentProfile.full_name },
    })
  }, [selectedRoomId, currentUserId, currentProfile])

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  const uploadFile = useCallback(async (file: File) => {
    if (!selectedRoomId || !currentUserId) return
    setUploadProgress(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file)

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName)

      const isImage = file.type.startsWith('image/')
      const isAudio = file.type.startsWith('audio/')

      await supabase.from('chat_messages').insert({
        room_id: selectedRoomId,
        sender_id: currentUserId,
        message_type: isImage ? 'image' : isAudio ? 'audio' : 'file',
        message: isImage ? '' : file.name,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        reply_to: replyingTo?.id || null,
      })

      setReplyingTo(null)

      await supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedRoomId)

    } catch (err) {
      console.error('Error uploading file:', err)
    } finally {
      setUploadProgress(false)
      setShowDropzone(false)
    }
  }, [selectedRoomId, currentUserId, replyingTo])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) uploadFile(files[0])
    },
    noClick: true,
    noKeyboard: true,
  })

  // ============================================================================
  // VOICE RECORDING
  // ============================================================================

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await uploadFile(audioFile)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
    }
  }, [uploadFile])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current?.stream
        stream?.getTracks().forEach(track => track.stop())
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  // ============================================================================
  // DELETE / EDIT / REACT
  // ============================================================================

  const deleteMessage = useCallback(async (messageId: string) => {
    await supabase
      .from('chat_messages')
      .update({ is_deleted: true, message: '', updated_at: new Date().toISOString() })
      .eq('id', messageId)

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, is_deleted: true, message: '' } : m
    ))
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return

    try {
      // Check if already reacted with this emoji
      const { data: existing, error: checkErr } = await supabase
        .from('chat_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
        .maybeSingle()

      if (checkErr) { console.error('Reaction check error:', checkErr); return }

      if (existing) {
        const { error: delErr } = await supabase.from('chat_message_reactions').delete().eq('id', existing.id)
        if (delErr) console.error('Reaction delete error:', delErr)
        // Optimistic update
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, reactions: (m.reactions || []).filter(r => !(r.user_id === currentUserId && r.emoji === emoji)) }
            : m
        ))
      } else {
        const { error: insErr } = await supabase.from('chat_message_reactions').insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        })
        if (insErr) console.error('Reaction insert error:', insErr)
        // Optimistic update
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, reactions: [...(m.reactions || []), { id: crypto.randomUUID(), message_id: messageId, user_id: currentUserId, emoji, created_at: new Date().toISOString() }] }
            : m
        ))
      }
    } catch (err) {
      console.error('Reaction error:', err)
    }
    setShowReactionPicker(null)
  }, [currentUserId])

  // ============================================================================
  // PROFILE PICTURE UPLOAD
  // ============================================================================

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Lütfen bir resim dosyası seçin.')
      return
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Resim boyutu en fazla 5MB olabilir.')
      return
    }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${currentUserId}/avatar.${ext}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUserId)

      if (updateError) throw updateError

      // Update local state
      setCurrentProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
      setShowProfileUpload(false)
    } catch (err) {
      console.error('Avatar upload error:', err)
      alert('Profil resmi yüklenirken hata oluştu.')
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }, [currentUserId])

  // ============================================================================
  // CREATE ROOM
  // ============================================================================

  const loadAllUsers = useCallback(async () => {
    if (!companyId) return
    const { data } = await supabase
      .from('profiles')
      .select('*, role:roles(name)')
      .eq('company_id', companyId)
      .neq('id', currentUserId)
      .order('full_name')

    const mapped = (data || []).map(u => ({
      ...u,
      role_name: (u as any).role?.name || null,
    }))
    setAllUsers(mapped)
  }, [companyId, currentUserId])

  const createGroupRoom = useCallback(async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0 || !currentUserId) return

    try {
      const { data: room, error } = await supabase
        .from('chat_rooms')
        .insert({
          company_id: companyId,
          name: newGroupName.trim(),
          type: 'group',
          description: newGroupDesc.trim() || null,
          created_by: currentUserId,
        })
        .select()
        .single()

      if (error) throw error

      // Add participants
      const participants = [
        { room_id: room.id, user_id: currentUserId, role: 'admin' },
        ...newGroupMembers.map(uid => ({ room_id: room.id, user_id: uid, role: 'member' as const })),
      ]

      await supabase.from('chat_participants').insert(participants)

      // System message
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        sender_id: currentUserId,
        message_type: 'system',
        message: `${currentProfile?.full_name} grubu olusturdu`,
      })

      setShowNewGroupModal(false)
      setNewGroupName('')
      setNewGroupDesc('')
      setNewGroupMembers([])
      await loadRooms()
      setSelectedRoomId(room.id)
    } catch (err) {
      console.error('Error creating group:', err)
    }
  }, [newGroupName, newGroupDesc, newGroupMembers, currentUserId, currentProfile, companyId, loadRooms])

  const createDirectMessage = useCallback(async (userId: string) => {
    if (!currentUserId) return

    try {
      // Check if DM room already exists between these two users
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'direct')

      if (existingRooms) {
        for (const room of existingRooms) {
          const { data: parts } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('room_id', room.id)

          const userIds = parts?.map(p => p.user_id) || []
          if (userIds.length === 2 && userIds.includes(currentUserId) && userIds.includes(userId)) {
            // Room already exists
            setShowNewDMModal(false)
            setSelectedRoomId(room.id)
            if (window.innerWidth < 768) setShowSidebar(false)
            return
          }
        }
      }

      // Create new DM room
      const otherUser = allUsers.find(u => u.id === userId)
      const { data: room, error } = await supabase
        .from('chat_rooms')
        .insert({
          company_id: companyId,
          name: `${currentProfile?.full_name}, ${otherUser?.full_name}`,
          type: 'direct',
          created_by: currentUserId,
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('chat_participants').insert([
        { room_id: room.id, user_id: currentUserId, role: 'member' },
        { room_id: room.id, user_id: userId, role: 'member' },
      ])

      setShowNewDMModal(false)
      await loadRooms()
      setSelectedRoomId(room.id)
      if (window.innerWidth < 768) setShowSidebar(false)
    } catch (err) {
      console.error('Error creating DM:', err)
    }
  }, [currentUserId, currentProfile, companyId, allUsers, loadRooms])

  // ============================================================================
  // AUDIO PLAYBACK
  // ============================================================================

  const toggleAudioPlayback = useCallback((messageId: string, url: string) => {
    if (playingAudioId === messageId) {
      audioRef.current?.pause()
      setPlayingAudioId(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.play()
      setPlayingAudioId(messageId)
      audio.onended = () => setPlayingAudioId(null)
    }
  }, [playingAudioId])

  // ============================================================================
  // CONTEXT MENU
  // ============================================================================

  const handleContextMenu = useCallback((e: React.MouseEvent, message: ChatMessage) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      message,
    })
  }, [])

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }))
      setShowReactionPicker(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ============================================================================
  // SEARCH MESSAGES
  // ============================================================================

  const searchResults = useMemo(() => {
    if (!messageSearch.trim()) return []
    const q = messageSearch.toLowerCase()
    return messages.filter(m =>
      !m.is_deleted && m.message.toLowerCase().includes(q)
    )
  }, [messageSearch, messages])

  // ============================================================================
  // FILTERED ROOMS
  // ============================================================================

  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) return rooms
    const q = roomSearch.toLowerCase()
    return rooms.filter(r => {
      const name = r.type === 'direct' ? (r.other_user?.full_name || r.name) : r.name
      return name.toLowerCase().includes(q)
    })
  }, [rooms, roomSearch])

  // ============================================================================
  // KEY HANDLERS
  // ============================================================================

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
    // Typing indicator
    sendTyping()
  }, [sendMessage, sendTyping])

  // Room selection
  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId)
    setReplyingTo(null)
    setEditingMessage(null)
    setMessageText('')
    setShowEmojiPicker(false)
    setShowMessageSearch(false)
    setMessageSearch('')
    // Aninda unread badge'i sifirla
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, unread_count: 0 } : r
    ))
    if (window.innerWidth < 768) setShowSidebar(false)
  }, [])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getRoomDisplayName = (room: RoomWithMeta): string => {
    if (room.type === 'direct' && room.other_user) {
      return room.other_user.full_name
    }
    return room.name
  }

  const getRoomAvatar = (room: RoomWithMeta): string | null => {
    if (room.type === 'direct' && room.other_user) {
      return room.other_user.avatar_url
    }
    return room.avatar_url
  }

  const isUserOnline = (userId: string): boolean => {
    const presence = presenceMap.get(userId)
    if (!presence) return false
    // Consider online if last seen within 2 minutes
    const diff = Date.now() - new Date(presence.last_seen).getTime()
    return presence.status === 'online' && diff < 120000
  }

  const getRoomOnlineStatus = (room: RoomWithMeta): string => {
    if (room.type === 'direct' && room.other_user) {
      const presence = presenceMap.get(room.other_user.id)
      if (presence && isUserOnline(room.other_user.id)) return 'cevrimici'
      if (presence) return `son gorulme: ${formatLastSeen(presence.last_seen)}`
      return 'cevrimdisi'
    }
    const onlineCount = room.participants.filter(p => isUserOnline(p.user_id)).length
    return `${room.participants.length} katilimci, ${onlineCount} cevrimici`
  }

  const getTypingText = (roomId: string): string | null => {
    const typing = typingMap.get(roomId)
    if (!typing || typing.length === 0) return null
    if (typing.length === 1) return `${typing[0]} yaziyor...`
    if (typing.length === 2) return `${typing[0]} ve ${typing[1]} yaziyor...`
    return `${typing.length} kisi yaziyor...`
  }

  const getMessagePreviewText = (msg?: ChatMessage): string => {
    if (!msg) return 'Henuz mesaj yok'
    if (msg.is_deleted) return 'Bu mesaj silindi'
    switch (msg.message_type) {
      case 'image': return 'Fotograf'
      case 'file': return msg.file_name || 'Dosya'
      case 'audio': return 'Sesli mesaj'
      case 'system': return msg.message
      default: return msg.message
    }
  }

  const MessagePreviewInline = ({ msg }: { msg?: ChatMessage }) => {
    if (!msg) return <span className="italic">Henuz mesaj yok</span>
    if (msg.is_deleted) return <span className="italic">Bu mesaj silindi</span>
    switch (msg.message_type) {
      case 'image':
        return <span className="flex items-center gap-1"><Camera size={13} className="flex-shrink-0" /> Fotograf</span>
      case 'file':
        return <span className="flex items-center gap-1"><FileIcon size={13} className="flex-shrink-0" /> {msg.file_name || 'Dosya'}</span>
      case 'audio':
        return <span className="flex items-center gap-1"><Mic size={13} className="flex-shrink-0" /> Sesli mesaj</span>
      case 'system':
        return <span>{msg.message}</span>
      default:
        return <span>{msg.message}</span>
    }
  }

  const getReadStatus = (msg: ChatMessage): 'sent' | 'delivered' | 'read' => {
    if (msg.sender_id !== currentUserId) return 'sent'
    const reads = msg.reads || []
    const otherReads = reads.filter(r => r.user_id !== currentUserId)
    if (otherReads.length > 0) return 'read'
    return 'sent'
  }

  // Quick reactions with SVG icons
  const quickReactionIcons: { key: string; label: string; svg: JSX.Element }[] = [
    { key: 'like', label: 'Begeni', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-500"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> },
    { key: 'heart', label: 'Kalp', svg: <svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    { key: 'laugh', label: 'Gulmece', svg: <svg viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
    { key: 'surprise', label: 'Saskin', svg: <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="16" r="2" fill="#f97316"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
    { key: 'sad', label: 'Uzgun', svg: <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
    { key: 'pray', label: 'Dua', svg: <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" className="w-5 h-5"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg> },
  ]

  // ============================================================================
  // SUB-COMPONENTS (inline)
  // ============================================================================

  // -- CSS Animation Styles (injected) --
  useEffect(() => {
    const styleId = 'chat-animations-style'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes slideInLeft {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }
      @keyframes pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
        70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .msg-bubble-left { animation: slideInLeft 0.25s ease-out; }
      .msg-bubble-right { animation: slideInRight 0.25s ease-out; }
      .msg-system { animation: fadeInUp 0.3s ease-out; }
      .room-item { animation: fadeIn 0.3s ease-out; }
      .modal-enter { animation: scaleIn 0.2s ease-out; }
      .typing-dot {
        width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;
        animation: typingBounce 1.4s infinite ease-in-out;
      }
      .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      .online-pulse { animation: pulse-ring 2s infinite; }
      .gradient-header {
        background: linear-gradient(135deg, #00a884, #128c7e, #075e54);
        background-size: 200% 200%;
        animation: gradientShift 6s ease infinite;
      }
      .gradient-sidebar-header {
        background: linear-gradient(135deg, #f0f2f5, #e8edf2, #dde5ed);
        background-size: 200% 200%;
        animation: gradientShift 8s ease infinite;
      }
      .hover-lift { transition: transform 0.15s ease, box-shadow 0.15s ease; }
      .hover-lift:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .chat-input-glow:focus-within {
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2), 0 0 12px rgba(34, 197, 94, 0.1);
      }
      .unread-badge {
        animation: scaleIn 0.3s ease-out;
      }
      /* Professional scrollbar */
      .chat-scrollbar::-webkit-scrollbar { width: 6px; }
      .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
      .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
      /* Message hover */
      .msg-hover { transition: background 0.15s ease; }
      .msg-hover:hover { background: rgba(0,0,0,0.02); }
      /* Skeleton loading */
      @keyframes skeletonPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.8; }
      }
      .skeleton {
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 6px;
      }
      /* Send button pulse */
      @keyframes sendPulse {
        0% { transform: scale(1); }
        50% { transform: scale(0.9); }
        100% { transform: scale(1); }
      }
      .send-btn:active { animation: sendPulse 0.2s ease; }
      /* Date separator line */
      .date-separator {
        display: flex; align-items: center; gap: 12px;
        color: #6b7280; font-size: 11px; padding: 8px 0;
      }
      .date-separator::before, .date-separator::after {
        content: ''; flex: 1; height: 1px;
        background: linear-gradient(to right, transparent, rgba(0,0,0,0.08), transparent);
      }
      /* Context menu */
      .context-menu {
        animation: scaleIn 0.15s ease-out;
        backdrop-filter: blur(12px);
        background: rgba(255,255,255,0.95);
      }
      /* Better hover for room items */
      .room-hover { transition: all 0.2s ease; }
      .room-hover:hover { background: linear-gradient(135deg, #f5f6f6, #eef1f5); }
      /* Message bubble tail */
      .bubble-own { border-bottom-right-radius: 4px; }
      .bubble-other { border-bottom-left-radius: 4px; }
      /* Recording pulse */
      @keyframes recordPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .rec-pulse { animation: recordPulse 1s infinite; }
      /* Image hover zoom */
      .img-preview { transition: transform 0.2s ease; }
      .img-preview:hover { transform: scale(1.02); }
      /* Smooth appear for new messages */
      @keyframes newMsgPop {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .new-msg { animation: newMsgPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
      /* Professional tag badges */
      .role-badge {
        font-size: 10px; padding: 1px 6px; border-radius: 10px;
        background: linear-gradient(135deg, #e0f2fe, #dbeafe);
        color: #1e40af; font-weight: 500;
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(styleId)?.remove() }
  }, [])

  // -- Skeleton Loader Components --
  const RoomSkeleton = () => (
    <div className="flex items-center px-4 py-3 gap-3 border-b border-gray-100">
      <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-3.5 w-28 skeleton" />
          <div className="h-3 w-10 skeleton" />
        </div>
        <div className="h-3 w-40 skeleton" />
      </div>
    </div>
  )

  const MessageSkeleton = ({ isOwn }: { isOwn: boolean }) => (
    <div className={`flex mb-3 px-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && <div className="h-2.5 w-20 skeleton ml-1" />}
        <div className={`rounded-lg px-4 py-3 ${isOwn ? 'bg-[#d9fdd3]/50' : 'bg-white/50'}`}>
          <div className="space-y-1.5">
            <div className={`h-3 skeleton ${isOwn ? 'w-36' : 'w-44'}`} />
            <div className={`h-3 skeleton ${isOwn ? 'w-24' : 'w-32'}`} />
          </div>
        </div>
      </div>
    </div>
  )

  // -- Typing Bubble Component --
  const TypingBubble = ({ names }: { names: string[] }) => {
    if (names.length === 0) return null
    const text = names.length === 1
      ? `${names[0]} yaziyor`
      : names.length === 2
        ? `${names[0]} ve ${names[1]} yaziyor`
        : `${names.length} kisi yaziyor`
    return (
      <div className="flex items-start gap-2 px-4 mb-2 msg-bubble-left">
        <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
          <div className="text-[11px] text-green-600 font-medium mb-1">{text}</div>
          <div className="flex items-center gap-1">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    )
  }

  // -- Enhanced Notification Sound --
  const playNotificationSound = useCallback((type: 'message' | 'send' | 'typing' = 'message') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      if (type === 'message') {
        // Ding-dong notification
        oscillator.frequency.setValueAtTime(880, ctx.currentTime)
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.4)
      } else if (type === 'send') {
        // Quick swoosh
        oscillator.frequency.setValueAtTime(600, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08)
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.15)
      }
    } catch {}
  }, [])

  // -- Avatar Component --
  const Avatar = ({ src, name, size = 40, online, showStatus = false }: {
    src?: string | null; name: string; size?: number; online?: boolean; showStatus?: boolean
  }) => (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            width: size,
            height: size,
            backgroundColor: getUserColor(name),
            fontSize: size * 0.35,
          }}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && (
        <div
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${
            online ? 'bg-green-500 online-pulse' : 'bg-gray-400'
          }`}
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </div>
  )

  // -- Message Bubble Component --
  const MessageBubble = ({ message, prevMessage }: { message: ChatMessage; prevMessage?: ChatMessage }) => {
    const isOwn = message.sender_id === currentUserId
    const isSystem = message.message_type === 'system'
    const showSender = selectedRoom?.type === 'group' && !isOwn && !isSystem &&
      (!prevMessage || prevMessage.sender_id !== message.sender_id ||
        prevMessage.message_type === 'system')
    const showDateSep = shouldShowDateSeparator(message, prevMessage)
    const readStatus = getReadStatus(message)
    const grouped = groupReactions(message.reactions || [])
    const isHighlighted = searchHighlightId === message.id

    if (isSystem) {
      return (
        <>
          {showDateSep && (
            <div className="flex justify-center my-3">
              <span className="bg-white/80 text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm">
                {formatDate(message.created_at)}
              </span>
            </div>
          )}
          <div className="flex justify-center my-2">
            <span className="bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 text-xs px-4 py-1.5 rounded-lg shadow-sm border border-yellow-200 msg-system">
              {message.message}
            </span>
          </div>
        </>
      )
    }

    return (
      <>
        {showDateSep && (
          <div className="date-separator my-3 px-8">
            <span className="bg-white/90 backdrop-blur-sm text-gray-500 text-[11px] px-4 py-1 rounded-full shadow-sm border border-gray-100 font-medium whitespace-nowrap">
              {formatDate(message.created_at)}
            </span>
          </div>
        )}
        <div
          className={`flex mb-1 px-4 ${isOwn ? 'justify-end' : 'justify-start'} ${
            isHighlighted ? 'bg-yellow-100/50 rounded-lg transition-colors duration-1000' : ''
          }`}
          onContextMenu={(e) => handleContextMenu(e, message)}
        >
          {/* Avatar for group messages from others */}
          {!isOwn && selectedRoom?.type === 'group' && (
            <div className="flex-shrink-0 mr-2 self-end mb-0.5">
              {showSender ? (
                <Avatar
                  src={message.sender?.avatar_url}
                  name={message.sender?.full_name || '?'}
                  size={28}
                />
              ) : (
                <div style={{ width: 28 }} />
              )}
            </div>
          )}
          <div className={`max-w-[65%]`}>
            {/* Sender name + role for groups */}
            {showSender && (
              <div className="mb-1 ml-1 flex items-center gap-2">
                <span
                  className="text-xs font-bold"
                  style={{ color: getUserColor(message.sender_id) }}
                >
                  {message.sender?.full_name || 'Bilinmeyen'}
                </span>
                <span className="role-badge">
                  {getRoleLabel(message.sender?.role_name)}
                </span>
              </div>
            )}

            <div
              className={`relative rounded-xl px-3 py-1.5 shadow-sm group transition-shadow duration-200 hover:shadow-md ${
                message.is_deleted
                  ? 'bg-gray-100/80 border border-gray-200 backdrop-blur-sm'
                  : isOwn
                    ? 'bg-gradient-to-br from-[#d9fdd3] to-[#d0f5cb] text-gray-800 bubble-own'
                    : 'bg-gradient-to-br from-white to-[#fafafa] text-gray-800 bubble-other'
              }`}
            >
              {/* Reply preview */}
              {message.reply_to_msg && !message.is_deleted && (
                <div className="bg-black/5 border-l-4 border-green-500 rounded px-2 py-1 mb-1 text-xs">
                  <div className="font-semibold" style={{ color: getUserColor(message.reply_to_msg.sender_id) }}>
                    {message.reply_to_msg.sender?.full_name || 'Bilinmeyen'}
                  </div>
                  <div className="text-gray-600 truncate">
                    {message.reply_to_msg.is_deleted ? 'Bu mesaj silindi' : message.reply_to_msg.message || getMessagePreviewText(message.reply_to_msg)}
                  </div>
                </div>
              )}

              {/* Deleted message */}
              {message.is_deleted ? (
                <div className="flex items-center gap-1.5 text-gray-400 italic text-sm py-1">
                  <AlertCircle size={14} />
                  <span>Bu mesaj silindi</span>
                </div>
              ) : (
                <>
                  {/* Image message */}
                  {message.message_type === 'image' && message.file_url && (
                    <div className="mb-1 -mx-1 -mt-0.5 overflow-hidden rounded-lg">
                      <img
                        src={message.file_url}
                        alt="Gorsel"
                        className="rounded-lg max-w-full cursor-pointer img-preview"
                        style={{ maxHeight: 300 }}
                        onClick={() => setShowImagePreview(message.file_url)}
                      />
                    </div>
                  )}

                  {/* File message */}
                  {message.message_type === 'file' && (
                    <div className="flex items-center gap-3 p-2.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 rounded-xl mb-1 border border-blue-100/50">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <FileIcon size={20} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{message.file_name}</div>
                        <div className="text-xs text-gray-500">
                          {message.file_size ? formatFileSize(message.file_size) : ''}
                        </div>
                      </div>
                      <a
                        href={message.file_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
                      >
                        <Download size={18} className="text-gray-600" />
                      </a>
                    </div>
                  )}

                  {/* Audio message */}
                  {message.message_type === 'audio' && message.file_url && (
                    <div className="flex items-center gap-3 py-1 min-w-[200px]">
                      <button
                        onClick={() => toggleAudioPlayback(message.id, message.file_url!)}
                        className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0 hover:bg-green-600 transition-colors"
                      >
                        {playingAudioId === message.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                      </button>
                      <div className="flex-1">
                        {/* Waveform visualization */}
                        <div className="flex items-center gap-0.5 h-6">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 rounded-full ${
                                playingAudioId === message.id ? 'bg-green-600' : 'bg-gray-400'
                              }`}
                              style={{
                                height: `${Math.random() * 16 + 4}px`,
                                opacity: playingAudioId === message.id ? 1 : 0.5,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text content */}
                  {message.message_type === 'text' && (
                    <span className="text-sm whitespace-pre-wrap break-words">
                      {messageSearch.trim() ? (
                        highlightText(message.message, messageSearch)
                      ) : (
                        message.message
                      )}
                    </span>
                  )}

                  {/* Metadata row */}
                  <div className={`flex items-center gap-1 justify-end mt-0.5 ${
                    message.message_type === 'text' ? '-mb-0.5' : ''
                  }`}>
                    {message.is_edited && (
                      <span className="text-[10px] text-gray-400 italic">duzenlendi</span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {formatTime(message.created_at)}
                    </span>
                    {isOwn && (
                      <span className="ml-0.5">
                        {readStatus === 'read' ? (
                          <CheckCheck size={14} className="text-blue-500" />
                        ) : readStatus === 'delivered' ? (
                          <CheckCheck size={14} className="text-gray-400" />
                        ) : (
                          <Check size={14} className="text-gray-400" />
                        )}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Hover actions */}
              {!message.is_deleted && (
                <div className={`absolute top-0 ${isOwn ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowReactionPicker(showReactionPicker === message.id ? null : message.id)
                    }}
                    className="p-1 hover:bg-black/10 rounded-full"
                  >
                    <Smile size={16} className="text-gray-500" />
                  </button>
                </div>
              )}

              {/* Reaction picker */}
              {showReactionPicker === message.id && (
                <div
                  className={`absolute ${isOwn ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-0 bg-white rounded-full shadow-lg border flex items-center gap-1 px-2 py-1 z-10`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {quickReactionIcons.map(r => (
                    <button
                      key={r.key}
                      onClick={() => toggleReaction(message.id, r.key)}
                      className="hover:scale-125 transition-transform p-0.5"
                      title={r.label}
                    >
                      {r.svg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reactions display */}
            {grouped.length > 0 && (
              <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'} px-1`}>
                {grouped.map(({ emoji, count, userIds }) => {
                  const iconDef = quickReactionIcons.find(r => r.key === emoji)
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(message.id, emoji)}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                        userIds.includes(currentUserId)
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      title={iconDef?.label || emoji}
                    >
                      {iconDef ? <span className="w-4 h-4">{iconDef.svg}</span> : <span>{emoji}</span>}
                      {count > 1 && <span className="ml-0.5">{count}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // Highlight text helper
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
        : part
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!currentUserId) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-green-600" size={48} />
          <p className="text-gray-500">Yukleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex bg-gray-200 rounded-xl overflow-hidden shadow-xl border border-gray-300">
      {/* ================================================================== */}
      {/* SIDEBAR */}
      {/* ================================================================== */}
      <div
        className={`${
          showSidebar ? 'flex' : 'hidden md:flex'
        } flex-col bg-white border-r border-gray-200 ${
          selectedRoomId && !showSidebar ? 'hidden' : ''
        }`}
        style={{ width: showSidebar && !selectedRoomId ? '100%' : 380, minWidth: selectedRoomId ? 380 : undefined }}
      >
        {/* Sidebar Header */}
        <div className="gradient-sidebar-header px-4 py-3 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="relative cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
              title="Profil resmini değiştir"
            >
              <Avatar
                src={currentProfile?.avatar_url}
                name={currentProfile?.full_name || '?'}
                size={40}
                online={true}
                showStatus={true}
              />
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                <Camera size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <span className="font-semibold text-gray-800 text-sm block">
                {currentProfile?.full_name || 'Kullanici'}
              </span>
              <span className="text-xs text-gray-500">
                {getRoleLabel(currentProfile?.role_name)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowNewGroupModal(true); loadAllUsers() }}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Yeni grup olustur"
            >
              <Users size={20} className="text-gray-600" />
            </button>
            <button
              onClick={() => { setShowNewDMModal(true); loadAllUsers() }}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Yeni mesaj"
            >
              <MessageCircle size={20} className="text-gray-600" />
            </button>
            <button
              onClick={loadRooms}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Yenile"
            >
              <RefreshCw size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 bg-white">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Sohbet ara veya yeni sohbet baslat"
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              className="w-full bg-[#f0f2f5] rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-green-300 transition-all"
            />
          </div>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto chat-scrollbar">
          {roomsLoading ? (
            <div>
              {[...Array(6)].map((_, i) => <RoomSkeleton key={i} />)}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-8">
              <MessageCircle size={48} className="mb-3 opacity-30" />
              <p className="text-sm text-center">
                {roomSearch ? 'Arama sonucu bulunamadi' : 'Henuz sohbet yok. Yeni bir sohbet baslatmak icin sag ustteki butonlari kullanin.'}
              </p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = selectedRoomId === room.id
              const displayName = getRoomDisplayName(room)
              const avatarSrc = getRoomAvatar(room)
              const typing = getTypingText(room.id)
              const otherOnline = room.type === 'direct' && room.other_user
                ? isUserOnline(room.other_user.id)
                : false

              return (
                <div
                  key={room.id}
                  onClick={() => selectRoom(room.id)}
                  className={`flex items-center px-4 py-3 cursor-pointer border-b border-gray-100 transition-all duration-200 room-item ${
                    isSelected ? 'bg-[#f0f2f5] border-l-4 border-l-green-500' : 'hover:bg-[#f5f6f6] hover:pl-5'
                  }`}
                >
                  <Avatar
                    src={avatarSrc}
                    name={displayName}
                    size={48}
                    online={otherOnline}
                    showStatus={room.type === 'direct'}
                  />
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        <span className="font-semibold text-gray-800 text-sm truncate block">
                          {displayName}
                        </span>
                        {room.type === 'direct' && room.other_user && (
                          <span className="text-[11px] text-gray-400 truncate block -mt-0.5">
                            {getRoleLabel(room.other_user.role_name)}
                          </span>
                        )}
                        {room.type === 'group' && (
                          <span className="text-[11px] text-gray-400 truncate block -mt-0.5">
                            {room.participants.length} katılımcı
                          </span>
                        )}
                      </div>
                      <span className={`text-xs flex-shrink-0 ml-2 ${
                        room.unread_count > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'
                      }`}>
                        {room.last_message
                          ? formatSidebarTime(room.last_message.created_at)
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500 truncate pr-2">
                        {typing ? (
                          <span className="text-green-600 italic flex items-center gap-1">
                            {typing}
                            <span className="inline-flex items-center gap-0.5 ml-0.5">
                              <span className="typing-dot" style={{ width: 4, height: 4 }} />
                              <span className="typing-dot" style={{ width: 4, height: 4 }} />
                              <span className="typing-dot" style={{ width: 4, height: 4 }} />
                            </span>
                          </span>
                        ) : room.last_message ? (
                          <>
                            {room.last_message.sender_id === currentUserId && (
                              <span className="inline-flex mr-0.5">
                                {getReadStatus(room.last_message) === 'read' ? (
                                  <CheckCheck size={14} className="text-blue-500" />
                                ) : (
                                  <Check size={14} className="text-gray-400" />
                                )}
                              </span>
                            )}
                            {room.type === 'group' && room.last_message.sender_id !== currentUserId && (
                              <span className="font-medium">
                                {room.last_message.sender?.full_name?.split(' ')[0]}:{' '}
                              </span>
                            )}
                            <MessagePreviewInline msg={room.last_message} />
                          </>
                        ) : (
                          <span className="italic">Henuz mesaj yok</span>
                        )}
                      </span>
                      {room.unread_count > 0 && (
                        <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0 font-medium unread-badge shadow-sm">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* CHAT AREA */}
      {/* ================================================================== */}
      <div className={`flex-1 flex flex-col ${!selectedRoomId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedRoomId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
            <div className="text-center max-w-md px-8">
              <div className="w-64 h-64 mx-auto mb-6 opacity-50">
                <svg viewBox="0 0 303 172" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M229.565 160.229C262.212 149.245 286.931 118.241 283.39 73.4194C278.009 5.31929 210.065 -13.537 151.5 7.91904C92.9345 29.3751 24.0658 28.3184 6.02325 74.4194C-12.0193 120.52 47.0658 178.52 151.5 168.919C195.565 164.781 213.34 165.792 229.565 160.229Z" fill="#DAF7F3"/>
                  <rect x="80" y="30" width="143" height="95" rx="8" fill="white" stroke="#25D366" strokeWidth="2"/>
                  <path d="M114 60H180" stroke="#25D366" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M114 75H200" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M114 90H170" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M114 105H190" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="97" cy="60" r="4" fill="#25D366"/>
                  <circle cx="97" cy="75" r="4" fill="#E5E7EB"/>
                  <circle cx="97" cy="90" r="4" fill="#E5E7EB"/>
                  <circle cx="97" cy="105" r="4" fill="#E5E7EB"/>
                </svg>
              </div>
              <h2 className="text-2xl font-light text-gray-700 mb-3">Dunyasan Mesajlasma</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Ekip arkadaslarinizla mesajlasin. Dosya paylasin, sesli mesaj gonderin ve gruplar olusturun.
                Baslamak icin soldan bir sohbet secin veya yeni bir sohbet baslatin.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="gradient-sidebar-header px-4 py-2.5 flex items-center justify-between border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowSidebar(true); setSelectedRoomId(null) }}
                  className="md:hidden p-1 hover:bg-gray-200 rounded-full mr-1"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <Avatar
                  src={selectedRoom ? getRoomAvatar(selectedRoom) : null}
                  name={selectedRoom ? getRoomDisplayName(selectedRoom) : '?'}
                  size={40}
                  online={selectedRoom?.type === 'direct' && selectedRoom?.other_user
                    ? isUserOnline(selectedRoom.other_user.id) : false}
                  showStatus={selectedRoom?.type === 'direct'}
                />
                <div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {selectedRoom ? getRoomDisplayName(selectedRoom) : ''}
                  </div>
                  {selectedRoom?.type === 'direct' && selectedRoom?.other_user && (
                    <div className="text-[11px] text-green-600 font-medium">
                      {getRoleLabel(selectedRoom.other_user.role_name)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {selectedRoom && getTypingText(selectedRoom.id) ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        {getTypingText(selectedRoom.id)}
                        <span className="inline-flex items-center gap-0.5">
                          <span className="typing-dot" style={{ width: 4, height: 4 }} />
                          <span className="typing-dot" style={{ width: 4, height: 4 }} />
                          <span className="typing-dot" style={{ width: 4, height: 4 }} />
                        </span>
                      </span>
                    ) : selectedRoom ? (
                      getRoomOnlineStatus(selectedRoom)
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowMessageSearch(!showMessageSearch); setMessageSearch('') }}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <Search size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Message Search Bar */}
            {showMessageSearch && (
              <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Mesajlarda ara..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="flex-1 text-sm outline-none"
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {searchResults.length} sonuc
                  </span>
                )}
                {searchResults.length > 0 && (
                  <div className="flex gap-1">
                    {searchResults.slice(0, 5).map((msg) => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          setSearchHighlightId(msg.id)
                          document.getElementById(`msg-${msg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          setTimeout(() => setSearchHighlightId(null), 3000)
                        }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors"
                      >
                        {formatTime(msg.created_at)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setShowMessageSearch(false); setMessageSearch(''); setSearchHighlightId(null) }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto bg-[#efeae2] chat-scrollbar"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cdefs%3E%3Cstyle%3E.c%7Bfill:%23c8c3bc;opacity:0.08%7D%3C/style%3E%3C/defs%3E%3Ccircle class='c' cx='20' cy='20' r='2'/%3E%3Ccircle class='c' cx='60' cy='15' r='1.5'/%3E%3Ccircle class='c' cx='100' cy='25' r='2'/%3E%3Ccircle class='c' cx='140' cy='10' r='1.5'/%3E%3Ccircle class='c' cx='180' cy='30' r='2'/%3E%3Cpath class='c' d='M30 55l3-3 3 3-3 3z'/%3E%3Cpath class='c' d='M90 50l4-4 4 4-4 4z'/%3E%3Cpath class='c' d='M150 60l3-3 3 3-3 3z'/%3E%3Cpath class='c' d='M10 90c3 0 5-2 5-5s-2-5-5-5-5 2-5 5 2 5 5 5zm0-8c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3z'/%3E%3Cpath class='c' d='M70 80c3 0 5-2 5-5s-2-5-5-5-5 2-5 5 2 5 5 5zm0-8c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3z'/%3E%3Cpath class='c' d='M130 85l-5-8h10z'/%3E%3Cpath class='c' d='M175 78l-4-6h8z'/%3E%3Cpath class='c' d='M40 120h6v1h-6z'/%3E%3Cpath class='c' d='M40 123h4v1h-4z'/%3E%3Cpath class='c' d='M110 115h6v1h-6z'/%3E%3Cpath class='c' d='M110 118h4v1h-4z'/%3E%3Cpath class='c' d='M165 120c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4zm2 0c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z'/%3E%3Cpath class='c' d='M20 155l2-6 2 6-6-2 6-2z'/%3E%3Cpath class='c' d='M80 150c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z'/%3E%3Cpath class='c' d='M140 155l3-3 3 3-3 3z'/%3E%3Cpath class='c' d='M185 145l2-6 2 6-6-2 6-2z'/%3E%3Ccircle class='c' cx='50' cy='185' r='2'/%3E%3Ccircle class='c' cx='110' cy='180' r='1.5'/%3E%3Cpath class='c' d='M160 190l-4-6h8z'/%3E%3Cpath class='c' d='M25 45c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1h-3c-.6 0-1-.4-1-1v-2z'/%3E%3Cpath class='c' d='M120 40c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1h-3c-.6 0-1-.4-1-1v-2z'/%3E%3C/svg%3E")`,
              }}
              {...getRootProps()}
            >
              <input {...getInputProps()} />

              {/* Drag overlay */}
              {isDragActive && (
                <div className="absolute inset-0 bg-green-500/20 border-4 border-dashed border-green-500 rounded-lg flex items-center justify-center z-50 backdrop-blur-sm">
                  <div className="text-center">
                    <Paperclip size={48} className="mx-auto mb-2 text-green-600" />
                    <p className="text-lg font-semibold text-green-700">Dosyayi buraya birakin</p>
                  </div>
                </div>
              )}

              {messagesLoading ? (
                <div className="py-4 space-y-1">
                  <MessageSkeleton isOwn={false} />
                  <MessageSkeleton isOwn={true} />
                  <MessageSkeleton isOwn={false} />
                  <MessageSkeleton isOwn={true} />
                  <MessageSkeleton isOwn={false} />
                  <MessageSkeleton isOwn={true} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center mb-4 shadow-inner">
                    <Lock size={28} className="text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Mesajlar uçtan uca sifrelenmistir</p>
                  <p className="text-xs mt-1.5 text-gray-400">Mesaj gondererek sohbete baslayin</p>
                  <div className="mt-4 flex items-center gap-1 text-[10px] text-gray-300">
                    <Lock size={10} />
                    <span>Gizlilik korumalı</span>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {messages.map((msg, idx) => (
                    <div key={msg.id} id={`msg-${msg.id}`} className={msg.sender_id === currentUserId ? 'msg-bubble-right' : 'msg-bubble-left'}>
                      <MessageBubble
                        message={msg}
                        prevMessage={idx > 0 ? messages[idx - 1] : undefined}
                      />
                    </div>
                  ))}
                  {/* Typing indicator bubble */}
                  {selectedRoomId && (typingMap.get(selectedRoomId)?.length ?? 0) > 0 && (
                    <TypingBubble names={typingMap.get(selectedRoomId) || []} />
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Scroll to bottom button */}
            {!autoScroll && (
              <div className="absolute bottom-20 right-8 z-10">
                <button
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                    setAutoScroll(true)
                  }}
                  className="bg-white shadow-lg rounded-full p-2.5 hover:bg-gray-50 transition-all duration-200 border border-gray-200 hover:shadow-xl hover:-translate-y-0.5"
                >
                  <ChevronDown size={20} className="text-gray-600" />
                </button>
              </div>
            )}

            {/* Reply / Edit Preview */}
            {(replyingTo || editingMessage) && (
              <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-3">
                <div className={`w-1 h-10 rounded-full flex-shrink-0 ${editingMessage ? 'bg-blue-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold ${editingMessage ? 'text-blue-600' : 'text-green-600'}`}>
                    {editingMessage ? 'Mesaji duzenle' : (replyingTo?.sender?.full_name || 'Yanit')}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {editingMessage
                      ? editingMessage.message
                      : replyingTo?.is_deleted
                        ? 'Bu mesaj silindi'
                        : getMessagePreviewText(replyingTo!)
                    }
                  </div>
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null)
                    setEditingMessage(null)
                    setMessageText('')
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full flex-shrink-0"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className="bg-gradient-to-r from-[#f0f2f5] to-[#e8ecf0] px-3 py-2 flex items-end gap-2 border-t border-gray-200 flex-shrink-0 chat-input-glow transition-all duration-300">
              {isRecording ? (
                /* Recording UI */
                <div className="flex-1 flex items-center gap-3 bg-white rounded-lg px-4 py-2.5">
                  <button
                    onClick={cancelRecording}
                    className="p-1 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 size={20} className="text-red-500" />
                  </button>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600 font-mono">
                      {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                      {(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                    <div className="flex-1 flex items-center gap-0.5">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-red-400 rounded-full animate-pulse"
                          style={{
                            height: `${Math.random() * 20 + 4}px`,
                            animationDelay: `${i * 50}ms`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="p-2 bg-green-500 hover:bg-green-600 rounded-full text-white transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <>
                  {/* Emoji button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <Smile size={22} className="text-gray-600" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50">
                        <EmojiPicker
                          onEmojiClick={(emojiData: any) => {
                            setMessageText(prev => prev + emojiData.emoji)
                            messageInputRef.current?.focus()
                          }}
                          theme={"light" as any}
                          width={320}
                          height={400}
                          searchPlaceHolder="Emoji ara..."
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Attachment button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDropzone(!showDropzone)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <Paperclip size={22} className="text-gray-600 transform rotate-45" />
                    </button>
                    {showDropzone && (
                      <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border p-3 z-50 w-48">
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <ImageIcon size={16} className="text-purple-600" />
                          </div>
                          <span className="text-sm text-gray-700">Fotograf</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) uploadFile(e.target.files[0])
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <FileIcon size={16} className="text-blue-600" />
                          </div>
                          <span className="text-sm text-gray-700">Dosya</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) uploadFile(e.target.files[0])
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Camera size={16} className="text-red-600" />
                          </div>
                          <span className="text-sm text-gray-700">Kamera</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) uploadFile(e.target.files[0])
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <div className="flex-1">
                    <textarea
                      ref={messageInputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Bir mesaj yazin"
                      rows={1}
                      className="w-full bg-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-300 resize-none max-h-32 transition-all"
                      style={{
                        height: 'auto',
                        minHeight: '40px',
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                      }}
                    />
                  </div>

                  {/* Send / Record button */}
                  {messageText.trim() ? (
                    <button
                      onClick={sendMessage}
                      className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full text-white transition-all duration-200 flex-shrink-0 shadow-md hover:shadow-lg send-btn"
                    >
                      <Send size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="p-2.5 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                    >
                      <Mic size={22} className="text-gray-600" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Upload progress overlay */}
            {uploadProgress && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-green-500" size={36} />
                  <p className="text-sm text-gray-600">Dosya yukleniyor...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* CONTEXT MENU */}
      {/* ================================================================== */}
      {contextMenu.visible && contextMenu.message && (
        <div
          className="fixed context-menu rounded-2xl shadow-2xl border border-gray-100 py-2 z-[9999] min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {!contextMenu.message.is_deleted && (
            <>
              <button
                onClick={() => {
                  setReplyingTo(contextMenu.message!)
                  setContextMenu({ ...contextMenu, visible: false })
                  messageInputRef.current?.focus()
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Reply size={16} className="text-gray-500" />
                Yanitla
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.message!.message)
                  setContextMenu({ ...contextMenu, visible: false })
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Copy size={16} className="text-gray-500" />
                Kopyala
              </button>

              {/* Quick reactions in context menu */}
              <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-100">
                {quickReactionIcons.map(r => (
                  <button
                    key={r.key}
                    onClick={() => {
                      toggleReaction(contextMenu.message!.id, r.key)
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    className="hover:scale-125 transition-transform p-0.5"
                    title={r.label}
                  >
                    {r.svg}
                  </button>
                ))}
              </div>

              {contextMenu.message.sender_id === currentUserId && (
                <>
                  {contextMenu.message.message_type === 'text' && (
                    <button
                      onClick={() => {
                        setEditingMessage(contextMenu.message!)
                        setMessageText(contextMenu.message!.message)
                        setContextMenu({ ...contextMenu, visible: false })
                        messageInputRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                    >
                      <Edit3 size={16} className="text-gray-500" />
                      Duzenle
                    </button>
                  )}

                  <button
                    onClick={() => {
                      deleteMessage(contextMenu.message!.id)
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-red-600 transition-colors"
                  >
                    <Trash2 size={16} className="text-red-500" />
                    Sil
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setContextMenu({ ...contextMenu, visible: false })
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Forward size={16} className="text-gray-500" />
                Ilet
              </button>
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* IMAGE PREVIEW MODAL */}
      {/* ================================================================== */}
      {showImagePreview && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
          onClick={() => setShowImagePreview(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setShowImagePreview(null)}
          >
            <X size={28} />
          </button>
          <img
            src={showImagePreview}
            alt="Onizleme"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={showImagePreview}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="absolute bottom-6 right-6 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={24} />
          </a>
        </div>
      )}

      {/* ================================================================== */}
      {/* NEW GROUP MODAL */}
      {/* ================================================================== */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowNewGroupModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col modal-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">Yeni Grup Olustur</h3>
              <button
                onClick={() => setShowNewGroupModal(false)}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grup Adi *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Grup adi girin"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aciklama</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Grup aciklamasi (istege bagli)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Katilimcilar ({newGroupMembers.length} secildi)
                </label>
                <input
                  type="text"
                  value={userSearchText}
                  onChange={(e) => setUserSearchText(e.target.value)}
                  placeholder="Kullanici ara..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 mb-2"
                />
                {/* Selected members chips */}
                {newGroupMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newGroupMembers.map(uid => {
                      const user = allUsers.find(u => u.id === uid)
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                        >
                          {user?.full_name || uid}
                          <button onClick={() => setNewGroupMembers(prev => prev.filter(id => id !== uid))}>
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {allUsers
                    .filter(u => !userSearchText || u.full_name.toLowerCase().includes(userSearchText.toLowerCase()))
                    .map(user => {
                      const isSelected = newGroupMembers.includes(user.id)
                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            setNewGroupMembers(prev =>
                              isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                            )
                          }}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <Avatar src={user.avatar_url} name={user.full_name} size={32} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{user.full_name}</div>
                            <div className="text-xs text-gray-500">{user.role_name || 'Çalışan'}</div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowNewGroupModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={createGroupRoom}
                disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Grup Olustur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* NEW DM MODAL */}
      {/* ================================================================== */}
      {showNewDMModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowNewDMModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col modal-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">Yeni Mesaj</h3>
              <button
                onClick={() => setShowNewDMModal(false)}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
            <div className="px-6 py-3">
              <input
                type="text"
                value={userSearchText}
                onChange={(e) => setUserSearchText(e.target.value)}
                placeholder="Kisi ara..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              {allUsers
                .filter(u => !userSearchText || u.full_name.toLowerCase().includes(userSearchText.toLowerCase()))
                .map(user => (
                  <div
                    key={user.id}
                    onClick={() => createDirectMessage(user.id)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Avatar
                      src={user.avatar_url}
                      name={user.full_name}
                      size={40}
                      online={isUserOnline(user.id)}
                      showStatus={true}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.role_name || 'Çalışan'}</div>
                    </div>
                  </div>
                ))}
              {allUsers.length === 0 && (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  Kullanici bulunamadi
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

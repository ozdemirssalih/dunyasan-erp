'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  ChatRoom,
  ChatRoomRow,
  ChatMessage,
  ChatMessageRow,
  ChatParticipant,
  ChatParticipantRow,
  ProfileRow,
  UserPresence,
  UserPresenceRow,
  PresenceStatus,
  ReactionGroup,
  TypingIndicatorPayload,
  SendMessagePayload,
  CreateRoomPayload,
  UpdateRoomPayload,
  EditMessagePayload,
  UseChatRoomsReturn,
  UseChatMessagesReturn,
  UsePresenceReturn,
  UseTypingIndicatorReturn,
} from './types'

// ============================================================
// Constants
// ============================================================

const MESSAGES_PER_PAGE = 50
const TYPING_TIMEOUT_MS = 3000
const PRESENCE_HEARTBEAT_MS = 30_000

// ============================================================
// Helper: enrich a raw message row into a ChatMessage
// ============================================================

// Profile cache to avoid repeated queries
const profileCache = new Map<string, ProfileRow>()

async function getProfile(userId: string): Promise<ProfileRow | null> {
  if (profileCache.has(userId)) return profileCache.get(userId)!
  const { data } = await supabase
    .from('profiles')
    .select('id, company_id, full_name, role, avatar_url, phone, email')
    .eq('id', userId)
    .single()
  if (data) profileCache.set(userId, data)
  return data ?? null
}

async function enrichMessage(
  msg: ChatMessageRow,
  currentUserId: string
): Promise<ChatMessage> {
  // Fetch sender from cache
  const sender = await getProfile(msg.sender_id)

  // Fetch reply-to message + its sender if applicable
  let reply_to_message: ChatMessageRow | null = null
  let reply_to_sender: ProfileRow | null = null
  if (msg.reply_to) {
    const { data: replyMsg } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', msg.reply_to)
      .single()
    if (replyMsg) {
      reply_to_message = replyMsg
      reply_to_sender = await getProfile(replyMsg.sender_id)
    }
  }

  return {
    ...msg,
    sender: sender ?? null,
    reply_to_message,
    reply_to_sender,
    reactions: [],
    read_by: [],
    read_count: 0,
  }
}

// Fast batch enrich: 3 parallel queries instead of sequential
async function enrichMessages(
  msgs: ChatMessageRow[],
  currentUserId: string
): Promise<ChatMessage[]> {
  if (msgs.length === 0) return []

  const msgIds = msgs.map(m => m.id)
  const senderIds = Array.from(new Set(msgs.map(m => m.sender_id)))
  const replyIds = msgs.filter(m => m.reply_to).map(m => m.reply_to!)

  // ALL queries in parallel - this is the key optimization
  const [profilesRes, reactionsRes, readsRes, repliesRes] = await Promise.all([
    supabase.from('profiles').select('id, company_id, full_name, role, avatar_url, phone, email').in('id', senderIds),
    supabase.from('chat_message_reactions').select('message_id, emoji, user_id').in('message_id', msgIds),
    supabase.from('chat_message_reads').select('message_id, user_id').in('message_id', msgIds),
    replyIds.length ? supabase.from('chat_messages').select('*').in('id', replyIds) : Promise.resolve({ data: [] })
  ])

  // Cache profiles
  for (const p of profilesRes.data ?? []) profileCache.set(p.id, p)

  // Build reaction map
  const reactionsByMsg = new Map<string, Array<{emoji: string, user_id: string}>>()
  for (const r of reactionsRes.data ?? []) {
    if (!reactionsByMsg.has(r.message_id)) reactionsByMsg.set(r.message_id, [])
    reactionsByMsg.get(r.message_id)!.push(r)
  }

  // Build reads map
  const readsByMsg = new Map<string, string[]>()
  for (const r of readsRes.data ?? []) {
    if (!readsByMsg.has(r.message_id)) readsByMsg.set(r.message_id, [])
    readsByMsg.get(r.message_id)!.push(r.user_id)
  }

  // Reply map
  const replyMap = new Map(((repliesRes as any).data ?? []).map((m: any) => [m.id, m]))

  return msgs.map(msg => {
    const sender = profileCache.get(msg.sender_id) ?? null
    const msgReactions = reactionsByMsg.get(msg.id) ?? []
    const reactionMap = new Map<string, string[]>()
    for (const r of msgReactions) {
      if (!reactionMap.has(r.emoji)) reactionMap.set(r.emoji, [])
      reactionMap.get(r.emoji)!.push(r.user_id)
    }
    const reactions: ReactionGroup[] = Array.from(reactionMap).map(([emoji, uids]) => ({
      emoji,
      count: uids.length,
      users: uids.map(uid => { const p = profileCache.get(uid); return p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null }).filter(Boolean) as Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>[],
      reacted_by_me: uids.includes(currentUserId),
    }))

    let reply_to_message: ChatMessageRow | null = null
    let reply_to_sender: ProfileRow | null = null
    if (msg.reply_to && replyMap.has(msg.reply_to)) {
      reply_to_message = replyMap.get(msg.reply_to)! as ChatMessageRow
      reply_to_sender = profileCache.get(reply_to_message.sender_id) ?? null
    }

    const readUids = readsByMsg.get(msg.id) ?? []

    return {
      ...msg,
      sender,
      reply_to_message,
      reply_to_sender,
      reactions,
      read_by: readUids.map(uid => { const p = profileCache.get(uid); return p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null }).filter(Boolean) as Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>[],
      read_count: readUids.length,
    }
  })
}

// ============================================================
// useChatRooms
// ============================================================

export function useChatRooms(
  companyId: string | null,
  userId: string | null
): UseChatRoomsReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ---- fetch all rooms for the user ----
  const fetchRooms = useCallback(async () => {
    if (!companyId || !userId) return
    try {
      setLoading(true)
      setError(null)

      // Get rooms where user is a participant
      const { data: participantRows, error: partErr } = await supabase
        .from('chat_participants')
        .select('room_id, role, joined_at, last_read_at, is_muted, is_pinned, notification_setting')
        .eq('user_id', userId)

      if (partErr) throw partErr
      if (!participantRows || participantRows.length === 0) {
        setRooms([])
        return
      }

      const roomIds = participantRows.map((p) => p.room_id)

      // Fetch room rows
      const { data: roomRows, error: roomErr } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .eq('company_id', companyId)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (roomErr) throw roomErr

      // Build enriched rooms
      const enrichedRooms: ChatRoom[] = await Promise.all(
        (roomRows ?? []).map(async (room: ChatRoomRow) => {
          const myPart = participantRows.find((p) => p.room_id === room.id) ?? null

          // Participants with profiles
          const { data: parts } = await supabase
            .from('chat_participants')
            .select('*')
            .eq('room_id', room.id)

          const partUserIds = (parts ?? []).map((p: ChatParticipantRow) => p.user_id)
          const { data: profiles } = partUserIds.length
            ? await supabase.from('profiles').select('*').in('id', partUserIds)
            : { data: [] }

          const { data: presences } = partUserIds.length
            ? await supabase.from('user_presence').select('*').in('user_id', partUserIds)
            : { data: [] }

          const profileMap = new Map((profiles ?? []).map((p: ProfileRow) => [p.id, p]))
          const presenceMap = new Map((presences ?? []).map((p: UserPresenceRow) => [p.user_id, p]))

          const participants: ChatParticipant[] = (parts ?? []).map((p: ChatParticipantRow) => ({
            ...p,
            profile: profileMap.get(p.user_id) as ProfileRow,
            presence: presenceMap.get(p.user_id),
          }))

          const onlineCount = (presences ?? []).filter(
            (p: UserPresenceRow) => p.status === 'online'
          ).length

          // Last message
          const { data: lastMsgRows } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)

          let lastMessage: ChatMessage | null = null
          if (lastMsgRows && lastMsgRows.length > 0) {
            lastMessage = await enrichMessage(lastMsgRows[0], userId)
          }

          // Unread count
          const lastReadAt = myPart?.last_read_at ?? '1970-01-01T00:00:00Z'
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .neq('sender_id', userId)
            .gt('created_at', lastReadAt)

          // For direct rooms, resolve the other user
          let otherUser: (ProfileRow & { presence?: UserPresenceRow }) | undefined
          if (room.type === 'direct') {
            const otherPart = participants.find((p) => p.user_id !== userId)
            if (otherPart) {
              otherUser = {
                ...otherPart.profile,
                presence: otherPart.presence,
              }
            }
          }

          return {
            ...room,
            last_message: lastMessage,
            participants,
            participant_count: participants.length,
            unread_count: unreadCount ?? 0,
            online_count: onlineCount,
            other_user: otherUser,
            my_participation: myPart as ChatParticipantRow | null,
          }
        })
      )

      setRooms(enrichedRooms)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Odalar yüklenirken hata olustu'
      setError(message)
      console.error('useChatRooms fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, userId])

  // ---- realtime subscription ----
  useEffect(() => {
    if (!companyId || !userId) return

    fetchRooms()

    // Subscribe to chat_rooms and chat_messages changes for the company
    const channel = supabase
      .channel(`chat-rooms:${companyId}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms', filter: `company_id=eq.${companyId}` },
        () => {
          fetchRooms()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          // Re-fetch to update last_message and unread counts
          fetchRooms()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${userId}` },
        () => {
          fetchRooms()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [companyId, userId, fetchRooms])

  // ---- actions ----
  const createRoom = useCallback(
    async (payload: CreateRoomPayload): Promise<ChatRoom | null> => {
      try {
        const { data: room, error: roomErr } = await supabase
          .from('chat_rooms')
          .insert({
            company_id: payload.company_id,
            name: payload.name ?? null,
            description: payload.description ?? null,
            type: payload.type,
            avatar_url: payload.avatar_url ?? null,
            created_by: payload.created_by,
          })
          .select()
          .single()

        if (roomErr) throw roomErr

        // Add creator as admin
        const participantInserts = [
          { room_id: room.id, user_id: payload.created_by, role: 'admin' as const },
          ...payload.participant_ids
            .filter((id) => id !== payload.created_by)
            .map((id) => ({ room_id: room.id, user_id: id, role: 'member' as const })),
        ]

        await supabase.from('chat_participants').insert(participantInserts)

        await fetchRooms()
        return rooms.find((r) => r.id === room.id) ?? null
      } catch (err) {
        console.error('createRoom error:', err)
        return null
      }
    },
    [fetchRooms, rooms]
  )

  const updateRoom = useCallback(
    async (roomId: string, payload: UpdateRoomPayload) => {
      await supabase.from('chat_rooms').update(payload).eq('id', roomId)
    },
    []
  )

  const archiveRoom = useCallback(
    async (roomId: string) => {
      await supabase.from('chat_rooms').update({ is_archived: true }).eq('id', roomId)
    },
    []
  )

  const leaveRoom = useCallback(
    async (roomId: string) => {
      if (!userId) return
      await supabase
        .from('chat_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId)
      await fetchRooms()
    },
    [userId, fetchRooms]
  )

  const markAsRead = useCallback(
    async (roomId: string) => {
      if (!userId) return
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)

      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId ? { ...r, unread_count: 0 } : r
        )
      )
    },
    [userId]
  )

  const pinRoom = useCallback(
    async (roomId: string, pinned: boolean) => {
      if (!userId) return
      await supabase
        .from('chat_participants')
        .update({ is_pinned: pinned })
        .eq('room_id', roomId)
        .eq('user_id', userId)
    },
    [userId]
  )

  const muteRoom = useCallback(
    async (roomId: string, muted: boolean) => {
      if (!userId) return
      await supabase
        .from('chat_participants')
        .update({ is_muted: muted })
        .eq('room_id', roomId)
        .eq('user_id', userId)
    },
    [userId]
  )

  return {
    rooms,
    loading,
    error,
    refetch: fetchRooms,
    createRoom,
    updateRoom,
    archiveRoom,
    leaveRoom,
    markAsRead,
    pinRoom,
    muteRoom,
  }
}

// ============================================================
// useChatMessages
// ============================================================

export function useChatMessages(
  roomId: string | null,
  userId: string | null
): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ---- initial load ----
  const fetchMessages = useCallback(async () => {
    if (!roomId || !userId) return
    try {
      setLoading(true)
      setError(null)

      const { data: rows, error: msgErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE)

      if (msgErr) throw msgErr

      const enriched = await enrichMessages((rows ?? []).reverse(), userId)

      // Already in chat order (oldest first)
      setMessages(enriched)
      setHasMore((rows ?? []).length >= MESSAGES_PER_PAGE)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mesajlar yuklenirken hata olustu'
      setError(message)
      console.error('useChatMessages fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [roomId, userId])

  // ---- load older messages (pagination) ----
  const loadMore = useCallback(async () => {
    if (!roomId || !userId || loadingMore || !hasMore || messages.length === 0) return
    try {
      setLoadingMore(true)

      const oldestTimestamp = messages[0]?.created_at
      const { data: rows, error: msgErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE)

      if (msgErr) throw msgErr

      const enriched = await enrichMessages((rows ?? []).reverse(), userId)

      setMessages((prev) => [...enriched, ...prev])
      setHasMore((rows ?? []).length >= MESSAGES_PER_PAGE)
    } catch (err) {
      console.error('loadMore error:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [roomId, userId, loadingMore, hasMore, messages])

  // ---- realtime subscription ----
  useEffect(() => {
    if (!roomId || !userId) return

    fetchMessages()

    const channel = supabase
      .channel(`chat-messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessageRow
          const enriched = await enrichMessage(newMsg, userId)
          setMessages((prev) => [...prev, enriched])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const updated = payload.new as ChatMessageRow
          const enriched = await enrichMessage(updated, userId)
          setMessages((prev) =>
            prev.map((m) => (m.id === enriched.id ? enriched : m))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setMessages((prev) => prev.filter((m) => m.id !== deletedId))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [roomId, userId, fetchMessages])

  // ---- actions ----
  const sendMessage = useCallback(
    async (
      payload: Omit<SendMessagePayload, 'room_id' | 'sender_id'>
    ): Promise<ChatMessage | null> => {
      if (!roomId || !userId) return null
      try {
        const { data: row, error: err } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            sender_id: userId,
            message: payload.message ?? null,
            message_type: payload.message_type,
            file_url: payload.file_url ?? null,
            file_name: payload.file_name ?? null,
            file_size: payload.file_size ?? null,
            file_type: payload.file_type ?? null,
            thumbnail_url: payload.thumbnail_url ?? null,
            reply_to: payload.reply_to ?? null,
            forwarded_from: payload.forwarded_from ?? null,
            metadata: payload.metadata ?? null,
          })
          .select()
          .single()

        if (err) throw err

        // Update room's last_message_at
        await supabase
          .from('chat_rooms')
          .update({ last_message_at: row.created_at })
          .eq('id', roomId)

        return await enrichMessage(row, userId)
      } catch (err) {
        console.error('sendMessage error:', err)
        return null
      }
    },
    [roomId, userId]
  )

  const editMessage = useCallback(
    async (messageId: string, payload: EditMessagePayload) => {
      await supabase
        .from('chat_messages')
        .update({
          message: payload.message,
          is_edited: true,
          metadata: payload.metadata ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
    },
    []
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      await supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          message: null,
          file_url: null,
        })
        .eq('id', messageId)
    },
    []
  )

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return

      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from('chat_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle()

      if (existing) {
        await supabase.from('chat_message_reactions').delete().eq('id', existing.id)
      } else {
        await supabase
          .from('chat_message_reactions')
          .insert({ message_id: messageId, user_id: userId, emoji })
      }

      // Re-enrich the affected message
      const { data: msgRow } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .single()

      if (msgRow) {
        const enriched = await enrichMessage(msgRow, userId)
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? enriched : m))
        )
      }
    },
    [userId]
  )

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!userId) return

      const { data: existing } = await supabase
        .from('chat_message_reads')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        await supabase
          .from('chat_message_reads')
          .insert({ message_id: messageId, user_id: userId, read_at: new Date().toISOString() })
      }
    },
    [userId]
  )

  return {
    messages,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    markAsRead,
  }
}

// ============================================================
// usePresence
// ============================================================

export function usePresence(userId: string | null): UsePresenceReturn {
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({})
  const [myStatus, setMyStatus] = useState<PresenceStatus>('online')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---- set own presence ----
  const setStatus = useCallback(
    async (status: PresenceStatus) => {
      if (!userId) return
      setMyStatus(status)

      await supabase.from('user_presence').upsert(
        {
          user_id: userId,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    },
    [userId]
  )

  // ---- fetch a single presence ----
  const getPresence = useCallback(
    (uid: string): UserPresence | undefined => presenceMap[uid],
    [presenceMap]
  )

  const isOnline = useCallback(
    (uid: string): boolean => presenceMap[uid]?.status === 'online',
    [presenceMap]
  )

  // ---- initial setup + heartbeat + realtime ----
  useEffect(() => {
    if (!userId) return

    // Set self online
    setStatus('online')

    // Heartbeat: keep last_seen fresh
    heartbeatRef.current = setInterval(() => {
      supabase.from('user_presence').upsert(
        {
          user_id: userId,
          status: myStatus,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    }, PRESENCE_HEARTBEAT_MS)

    // Subscribe to all presence changes
    const channel = supabase
      .channel('user-presence-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        async (payload) => {
          const row = (payload.new ?? payload.old) as UserPresenceRow | undefined
          if (!row) return

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, company_id, full_name, role, avatar_url, phone, email')
            .eq('id', row.user_id)
            .single()

          if (profile) {
            setPresenceMap((prev) => ({
              ...prev,
              [row.user_id]: { ...row, profile },
            }))
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    // Set offline when page unloads
    const handleBeforeUnload = () => {
      // Use navigator.sendBeacon for reliability on unload
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${userId}`
      const body = JSON.stringify({
        status: 'offline',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      navigator.sendBeacon(
        url,
        new Blob([body], { type: 'application/json' })
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      // Mark offline on cleanup
      supabase.from('user_presence').upsert(
        {
          user_id: userId,
          status: 'offline' as PresenceStatus,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return {
    presenceMap,
    myStatus,
    setStatus,
    getPresence,
    isOnline,
  }
}

// ============================================================
// useTypingIndicator
// ============================================================

export function useTypingIndicator(
  roomId: string | null,
  userId: string | null
): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorPayload[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const profileRef = useRef<{ full_name: string; avatar_url: string | null } | null>(null)

  // Pre-fetch the user's own profile so we can broadcast it
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) profileRef.current = data
      })
  }, [userId])

  useEffect(() => {
    if (!roomId || !userId) return

    const channelName = `typing:${roomId}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as TypingIndicatorPayload
        if (data.user_id === userId) return // ignore self

        if (data.is_typing) {
          setTypingUsers((prev) => {
            const exists = prev.find((u) => u.user_id === data.user_id)
            if (exists) return prev
            return [...prev, data]
          })

          // Auto-remove after timeout (in case stop event is lost)
          setTimeout(() => {
            setTypingUsers((prev) =>
              prev.filter((u) => u.user_id !== data.user_id)
            )
          }, TYPING_TIMEOUT_MS + 1000)
        } else {
          setTypingUsers((prev) =>
            prev.filter((u) => u.user_id !== data.user_id)
          )
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (channelRef.current) {
        // Broadcast stop before leaving
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            room_id: roomId,
            user_id: userId,
            full_name: profileRef.current?.full_name ?? '',
            avatar_url: profileRef.current?.avatar_url ?? null,
            is_typing: false,
          },
        })
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setTypingUsers([])
    }
  }, [roomId, userId])

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!roomId || !userId || !channelRef.current) return

      // Debounce: only send if state actually changed
      if (typing === isTypingRef.current) {
        // If still typing, reset the auto-stop timer
        if (typing && typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false)
          }, TYPING_TIMEOUT_MS)
        }
        return
      }

      isTypingRef.current = typing

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          room_id: roomId,
          user_id: userId,
          full_name: profileRef.current?.full_name ?? '',
          avatar_url: profileRef.current?.avatar_url ?? null,
          is_typing: typing,
        } satisfies TypingIndicatorPayload,
      })

      // Auto-stop typing after timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      if (typing) {
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false)
        }, TYPING_TIMEOUT_MS)
      }
    },
    [roomId, userId]
  )

  return {
    typingUsers,
    setTyping,
  }
}

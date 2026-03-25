// lib/chat/types.ts
// Chat sistemi TypeScript tipleri

// ============================================================
// Enum / Literal Union Types
// ============================================================

export type ChatRoomType = 'direct' | 'group' | 'channel'
export type ParticipantRole = 'admin' | 'member'
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' | 'location'
export type PresenceStatus = 'online' | 'offline' | 'away'
export type NotificationSetting = 'all' | 'mentions' | 'none'

// ============================================================
// Database Row Types (mirror the DB schema exactly)
// ============================================================

export interface ChatRoomRow {
  id: string
  company_id: string
  name: string | null
  description: string | null
  type: ChatRoomType
  avatar_url: string | null
  created_by: string
  is_archived: boolean
  pinned_message_id: string | null
  created_at: string
  updated_at: string
  last_message_at: string | null
}

export interface ChatParticipantRow {
  id: string
  room_id: string
  user_id: string
  role: ParticipantRole
  joined_at: string
  last_read_at: string | null
  is_muted: boolean
  is_pinned: boolean
  notification_setting: NotificationSetting
}

export interface ChatMessageRow {
  id: string
  room_id: string
  sender_id: string
  message: string | null
  message_type: MessageType
  file_url: string | null
  file_name: string | null
  file_size: number | null
  file_type: string | null
  thumbnail_url: string | null
  reply_to: string | null
  forwarded_from: string | null
  is_edited: boolean
  is_deleted: boolean
  deleted_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ChatMessageReadRow {
  id: string
  message_id: string
  user_id: string
  read_at: string
}

export interface ChatMessageReactionRow {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface UserPresenceRow {
  user_id: string
  status: PresenceStatus
  last_seen: string | null
  current_room_id: string | null
  updated_at: string
}

export interface ProfileRow {
  id: string
  company_id: string | null
  full_name: string
  role: string
  avatar_url: string | null
  phone: string | null
  email: string | null
}

// ============================================================
// Joined / Enriched Types (used in the UI)
// ============================================================

/** A single reaction group: the emoji, count, and who reacted */
export interface ReactionGroup {
  emoji: string
  count: number
  users: Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>[]
  /** Whether the current user has reacted with this emoji */
  reacted_by_me: boolean
}

/** ChatMessage with all related data resolved */
export interface ChatMessage extends ChatMessageRow {
  sender: ProfileRow | null
  reply_to_message: ChatMessageRow | null
  reply_to_sender: ProfileRow | null
  reactions: ReactionGroup[]
  read_by: Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>[]
  read_count: number
}

/** Participant with profile info */
export interface ChatParticipant extends ChatParticipantRow {
  profile: ProfileRow
  presence?: UserPresenceRow
}

/** ChatRoom with aggregated data for the room list */
export interface ChatRoom extends ChatRoomRow {
  last_message: ChatMessage | null
  participants: ChatParticipant[]
  participant_count: number
  unread_count: number
  online_count: number
  /** For direct rooms, the other user's profile */
  other_user?: ProfileRow & { presence?: UserPresenceRow }
  /** Current user's participant record (for muted / pinned state) */
  my_participation: ChatParticipantRow | null
}

/** User presence combined with profile */
export interface UserPresence extends UserPresenceRow {
  profile: ProfileRow
}

// ============================================================
// Input / Payload Types (for creating & updating)
// ============================================================

export interface SendMessagePayload {
  room_id: string
  sender_id: string
  message?: string
  message_type: MessageType
  file_url?: string
  file_name?: string
  file_size?: number
  file_type?: string
  thumbnail_url?: string
  reply_to?: string
  forwarded_from?: string
  metadata?: Record<string, unknown>
}

export interface CreateRoomPayload {
  company_id: string
  name?: string
  description?: string
  type: ChatRoomType
  avatar_url?: string
  created_by: string
  /** User IDs to add as participants (the creator is added automatically) */
  participant_ids: string[]
}

export interface UpdateRoomPayload {
  name?: string
  description?: string
  avatar_url?: string
  is_archived?: boolean
  pinned_message_id?: string | null
}

export interface AddParticipantPayload {
  room_id: string
  user_id: string
  role?: ParticipantRole
}

export interface UpdateParticipantPayload {
  role?: ParticipantRole
  is_muted?: boolean
  is_pinned?: boolean
  notification_setting?: NotificationSetting
}

export interface EditMessagePayload {
  message: string
  metadata?: Record<string, unknown>
}

export interface ReactToMessagePayload {
  message_id: string
  user_id: string
  emoji: string
}

export interface UpdatePresencePayload {
  user_id: string
  status: PresenceStatus
  current_room_id?: string | null
}

// ============================================================
// Realtime Event Types
// ============================================================

export interface TypingIndicatorPayload {
  room_id: string
  user_id: string
  full_name: string
  avatar_url: string | null
  is_typing: boolean
}

export type RealtimeMessageEvent =
  | { type: 'INSERT'; message: ChatMessage }
  | { type: 'UPDATE'; message: ChatMessage }
  | { type: 'DELETE'; message_id: string }

export type RealtimeRoomEvent =
  | { type: 'INSERT'; room: ChatRoom }
  | { type: 'UPDATE'; room: ChatRoom }

export type RealtimePresenceEvent = {
  user_id: string
  status: PresenceStatus
  last_seen: string | null
}

// ============================================================
// Pagination & Query Helpers
// ============================================================

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface PaginatedResult<T> {
  data: T[]
  has_more: boolean
  next_cursor: string | null
  total_count?: number
}

export interface ChatRoomFilters {
  type?: ChatRoomType
  is_archived?: boolean
  search?: string
}

export interface ChatMessageFilters {
  message_type?: MessageType
  sender_id?: string
  search?: string
  before?: string
  after?: string
}

// ============================================================
// Hook Return Types
// ============================================================

export interface UseChatRoomsReturn {
  rooms: ChatRoom[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createRoom: (payload: CreateRoomPayload) => Promise<ChatRoom | null>
  updateRoom: (roomId: string, payload: UpdateRoomPayload) => Promise<void>
  archiveRoom: (roomId: string) => Promise<void>
  leaveRoom: (roomId: string) => Promise<void>
  markAsRead: (roomId: string) => Promise<void>
  pinRoom: (roomId: string, pinned: boolean) => Promise<void>
  muteRoom: (roomId: string, muted: boolean) => Promise<void>
}

export interface UseChatMessagesReturn {
  messages: ChatMessage[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  sendMessage: (payload: Omit<SendMessagePayload, 'room_id' | 'sender_id'>) => Promise<ChatMessage | null>
  editMessage: (messageId: string, payload: EditMessagePayload) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string) => Promise<void>
  markAsRead: (messageId: string) => Promise<void>
}

export interface UsePresenceReturn {
  presenceMap: Record<string, UserPresence>
  myStatus: PresenceStatus
  setStatus: (status: PresenceStatus) => Promise<void>
  getPresence: (userId: string) => UserPresence | undefined
  isOnline: (userId: string) => boolean
}

export interface UseTypingIndicatorReturn {
  typingUsers: TypingIndicatorPayload[]
  setTyping: (isTyping: boolean) => void
}

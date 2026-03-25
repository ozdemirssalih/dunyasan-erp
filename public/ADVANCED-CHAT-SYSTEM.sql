-- =============================================
-- GELİŞMİŞ CHAT SİSTEMİ v2.0
-- WhatsApp/Telegram Benzeri
-- =============================================

-- Supabase Storage bucket (chat medya dosyaları için)
-- Bu Supabase Dashboard'dan elle oluşturulmalı: "chat-files" bucket

-- 1. CHAT ROOMS (Sohbet Odaları)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id),
  is_archived BOOLEAN DEFAULT FALSE,
  pinned_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CHAT PARTICIPANTS (Katılımcılar)
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  notification_setting TEXT DEFAULT 'all' CHECK (notification_setting IN ('all', 'mentions', 'none')),
  UNIQUE(room_id, user_id)
);

-- 3. CHAT MESSAGES (Gelişmiş Mesajlar)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system', 'location')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  thumbnail_url TEXT,
  reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  forwarded_from UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MESSAGE READS (Okundu Bilgisi)
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 5. MESSAGE REACTIONS (Mesaj Reaksiyonları)
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 6. USER PRESENCE (Online/Offline Durumu)
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  current_room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- İNDEKSLER
-- =============================================
CREATE INDEX IF NOT EXISTS idx_chat_rooms_company ON chat_rooms(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply ON chat_messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON chat_messages USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON chat_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);

-- =============================================
-- TRIGGERS
-- =============================================

-- Room güncelleme zamanını otomatik ayarla
CREATE OR REPLACE FUNCTION update_chat_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_room ON chat_messages;
CREATE TRIGGER trigger_update_chat_room
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_timestamp();

-- Full-text search vector otomatik güncelle
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('turkish', COALESCE(NEW.message, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_search ON chat_messages;
CREATE TRIGGER trigger_message_search
  BEFORE INSERT OR UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_search_vector();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Chat Rooms
CREATE POLICY chat_rooms_select ON chat_rooms FOR SELECT USING (
  id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
);
CREATE POLICY chat_rooms_insert ON chat_rooms FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY chat_rooms_update ON chat_rooms FOR UPDATE USING (
  id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid() AND role = 'admin')
);

-- Chat Participants
CREATE POLICY chat_participants_select ON chat_participants FOR SELECT USING (
  room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
);
CREATE POLICY chat_participants_insert ON chat_participants FOR INSERT WITH CHECK (
  room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid() AND role = 'admin')
  OR user_id = auth.uid()
);
CREATE POLICY chat_participants_update ON chat_participants FOR UPDATE USING (
  user_id = auth.uid()
);

-- Chat Messages
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (
  room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
);
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  AND sender_id = auth.uid()
);
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE USING (
  sender_id = auth.uid()
);
CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE USING (
  sender_id = auth.uid()
);

-- Message Reads
CREATE POLICY chat_reads_select ON chat_message_reads FOR SELECT USING (
  message_id IN (
    SELECT id FROM chat_messages WHERE room_id IN (
      SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY chat_reads_insert ON chat_message_reads FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Message Reactions
CREATE POLICY chat_reactions_select ON chat_message_reactions FOR SELECT USING (
  message_id IN (
    SELECT id FROM chat_messages WHERE room_id IN (
      SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY chat_reactions_insert ON chat_message_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY chat_reactions_delete ON chat_message_reactions FOR DELETE USING (
  user_id = auth.uid()
);

-- User Presence
CREATE POLICY presence_select ON user_presence FOR SELECT USING (true);
CREATE POLICY presence_upsert ON user_presence FOR ALL USING (user_id = auth.uid());

-- =============================================
-- REALTİME YAYIN (Publication)
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;

-- =============================================
-- STORAGE POLİTİKALARI
-- =============================================
-- Supabase Dashboard'dan "chat-files" bucket oluşturun
-- Aşağıdaki politikalar bucket oluşturduktan sonra çalıştırılmalı:

-- CREATE POLICY "Chat dosyaları okuma" ON storage.objects
--   FOR SELECT USING (bucket_id = 'chat-files');

-- CREATE POLICY "Chat dosyaları yükleme" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'chat-files'
--     AND auth.uid() IS NOT NULL
--   );

-- CREATE POLICY "Chat dosyaları silme" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'chat-files'
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );

SELECT '✅ Gelişmiş Chat Sistemi v2.0 oluşturuldu!' as message;

-- =============================================
-- WHATSAPP BENZERI CHAT SİSTEMİ
-- =============================================
-- Gerçek zamanlı mesajlaşma için tablo yapıları
-- =============================================

-- 1. CHAT ROOMS (Sohbet Odaları)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT, -- Grup sohbetleri için
  type TEXT NOT NULL DEFAULT 'direct', -- 'direct' veya 'group'
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CHAT PARTICIPANTS (Katılımcılar)
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  UNIQUE(room_id, user_id)
);

-- 3. CHAT MESSAGES (Mesajlar)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'system'
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
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

-- 5. USER PRESENCE (Online/Offline Durumu)
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline', -- 'online', 'offline', 'away'
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler (Performans için)
CREATE INDEX IF NOT EXISTS idx_chat_rooms_company ON chat_rooms(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);

-- Trigger: Chat room güncelleme zamanını otomatik ayarla
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

CREATE TRIGGER trigger_update_chat_room
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_timestamp();

-- RLS (Row Level Security) Politikaları
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Kullanıcı sadece katıldığı odaları görebilir
CREATE POLICY chat_rooms_select ON chat_rooms
  FOR SELECT USING (
    id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

-- Kullanıcı sadece katıldığı odalara mesaj gönderebilir
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
    AND sender_id = auth.uid()
  );

-- Kullanıcı sadece katıldığı odaların mesajlarını görebilir
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM chat_participants WHERE user_id = auth.uid())
  );

-- Kullanıcı kendi mesajlarını güncelleyebilir/silebilir
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Herkes herkesi görebilir (presence için)
CREATE POLICY user_presence_select ON user_presence
  FOR SELECT USING (true);

-- Kullanıcı sadece kendi presence'ını güncelleyebilir
CREATE POLICY user_presence_update ON user_presence
  FOR ALL USING (user_id = auth.uid());

-- Başarı mesajı
SELECT '✅ WhatsApp benzeri chat sistemi oluşturuldu!' as message;

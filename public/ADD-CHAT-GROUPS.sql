-- Chat grupları için profiles tablosuna grup field'ı ekle
-- Gruplar: ÜRETIM, YÖNETİM, SİSTEM, SATINALMA

-- 1. Profiles tablosuna chat_group kolonu ekle
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS chat_group VARCHAR(50);

-- 2. Chat grupları için enum benzeri constraint (opsiyonel)
-- Sadece belirli değerleri kabul et
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS chat_group_check;

ALTER TABLE profiles
ADD CONSTRAINT chat_group_check
CHECK (chat_group IN ('ÜRETIM', 'YÖNETİM', 'SİSTEM', 'SATINALMA') OR chat_group IS NULL);

-- 3. Mesaj tablosuna grup field'ı ekle
ALTER TABLE company_chat_messages
ADD COLUMN IF NOT EXISTS chat_group VARCHAR(50);

-- 4. Index ekle
CREATE INDEX IF NOT EXISTS idx_profiles_chat_group ON profiles(chat_group);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON company_chat_messages(chat_group);

-- 5. RLS politikalarını güncelle - kullanıcılar sadece kendi gruplarının mesajlarını görebilir
DROP POLICY IF EXISTS "Users can view their company's chat messages" ON company_chat_messages;

CREATE POLICY "Users can view their group's chat messages"
  ON company_chat_messages
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      -- Kendi grubunun mesajlarını görebilir
      chat_group IN (
        SELECT chat_group FROM profiles WHERE id = auth.uid()
      )
      -- Veya grup atanmamış mesajları görebilir (genel chat)
      OR chat_group IS NULL
    )
  );

-- Mesaj gönderme politikasını güncelle
DROP POLICY IF EXISTS "Users can send messages to their company chat" ON company_chat_messages;

CREATE POLICY "Users can send messages to their group chat"
  ON company_chat_messages
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND sender_id = auth.uid()
    AND (
      -- Sadece kendi grubuna mesaj gönderebilir
      chat_group IN (
        SELECT chat_group FROM profiles WHERE id = auth.uid()
      )
      -- Veya genel chat'e gönderebilir
      OR chat_group IS NULL
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Chat grupları eklendi!';
    RAISE NOTICE '';
    RAISE NOTICE '👥 Gruplar:';
    RAISE NOTICE '   - ÜRETIM';
    RAISE NOTICE '   - YÖNETİM';
    RAISE NOTICE '   - SİSTEM';
    RAISE NOTICE '   - SATINALMA';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Kullanıcılara grup atamak için:';
    RAISE NOTICE '   Settings > Kullanıcı Yönetimi';
END $$;

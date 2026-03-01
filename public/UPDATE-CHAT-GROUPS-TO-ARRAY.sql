-- Chat gruplarını tek değerden array'e çevir
-- Böylece bir kullanıcı birden fazla gruba atanabilir

-- 1. ÖNCE RLS politikalarını kaldır (çünkü eski kolonu kullanıyorlar)
DROP POLICY IF EXISTS "Users can view their group's chat messages" ON company_chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their group chat" ON company_chat_messages;

-- 2. Constraint'i kaldır
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS chat_group_check;

-- 3. Mevcut chat_group kolonunu yedekle ve array'e çevir
ALTER TABLE profiles
RENAME COLUMN chat_group TO chat_group_old;

-- 4. Yeni array kolonu ekle
ALTER TABLE profiles
ADD COLUMN chat_group TEXT[];

-- 5. Eski değerleri array'e dönüştür
UPDATE profiles
SET chat_group = ARRAY[chat_group_old]::TEXT[]
WHERE chat_group_old IS NOT NULL;

-- 6. Eski kolonu sil
ALTER TABLE profiles
DROP COLUMN chat_group_old;

-- Chat mesajları tablosunu güncelle (bu tek kalacak çünkü mesaj bir gruba ait)
-- chat_group kolonu VARCHAR olarak kalacak

-- RLS politikalarını array için güncelle
DROP POLICY IF EXISTS "Users can view their group's chat messages" ON company_chat_messages;

CREATE POLICY "Users can view their group's chat messages"
  ON company_chat_messages
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      -- Kullanıcının gruplarından herhangi biri mesajın grubuna eşitse görebilir
      chat_group = ANY (
        SELECT unnest(chat_group) FROM profiles WHERE id = auth.uid()
      )
      -- Veya Genel Chat mesajlarını herkes görebilir (chat_group = NULL)
      OR chat_group IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their group chat" ON company_chat_messages;

CREATE POLICY "Users can send messages to their group chat"
  ON company_chat_messages
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND sender_id = auth.uid()
    AND (
      -- Kullanıcının gruplarından birine mesaj gönderebilir
      chat_group = ANY (
        SELECT unnest(chat_group) FROM profiles WHERE id = auth.uid()
      )
      -- Veya Genel Chat'e herkes mesaj gönderebilir (chat_group = NULL)
      OR chat_group IS NULL
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Chat grupları array formatına dönüştürüldü!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Artık bir kullanıcı birden fazla gruba atanabilir:';
    RAISE NOTICE '   - Örnek: ["ÜRETIM", "YÖNETİM"]';
    RAISE NOTICE '   - Kullanıcı tüm atandığı grupların mesajlarını görebilir';
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  RLS politikaları güncellendi!';
END $$;

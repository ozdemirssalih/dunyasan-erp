-- Chat sistemine "Genel Chat" kanalı ekle
-- chat_group = NULL mesajlar herkese açık genel sohbet olacak

-- RLS politikalarını güncelle
DROP POLICY IF EXISTS "Users can view their group's chat messages" ON company_chat_messages;

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
      -- Genel Chat mesajlarını herkes görebilir (chat_group = NULL)
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
      -- Kendi grubuna mesaj gönderebilir
      chat_group IN (
        SELECT chat_group FROM profiles WHERE id = auth.uid()
      )
      -- Genel Chat'e herkes mesaj gönderebilir (chat_group = NULL)
      OR chat_group IS NULL
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Genel Chat kanalı eklendi!';
    RAISE NOTICE '';
    RAISE NOTICE '💬 Artık:';
    RAISE NOTICE '   - chat_group = NULL → Genel Chat (herkes görebilir)';
    RAISE NOTICE '   - chat_group = ÜRETIM → Sadece ÜRETIM grubu';
    RAISE NOTICE '   - chat_group = YÖNETİM → Sadece YÖNETİM grubu';
    RAISE NOTICE '   - chat_group = SİSTEM → Sadece SİSTEM grubu';
    RAISE NOTICE '   - chat_group = SATINALMA → Sadece SATINALMA grubu';
END $$;

-- Şirket içi chat mesajları tablosu
-- Gerçek zamanlı mesajlaşma için Supabase Realtime kullanılacak

CREATE TABLE IF NOT EXISTS company_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_chat_messages_company ON company_chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON company_chat_messages(created_at DESC);

-- RLS (Row Level Security) politikaları
ALTER TABLE company_chat_messages ENABLE ROW LEVEL SECURITY;

-- Şirket çalışanları kendi şirketlerinin mesajlarını görebilir
CREATE POLICY "Users can view their company's chat messages"
  ON company_chat_messages
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerine mesaj gönderebilir
CREATE POLICY "Users can send messages to their company chat"
  ON company_chat_messages
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

-- Kullanıcılar kendi mesajlarını silebilir
CREATE POLICY "Users can delete their own messages"
  ON company_chat_messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- Realtime için tabloya publication ekle
ALTER PUBLICATION supabase_realtime ADD TABLE company_chat_messages;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Şirket chat mesajları tablosu oluşturuldu!';
    RAISE NOTICE '';
    RAISE NOTICE '💬 Tablo: company_chat_messages';
    RAISE NOTICE '   - Şirket içi gerçek zamanlı mesajlaşma';
    RAISE NOTICE '   - Supabase Realtime aktif';
    RAISE NOTICE '   - RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '🔔 Realtime subscription için:';
    RAISE NOTICE '   supabase.channel("company-chat").on("postgres_changes", ...)';
END $$;

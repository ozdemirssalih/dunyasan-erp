-- =============================================
-- DUE_DATE KOLONUNU NULLABLE YAP
-- =============================================
-- Vade sistemini kaldırdık, due_date artık opsiyonel olmalı
-- =============================================

-- current_account_transactions tablosunda due_date'i nullable yap
ALTER TABLE current_account_transactions
ALTER COLUMN due_date DROP NOT NULL;

-- Başarı mesajı
SELECT '✅ due_date kolonu artık nullable (opsiyonel)!' as message;

-- Kontrol: Tablo yapısını göster
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'current_account_transactions'
    AND column_name = 'due_date';

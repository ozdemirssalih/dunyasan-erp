-- Satınalma takip tablosuna para birimi kolonu ekle
ALTER TABLE purchasing_tracking ADD COLUMN IF NOT EXISTS para_birimi VARCHAR(10) DEFAULT 'TRY';
SELECT 'para_birimi kolonu eklendi!' as mesaj;

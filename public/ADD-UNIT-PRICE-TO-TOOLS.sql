-- ============================================================
-- TOOLS TABLOSUNA UNIT_PRICE KOLONU EKLEME
-- Dünyasan ERP | 2026
-- ============================================================

-- Birim fiyat kolonu ekle
ALTER TABLE tools ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0;

-- Yorum ekle
COMMENT ON COLUMN tools.unit_price IS 'Takım birim fiyatı (Stok & Hammadde sayfasından girilir)';

-- ============================================================
-- TAMAMLANDI
-- ============================================================

-- ============================================================
-- TAKIMHANE TABLOSU GÜNCELLEMESİ
-- Dünyasan ERP | 2026
-- ============================================================

-- Tedarikçi kolonu ekle (brand yerine supplier_id)
ALTER TABLE tools ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- unit_price kolonunu kaldır (artık kullanılmayacak)
ALTER TABLE tools DROP COLUMN IF EXISTS unit_price;

-- İndeks
CREATE INDEX IF NOT EXISTS idx_tools_supplier ON tools(supplier_id);

-- ============================================================
-- TAMAMLANDI
-- ============================================================

-- warehouse_items tablosuna supplier_id kolonu ekle

-- Önce kolon var mı kontrol et, yoksa ekle
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier ON warehouse_items(supplier_id);

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ warehouse_items tablosuna supplier_id kolonu eklendi!';
    RAISE NOTICE '   - supplier_id: UUID (suppliers tablosuna referans)';
    RAISE NOTICE '   - Index eklendi: idx_warehouse_items_supplier';
END $$;

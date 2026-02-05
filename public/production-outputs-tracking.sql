-- DÜNYASAN ERP - Üretim Çıktıları Transfer Takibi
-- Üretim kayıtlarının nereye gönderildiğini izle

-- =====================================================
-- ADIM 1: production_outputs Tablosunu Güncelle
-- =====================================================

-- Transfer durumu kolonu ekle
ALTER TABLE production_outputs
ADD COLUMN IF NOT EXISTS transfer_status TEXT DEFAULT 'pending'
CHECK (transfer_status IN ('pending', 'sent_to_qc', 'sent_to_warehouse'));

-- Transfer referansı kolonu ekle (hangi transfer kaydı ile gönderildi)
ALTER TABLE production_outputs
ADD COLUMN IF NOT EXISTS qc_transfer_id UUID REFERENCES production_to_qc_transfers(id);

ALTER TABLE production_outputs
ADD COLUMN IF NOT EXISTS warehouse_transfer_id UUID REFERENCES production_to_warehouse_transfers(id);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_production_outputs_transfer_status ON production_outputs(transfer_status);

-- =====================================================
-- Mevcut Kayıtları Güncelle
-- =====================================================

-- Mevcut tüm kayıtları 'pending' yap
UPDATE production_outputs
SET transfer_status = 'pending'
WHERE transfer_status IS NULL;

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ÜRETIM ÇIKTILARI TAKİP SİSTEMİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 production_outputs Güncellemeler:';
    RAISE NOTICE '   - transfer_status kolonu eklendi';
    RAISE NOTICE '   - qc_transfer_id referansı eklendi';
    RAISE NOTICE '   - warehouse_transfer_id referansı eklendi';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Durumlar:';
    RAISE NOTICE '   - pending: Bekliyor (gönderilebilir)';
    RAISE NOTICE '   - sent_to_qc: Kalite kontrole gönderildi';
    RAISE NOTICE '   - sent_to_warehouse: Ana depoya gönderildi';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Artık her üretim kaydı takip edilebilir!';
    RAISE NOTICE '';
END $$;

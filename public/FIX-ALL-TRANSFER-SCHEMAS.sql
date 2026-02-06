-- =====================================================
-- DÜNYASAN ERP - TÜM TRANSFER TABLOLARININ ŞEMASINI DÜZELT
-- =====================================================
-- Eksik approved_by, approved_at kolonlarını ekle
-- Tüm transfer tablolarını standart hale getir
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 TÜM TRANSFER TABLOLARI GÜNCELENİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 1. production_material_requests
-- =====================================================
ALTER TABLE production_material_requests
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ 1/4 - production_material_requests güncellendi';
END $$;

-- =====================================================
-- 2. production_to_warehouse_transfers
-- =====================================================
ALTER TABLE production_to_warehouse_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ 2/4 - production_to_warehouse_transfers güncellendi';
END $$;

-- =====================================================
-- 3. production_to_qc_transfers
-- =====================================================
-- Kalite kontrol için reviewed_by kullanılıyor, ama tutarlılık için approved_by de ekleyelim
ALTER TABLE production_to_qc_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ 3/4 - production_to_qc_transfers güncellendi';
END $$;

-- =====================================================
-- 4. qc_to_warehouse_transfers
-- =====================================================
ALTER TABLE qc_to_warehouse_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ 4/4 - qc_to_warehouse_transfers güncellendi';
END $$;

-- =====================================================
-- RLS POLİTİKALARI - TÜM TABLOLAR İÇİN
-- =====================================================

-- production_material_requests
DROP POLICY IF EXISTS "production_material_requests_all" ON production_material_requests;
CREATE POLICY "production_material_requests_all" ON production_material_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- production_to_warehouse_transfers
DROP POLICY IF EXISTS "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers;
CREATE POLICY "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- production_to_qc_transfers
DROP POLICY IF EXISTS "production_to_qc_transfers_all" ON production_to_qc_transfers;
CREATE POLICY "production_to_qc_transfers_all" ON production_to_qc_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- qc_to_warehouse_transfers
DROP POLICY IF EXISTS "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers;
CREATE POLICY "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm RLS politikaları güncellendi';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- SONUÇ VE KONTROL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM TRANSFER TABLOLARI GÜNCELLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Her tabloya eklenen kolonlar:';
    RAISE NOTICE '   • approved_by (UUID → profiles)';
    RAISE NOTICE '   • approved_at (TIMESTAMP)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Güncellenen Tablolar:';
    RAISE NOTICE '   1. production_material_requests';
    RAISE NOTICE '   2. production_to_warehouse_transfers';
    RAISE NOTICE '   3. production_to_qc_transfers';
    RAISE NOTICE '   4. qc_to_warehouse_transfers';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık tüm onay işlemleri çalışacak!';
    RAISE NOTICE '========================================';
END $$;

-- Tüm transfer tablolarının şemalarını göster
DO $$
DECLARE
    tbl TEXT;
    col RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 TABLO ŞEMALARI:';
    RAISE NOTICE '';

    FOR tbl IN
        SELECT unnest(ARRAY[
            'production_material_requests',
            'production_to_warehouse_transfers',
            'production_to_qc_transfers',
            'qc_to_warehouse_transfers'
        ])
    LOOP
        RAISE NOTICE '--- % ---', tbl;
        FOR col IN
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = tbl
              AND column_name IN ('approved_by', 'approved_at', 'reviewed_by', 'reviewed_at')
            ORDER BY column_name
        LOOP
            RAISE NOTICE '  • % (%)', col.column_name, col.data_type;
        END LOOP;
        RAISE NOTICE '';
    END LOOP;
END $$;

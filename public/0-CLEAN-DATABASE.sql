-- =====================================================
-- ADIM 0: VERİTABANINI TEMİZLE
-- =====================================================
-- Önce bunu çalıştır, sonra kuruluma geç
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🧹 VERİTABANI TEMİZLENİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 1. TÜM TRIGGER'LARI SİL
-- =====================================================
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN
        SELECT DISTINCT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND event_object_table IN (
              'production_material_requests',
              'production_to_warehouse_transfers',
              'production_to_qc_transfers',
              'qc_to_warehouse_transfers',
              'production_to_machine_transfers',
              'production_scrap_records',
              'production_outputs',
              'production_inventory',
              'machine_inventory',
              'warehouse_transactions'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', trigger_rec.trigger_name, trigger_rec.event_object_table);
        RAISE NOTICE '   Silindi: % ON %', trigger_rec.trigger_name, trigger_rec.event_object_table;
    END LOOP;

    RAISE NOTICE '✅ 1/3 - Tüm trigger''lar silindi';
END $$;

-- =====================================================
-- 2. TÜM FONKSIYONLARI SİL
-- =====================================================
DROP FUNCTION IF EXISTS approve_material_request_to_production() CASCADE;
DROP FUNCTION IF EXISTS approve_production_to_warehouse_transfer() CASCADE;
DROP FUNCTION IF EXISTS approve_production_to_qc_transfer() CASCADE;
DROP FUNCTION IF EXISTS approve_qc_to_warehouse_transfer() CASCADE;
DROP FUNCTION IF EXISTS transfer_production_to_machine() CASCADE;
DROP FUNCTION IF EXISTS record_production_scrap() CASCADE;
DROP FUNCTION IF EXISTS add_production_output_to_inventory() CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ 2/3 - Tüm fonksiyonlar silindi';
END $$;

-- =====================================================
-- 3. GEREKSİZ TABLOLARI SİL
-- =====================================================
-- SADECE gereksiz/test tabloları sil, ana tabloları koruyoruz
DO $$
BEGIN
    -- Test tabloları varsa sil (genelde yoktur ama kontrol)
    DROP TABLE IF EXISTS test_production_inventory CASCADE;
    DROP TABLE IF EXISTS temp_production_inventory CASCADE;

    RAISE NOTICE '✅ 3/3 - Gereksiz tablolar temizlendi';
END $$;

-- =====================================================
-- 4. TÜM VERİLERİ SİL (TABLOLARI KORUYARAK)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Tüm veriler siliniyor (tablolar korunuyor)...';
    RAISE NOTICE '';

    -- Foreign key sırasına göre
    DELETE FROM production_outputs;
    RAISE NOTICE '   ✓ production_outputs';

    DELETE FROM production_scrap_records WHERE TRUE;
    RAISE NOTICE '   ✓ production_scrap_records';

    DELETE FROM production_to_machine_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ production_to_machine_transfers';

    DELETE FROM machine_inventory WHERE TRUE;
    RAISE NOTICE '   ✓ machine_inventory';

    DELETE FROM qc_to_warehouse_transfers;
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers';

    DELETE FROM production_to_qc_transfers;
    RAISE NOTICE '   ✓ production_to_qc_transfers';

    DELETE FROM production_to_warehouse_transfers;
    RAISE NOTICE '   ✓ production_to_warehouse_transfers';

    DELETE FROM production_material_requests;
    RAISE NOTICE '   ✓ production_material_requests';

    DELETE FROM production_material_assignments;
    RAISE NOTICE '   ✓ production_material_assignments';

    DELETE FROM quality_control_inventory;
    RAISE NOTICE '   ✓ quality_control_inventory';

    DELETE FROM production_inventory;
    RAISE NOTICE '   ✓ production_inventory';

    DELETE FROM warehouse_transactions;
    RAISE NOTICE '   ✓ warehouse_transactions';

    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '   ✓ warehouse_items (stoklar sıfırlandı)';

    RAISE NOTICE '';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ VERİTABANI TEMİZLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'ŞİMDİ 1-COMPLETE-SETUP.sql DOSYASINI ÇALIŞTIR';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

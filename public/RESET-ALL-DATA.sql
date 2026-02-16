-- =====================================================
-- TÜM VERİLERİ SIFIRLA (PROJELER DAHİL)
-- =====================================================
-- UYARI: Bu işlem geri alınamaz!
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🧹 TÜM VERİLER SİLİNİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  UYARI: Bu işlem geri alınamaz!';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- VERİLERİ SİL (Foreign key sırasına göre)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '🗑️  Veriler siliniyor...';
    RAISE NOTICE '';

    -- Günlük üretim kayıtları
    DELETE FROM machine_daily_production WHERE TRUE;
    RAISE NOTICE '   ✓ machine_daily_production';

    -- Kalite kontrol
    DELETE FROM warehouse_qc_requests WHERE TRUE;
    RAISE NOTICE '   ✓ warehouse_qc_requests';

    DELETE FROM qc_to_warehouse_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers';

    DELETE FROM production_to_qc_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ production_to_qc_transfers';

    DELETE FROM quality_control_inventory WHERE TRUE;
    RAISE NOTICE '   ✓ quality_control_inventory';

    -- Üretim
    DELETE FROM production_outputs WHERE TRUE;
    RAISE NOTICE '   ✓ production_outputs';

    DELETE FROM production_scrap_records WHERE TRUE;
    RAISE NOTICE '   ✓ production_scrap_records';

    DELETE FROM production_to_machine_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ production_to_machine_transfers';

    DELETE FROM production_to_warehouse_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ production_to_warehouse_transfers';

    DELETE FROM production_material_requests WHERE TRUE;
    RAISE NOTICE '   ✓ production_material_requests';

    DELETE FROM production_material_assignments WHERE TRUE;
    RAISE NOTICE '   ✓ production_material_assignments';

    DELETE FROM production_inventory WHERE TRUE;
    RAISE NOTICE '   ✓ production_inventory';

    DELETE FROM machine_inventory WHERE TRUE;
    RAISE NOTICE '   ✓ machine_inventory';

    -- Depo
    DELETE FROM warehouse_transactions WHERE TRUE;
    RAISE NOTICE '   ✓ warehouse_transactions';

    DELETE FROM material_transfers WHERE TRUE;
    RAISE NOTICE '   ✓ material_transfers';

    -- Proje bağımlı veriler
    DELETE FROM project_machines WHERE TRUE;
    RAISE NOTICE '   ✓ project_machines';

    -- Ana veriler
    DELETE FROM projects WHERE TRUE;
    RAISE NOTICE '   ✓ projects';

    DELETE FROM machines WHERE TRUE;
    RAISE NOTICE '   ✓ machines';

    DELETE FROM employees WHERE TRUE;
    RAISE NOTICE '   ✓ employees';

    DELETE FROM customer_companies WHERE TRUE;
    RAISE NOTICE '   ✓ customer_companies';

    DELETE FROM suppliers WHERE TRUE;
    RAISE NOTICE '   ✓ suppliers';

    -- Depo ürünleri (stokları sıfırla ama ürünleri silme)
    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW() WHERE TRUE;
    RAISE NOTICE '   ✓ warehouse_items (stoklar sıfırlandı)';

    -- Kategoriler silinmez, sadece stoklar sıfırlanır
    RAISE NOTICE '';
    RAISE NOTICE '📦 Depo kategorileri korundu';
    RAISE NOTICE '👤 Kullanıcılar ve roller korundu';
    RAISE NOTICE '🏢 Şirket bilgileri korundu';

END $$;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM VERİLER SİLİNDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Silinen veriler:';
    RAISE NOTICE '  • Projeler ve proje-tezgah ilişkileri';
    RAISE NOTICE '  • Tezgahlar';
    RAISE NOTICE '  • Personeller';
    RAISE NOTICE '  • Günlük üretim kayıtları';
    RAISE NOTICE '  • Tüm üretim kayıtları';
    RAISE NOTICE '  • Kalite kontrol kayıtları';
    RAISE NOTICE '  • Depo işlemleri';
    RAISE NOTICE '  • Müşteriler ve tedarikçiler';
    RAISE NOTICE '  • Malzeme transferleri';
    RAISE NOTICE '';
    RAISE NOTICE 'Korunan veriler:';
    RAISE NOTICE '  • Kullanıcılar (profiles)';
    RAISE NOTICE '  • Roller (roles)';
    RAISE NOTICE '  • Şirket bilgileri (companies)';
    RAISE NOTICE '  • Depo kategorileri';
    RAISE NOTICE '  • Depo ürünleri (stoklar sıfır)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık yeni veriler ekleyebilirsiniz!';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TÜM ÜRETİM, PROJE, DEPO, İRSALİYE VERİLERİNİ SIFIRLA
-- =====================================================
-- UYARI: Bu işlem geri alınamaz!
-- Tezgahlar, personeller, müşteriler, tedarikçiler,
-- kullanıcılar, roller, şirket bilgileri KORUNUR.
-- Depo ürünleri korunur ama stokları sıfırlanır.
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TÜM ÜRETİM VERİLERİ SİLİNİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ─── GÜNLÜK ÜRETİM ─────────────────────────
    DELETE FROM machine_daily_production WHERE TRUE;
    RAISE NOTICE '  machine_daily_production silindi';

    -- ─── KALİTE KONTROL ────────────────────────
    DELETE FROM warehouse_qc_requests WHERE TRUE;
    RAISE NOTICE '  warehouse_qc_requests silindi';

    DELETE FROM qc_to_warehouse_transfers WHERE TRUE;
    RAISE NOTICE '  qc_to_warehouse_transfers silindi';

    DELETE FROM production_to_qc_transfers WHERE TRUE;
    RAISE NOTICE '  production_to_qc_transfers silindi';

    DELETE FROM quality_control_inventory WHERE TRUE;
    RAISE NOTICE '  quality_control_inventory silindi';

    -- ─── ÜRETİM ────────────────────────────────
    DELETE FROM production_outputs WHERE TRUE;
    RAISE NOTICE '  production_outputs silindi';

    DELETE FROM production_scrap_records WHERE TRUE;
    RAISE NOTICE '  production_scrap_records silindi';

    DELETE FROM production_to_machine_transfers WHERE TRUE;
    RAISE NOTICE '  production_to_machine_transfers silindi';

    DELETE FROM production_to_warehouse_transfers WHERE TRUE;
    RAISE NOTICE '  production_to_warehouse_transfers silindi';

    DELETE FROM production_material_requests WHERE TRUE;
    RAISE NOTICE '  production_material_requests silindi';

    DELETE FROM production_material_assignments WHERE TRUE;
    RAISE NOTICE '  production_material_assignments silindi';

    DELETE FROM production_inventory WHERE TRUE;
    RAISE NOTICE '  production_inventory silindi';

    DELETE FROM machine_inventory WHERE TRUE;
    RAISE NOTICE '  machine_inventory silindi';

    -- ─── DEPO ──────────────────────────────────
    DELETE FROM warehouse_transactions WHERE TRUE;
    RAISE NOTICE '  warehouse_transactions silindi';

    -- ─── İRSALİYELER ──────────────────────────
    BEGIN
        DELETE FROM waybill_items WHERE TRUE;
        RAISE NOTICE '  waybill_items silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  waybill_items tablosu yok, atlandı';
    END;

    BEGIN
        DELETE FROM waybills WHERE TRUE;
        RAISE NOTICE '  waybills silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  waybills tablosu yok, atlandı';
    END;

    -- ─── TAKIMHANE TESLİMLERİ ──────────────────
    BEGIN
        DELETE FROM tool_machine_deliveries WHERE TRUE;
        RAISE NOTICE '  tool_machine_deliveries silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  tool_machine_deliveries tablosu yok, atlandı';
    END;

    BEGIN
        DELETE FROM tool_maintenance WHERE TRUE;
        RAISE NOTICE '  tool_maintenance silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  tool_maintenance tablosu yok, atlandı';
    END;

    -- ─── SATINALMA TAKİP ──────────────────────
    BEGIN
        DELETE FROM purchasing_tracking WHERE TRUE;
        RAISE NOTICE '  purchasing_tracking silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  purchasing_tracking tablosu yok, atlandı';
    END;

    -- ─── SATIN ALMA SİPARİŞLERİ ───────────────
    BEGIN
        DELETE FROM purchase_order_items WHERE TRUE;
        RAISE NOTICE '  purchase_order_items silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  purchase_order_items tablosu yok, atlandı';
    END;

    BEGIN
        DELETE FROM purchase_orders WHERE TRUE;
        RAISE NOTICE '  purchase_orders silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  purchase_orders tablosu yok, atlandı';
    END;

    -- ─── SATIŞ SİPARİŞLERİ ────────────────────
    BEGIN
        DELETE FROM sales_orders WHERE TRUE;
        RAISE NOTICE '  sales_orders silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  sales_orders tablosu yok, atlandı';
    END;

    -- ─── FİYAT TEKLİFLERİ ─────────────────────
    BEGIN
        DELETE FROM quotation_items WHERE TRUE;
        RAISE NOTICE '  quotation_items silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  quotation_items tablosu yok, atlandı';
    END;

    BEGIN
        DELETE FROM quotations WHERE TRUE;
        RAISE NOTICE '  quotations silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  quotations tablosu yok, atlandı';
    END;

    -- ─── PROJE VERİLERİ ───────────────────────
    BEGIN
        DELETE FROM project_tools WHERE TRUE;
        RAISE NOTICE '  project_tools silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  project_tools tablosu yok, atlandı';
    END;

    BEGIN
        DELETE FROM project_materials WHERE TRUE;
        RAISE NOTICE '  project_materials silindi';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '  project_materials tablosu yok, atlandı';
    END;

    DELETE FROM project_machines WHERE TRUE;
    RAISE NOTICE '  project_machines silindi';

    DELETE FROM projects WHERE TRUE;
    RAISE NOTICE '  projects silindi';

    -- ─── STOKLARI SIFIRLA ─────────────────────
    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW() WHERE TRUE;
    RAISE NOTICE '  warehouse_items stokları sıfırlandı';

    BEGIN
        UPDATE tools SET quantity = 0, updated_at = NOW() WHERE TRUE;
        RAISE NOTICE '  tools stokları sıfırlandı';
    EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE '  tools stok sıfırlama atlandı';
    END;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TÜM VERİLER SİLİNDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Silinen:';
    RAISE NOTICE '  - Projeler ve bağımlı veriler';
    RAISE NOTICE '  - Günlük üretim kayıtları';
    RAISE NOTICE '  - Üretim çıktıları ve fire kayıtları';
    RAISE NOTICE '  - Kalite kontrol kayıtları';
    RAISE NOTICE '  - Depo giriş/çıkış işlemleri';
    RAISE NOTICE '  - İrsaliyeler';
    RAISE NOTICE '  - Takımhane teslimleri ve bakım kayıtları';
    RAISE NOTICE '  - Satınalma takip ve sipariş kayıtları';
    RAISE NOTICE '  - Satış siparişleri';
    RAISE NOTICE '  - Fiyat teklifleri';
    RAISE NOTICE '';
    RAISE NOTICE 'Korunan:';
    RAISE NOTICE '  Tezgahlar, Personeller, Müşteriler';
    RAISE NOTICE '  Tedarikçiler, Kullanıcılar, Roller';
    RAISE NOTICE '  Şirket bilgileri, Depo kategorileri';
    RAISE NOTICE '  Depo ürünleri (stok=0), Takımlar (stok=0)';
    RAISE NOTICE '';
END $$;

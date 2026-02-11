-- TÜM STOK VE TRANSFER KAYITLARINI SIFIRLA
-- Ürünler, makineler, şirketler vs korunur, sadece stoklar sıfırlanır

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🗑️  TÜM STOKLAR SIFIRLANACAK!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- 1. Transfer kayıtlarını sil
TRUNCATE TABLE production_to_machine_transfers CASCADE;
TRUNCATE TABLE production_to_warehouse_transfers CASCADE;
TRUNCATE TABLE production_to_qc_transfers CASCADE;
TRUNCATE TABLE qc_to_warehouse_transfers CASCADE;
TRUNCATE TABLE production_material_requests CASCADE;

-- 2. Fire kayıtlarını sil
TRUNCATE TABLE production_scrap_records CASCADE;

-- 3. Üretim çıktı kayıtlarını sil
TRUNCATE TABLE production_outputs CASCADE;

-- 4. Stok tablolarını tamamen temizle
TRUNCATE TABLE production_inventory CASCADE;
TRUNCATE TABLE machine_inventory CASCADE;
TRUNCATE TABLE quality_control_inventory CASCADE;

-- 5. Warehouse transactions'ı sil (opsiyonel - ana depo hareketleri)
-- Eğer ana depo da sıfırlanacaksa bu satırın yorumunu kaldır:
-- TRUNCATE TABLE warehouse_transactions CASCADE;

DO $$
DECLARE
    prod_inv_count INTEGER;
    machine_inv_count INTEGER;
    qc_inv_count INTEGER;
    transfers_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prod_inv_count FROM production_inventory;
    SELECT COUNT(*) INTO machine_inv_count FROM machine_inventory;
    SELECT COUNT(*) INTO qc_inv_count FROM quality_control_inventory;
    SELECT COUNT(*) INTO transfers_count FROM production_to_machine_transfers;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM STOKLAR SIFIRLANDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Silinen Kayıtlar:';
    RAISE NOTICE '  ✓ Üretim Deposu: Temizlendi';
    RAISE NOTICE '  ✓ Tezgah Deposu: Temizlendi';
    RAISE NOTICE '  ✓ Kalite Kontrol: Temizlendi';
    RAISE NOTICE '  ✓ Transfer Kayıtları: Temizlendi';
    RAISE NOTICE '  ✓ Fire Kayıtları: Temizlendi';
    RAISE NOTICE '  ✓ Üretim Çıktıları: Temizlendi';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Dokunulmadı:';
    RAISE NOTICE '  - Şirketler';
    RAISE NOTICE '  - Ürünler (warehouse_items)';
    RAISE NOTICE '  - Makineler';
    RAISE NOTICE '  - Projeler';
    RAISE NOTICE '  - Ana depo (warehouse_transactions)';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Şimdi yeniden test edebilirsiniz!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

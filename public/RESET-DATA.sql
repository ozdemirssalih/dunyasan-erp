-- VERİ TEMİZLEME SCRIPT'İ
-- Ürün/malzeme tanımları korunacak, sadece stok miktarları sıfırlanacak
-- İşlem kayıtları (transfer, üretim, kalite) tamamen silinecek

-- ========================================
-- 1️⃣ STOK MİKTARLARINI SIFIRLA (Güvenli - Sadece var olan tablolar)
-- ========================================

DO $$
BEGIN
    -- Depo stok sayılarını sıfırla
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouse_items') THEN
        UPDATE warehouse_items SET current_stock = 0 WHERE current_stock IS NOT NULL;
        RAISE NOTICE '✓ warehouse_items stokları sıfırlandı';
    ELSE
        RAISE NOTICE '⊘ warehouse_items tablosu bulunamadı';
    END IF;

    -- Üretim stoğunu sıfırla
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_inventory') THEN
        UPDATE production_inventory SET current_stock = 0 WHERE current_stock IS NOT NULL;
        RAISE NOTICE '✓ production_inventory stokları sıfırlandı';
    ELSE
        RAISE NOTICE '⊘ production_inventory tablosu bulunamadı';
    END IF;

    -- Envanter stoğunu sıfırla
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory') THEN
        UPDATE inventory SET quantity = 0 WHERE quantity IS NOT NULL;
        RAISE NOTICE '✓ inventory stokları sıfırlandı';
    ELSE
        RAISE NOTICE '⊘ inventory tablosu bulunamadı';
    END IF;

    -- Takımhane stoğunu sıfırla
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tools') THEN
        UPDATE tools SET quantity = 0 WHERE quantity IS NOT NULL;
        RAISE NOTICE '✓ tools stokları sıfırlandı';
    ELSE
        RAISE NOTICE '⊘ tools tablosu bulunamadı';
    END IF;
END $$;

-- ========================================
-- 2️⃣ İŞLEM KAYITLARINI SİL (Güvenli - Sadece var olan tablolar)
-- ========================================

DO $$
BEGIN
    -- Tüm transferleri sil (eğer tablo varsa)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_transfers') THEN
        DELETE FROM inventory_transfers;
        RAISE NOTICE '✓ inventory_transfers tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ inventory_transfers tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Tüm tezgah üretim verilerini sil
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machine_daily_production') THEN
        DELETE FROM machine_daily_production;
        RAISE NOTICE '✓ machine_daily_production tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ machine_daily_production tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Tüm kalite kontrol kayıtlarını sil
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quality_control') THEN
        DELETE FROM quality_control;
        RAISE NOTICE '✓ quality_control tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ quality_control tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Tüm şirket sohbet mesajlarını sil
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_chat_messages') THEN
        DELETE FROM company_chat_messages;
        RAISE NOTICE '✓ company_chat_messages tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ company_chat_messages tablosu bulunamadı (atlanıyor)';
    END IF;

    -- === ÜRETİM TAKİP KAYITLARI VE GEÇMİŞİ ===

    -- Üretim çıktıları
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_outputs') THEN
        DELETE FROM production_outputs;
        RAISE NOTICE '✓ production_outputs tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_outputs tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Fire kayıtları
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_scrap_records') THEN
        DELETE FROM production_scrap_records;
        RAISE NOTICE '✓ production_scrap_records tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_scrap_records tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Üretimden tezgaha transferler
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_to_machine_transfers') THEN
        DELETE FROM production_to_machine_transfers;
        RAISE NOTICE '✓ production_to_machine_transfers tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_to_machine_transfers tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Üretimden depoya transferler
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_to_warehouse_transfers') THEN
        DELETE FROM production_to_warehouse_transfers;
        RAISE NOTICE '✓ production_to_warehouse_transfers tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_to_warehouse_transfers tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Malzeme talepleri
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_material_requests') THEN
        DELETE FROM production_material_requests;
        RAISE NOTICE '✓ production_material_requests tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_material_requests tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Malzeme atamaları
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_material_assignments') THEN
        DELETE FROM production_material_assignments;
        RAISE NOTICE '✓ production_material_assignments tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_material_assignments tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Tezgah envanteri
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machine_inventory') THEN
        DELETE FROM machine_inventory;
        RAISE NOTICE '✓ machine_inventory tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ machine_inventory tablosu bulunamadı (atlanıyor)';
    END IF;

    -- === KALİTE KONTROL TEST SONUÇLARI VE GEÇMİŞİ ===

    -- Depo QC talepleri
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouse_qc_requests') THEN
        DELETE FROM warehouse_qc_requests;
        RAISE NOTICE '✓ warehouse_qc_requests tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ warehouse_qc_requests tablosu bulunamadı (atlanıyor)';
    END IF;

    -- QC'den depoya transferler
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'qc_to_warehouse_transfers') THEN
        DELETE FROM qc_to_warehouse_transfers;
        RAISE NOTICE '✓ qc_to_warehouse_transfers tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ qc_to_warehouse_transfers tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Üretimden QC'ye transferler
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_to_qc_transfers') THEN
        DELETE FROM production_to_qc_transfers;
        RAISE NOTICE '✓ production_to_qc_transfers tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ production_to_qc_transfers tablosu bulunamadı (atlanıyor)';
    END IF;

    -- Kalite kontrol envanteri
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quality_control_inventory') THEN
        DELETE FROM quality_control_inventory;
        RAISE NOTICE '✓ quality_control_inventory tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ quality_control_inventory tablosu bulunamadı (atlanıyor)';
    END IF;

    -- === DEPO TRANSFER GEÇMİŞİ VE İŞLEMLERİ ===

    -- Depo işlemleri (transactions - tüm giriş/çıkış geçmişi)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouse_transactions') THEN
        DELETE FROM warehouse_transactions;
        RAISE NOTICE '✓ warehouse_transactions tablosu temizlendi';
    ELSE
        RAISE NOTICE '⊘ warehouse_transactions tablosu bulunamadı (atlanıyor)';
    END IF;

    -- (Opsiyonel) Makine bakım kayıtlarını sil
    -- IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machine_maintenance') THEN
    --     DELETE FROM machine_maintenance;
    --     RAISE NOTICE '✓ machine_maintenance tablosu temizlendi';
    -- END IF;

    -- (Opsiyonel) Sipariş kayıtlarını sil
    -- IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
    --     DELETE FROM orders;
    --     RAISE NOTICE '✓ orders tablosu temizlendi';
    -- END IF;
END $$;

-- ========================================
-- ✅ BAŞARI MESAJI
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🧹 VERİ TEMİZLEME TAMAMLANDI!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Korunan Veriler:';
    RAISE NOTICE '   ✓ Ürün/malzeme tanımları';
    RAISE NOTICE '   ✓ Kategori tanımları';
    RAISE NOTICE '   ✓ Tedarikçi bilgileri';
    RAISE NOTICE '   ✓ Makine tanımları';
    RAISE NOTICE '   ✓ Kullanıcı ve şirket bilgileri';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Sistem temiz ve yeni veri girişi için hazır!';
    RAISE NOTICE '';
END $$;

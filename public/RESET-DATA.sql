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

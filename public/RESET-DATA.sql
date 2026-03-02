-- VERİ TEMİZLEME SCRIPT'İ
-- Ürün/malzeme tanımları korunacak, sadece stok miktarları sıfırlanacak
-- İşlem kayıtları (transfer, üretim, kalite) tamamen silinecek

-- ========================================
-- 1️⃣ STOK MİKTARLARINI SIFIRLA
-- ========================================

-- Depo stok sayılarını sıfırla
UPDATE warehouse_items
SET current_stock = 0
WHERE current_stock IS NOT NULL;

-- Üretim stoğunu sıfırla
UPDATE production_inventory
SET current_stock = 0
WHERE current_stock IS NOT NULL;

-- Envanter stoğunu sıfırla
UPDATE inventory
SET quantity = 0
WHERE quantity IS NOT NULL;

-- Takımhane stoğunu sıfırla
UPDATE tools
SET quantity = 0
WHERE quantity IS NOT NULL;

-- ========================================
-- 2️⃣ İŞLEM KAYITLARINI SİL
-- ========================================

-- Tüm transferleri sil
DELETE FROM inventory_transfers;

-- Tüm tezgah üretim verilerini sil
DELETE FROM machine_daily_production;

-- Tüm kalite kontrol kayıtlarını sil
DELETE FROM quality_control;

-- (Opsiyonel) Makine bakım kayıtlarını sil
-- DELETE FROM machine_maintenance;

-- (Opsiyonel) Sipariş kayıtlarını sil
-- DELETE FROM orders;

-- ========================================
-- ✅ BAŞARI MESAJI
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '🧹 VERİ TEMİZLEME TAMAMLANDI!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sıfırlanan Stoklar:';
    RAISE NOTICE '   • Depo stokları (warehouse_items.current_stock = 0)';
    RAISE NOTICE '   • Üretim stokları (production_inventory.current_stock = 0)';
    RAISE NOTICE '   • Envanter stokları (inventory.quantity = 0)';
    RAISE NOTICE '   • Takımhane stokları (tools.quantity = 0)';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Silinen Kayıtlar:';
    RAISE NOTICE '   • Tüm transferler (inventory_transfers)';
    RAISE NOTICE '   • Tüm tezgah üretim verileri (machine_daily_production)';
    RAISE NOTICE '   • Tüm kalite kontrol kayıtları (quality_control)';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Korunan Veriler:';
    RAISE NOTICE '   • Ürün/malzeme tanımları';
    RAISE NOTICE '   • Kategori tanımları';
    RAISE NOTICE '   • Tedarikçi bilgileri';
    RAISE NOTICE '   • Makine tanımları';
    RAISE NOTICE '   • Kullanıcı ve şirket bilgileri';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Sistem temiz ve yeni giriş için hazır!';
END $$;

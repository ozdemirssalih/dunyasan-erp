-- =====================================================
-- WAREHOUSE TRANSACTION TRIGGER'INI OLUŞTUR
-- =====================================================
-- warehouse_transactions'a kayıt eklenince warehouse_items stokunu günceller
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 WAREHOUSE TRIGGER OLUŞTURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Eski trigger'ı sil
DROP TRIGGER IF EXISTS trg_update_warehouse_stock ON warehouse_transactions;
DROP FUNCTION IF EXISTS update_warehouse_stock();

-- Yeni trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_warehouse_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type = 'entry' THEN
        -- GİRİŞ: Stoku artır
        UPDATE warehouse_items
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        RAISE NOTICE '✅ GİRİŞ: % adet eklendi (item_id: %)', NEW.quantity, NEW.item_id;

    ELSIF NEW.type = 'exit' THEN
        -- ÇIKIŞ: Stoku azalt
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        -- Stok kontrolü
        IF (SELECT current_stock FROM warehouse_items WHERE id = NEW.item_id) < 0 THEN
            RAISE WARNING '⚠️  UYARI: Negatif stok! (item_id: %)', NEW.item_id;
        END IF;

        RAISE NOTICE '✅ ÇIKIŞ: % adet çıkarıldı (item_id: %)', NEW.quantity, NEW.item_id;

    END IF;

    RETURN NEW;
END;
$$;

-- Trigger'ı oluştur
CREATE TRIGGER trg_update_warehouse_stock
    AFTER INSERT ON warehouse_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_stock();

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ WAREHOUSE TRIGGER OLUŞTURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Çalışma Mantığı:';
    RAISE NOTICE '   • type = "entry" → Stok ARTAR';
    RAISE NOTICE '   • type = "exit" → Stok AZALIR';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Otomatik stok güncelleme aktif!';
    RAISE NOTICE '========================================';
END $$;

-- TEST: Trigger'ın var olduğunu doğrula
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_name = 'trg_update_warehouse_stock'
          AND event_object_table = 'warehouse_transactions'
    ) INTO trigger_exists;

    IF trigger_exists THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅✅✅ DOĞRULANDI: Trigger aktif!';
    ELSE
        RAISE EXCEPTION '❌ HATA: Trigger oluşturulamadı!';
    END IF;
END $$;

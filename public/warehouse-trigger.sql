-- DÜNYASAN ERP - Depo Trigger (Otomatik Stok Güncelleme)
-- ÖNCELİKLE warehouse-setup.sql dosyasını çalıştırın!

-- Stok güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_warehouse_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Giriş ise stok artar
    IF NEW.type = 'entry' THEN
        UPDATE warehouse_items
        SET
            current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;

    -- Çıkış ise stok azalır
    IF NEW.type = 'exit' THEN
        UPDATE warehouse_items
        SET
            current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trg_update_stock ON warehouse_transactions;

CREATE TRIGGER trg_update_stock
    AFTER INSERT ON warehouse_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_stock();

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Stok güncelleme trigger aktif!';
    RAISE NOTICE '📊 Giriş/Çıkış yapıldığında stok otomatik güncellenecek';
END $$;

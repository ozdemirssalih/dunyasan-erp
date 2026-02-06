-- =====================================================
-- WAREHOUSE ÇIKIŞ → HEDEF ENVANTER EKLEME
-- =====================================================
-- Depodan çıkış yapılırken hedef belirtiliyorsa
-- (production, quality_control) ilgili envantere ekler
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 WAREHOUSE EXIT → DESTINATION SİSTEMİ...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: warehouse_transactions tablosuna destination kolonları ekle
-- =====================================================
ALTER TABLE warehouse_transactions
ADD COLUMN IF NOT EXISTS destination_type TEXT CHECK (destination_type IN ('production', 'quality_control', 'machine', NULL)),
ADD COLUMN IF NOT EXISTS destination_id UUID;

COMMENT ON COLUMN warehouse_transactions.destination_type IS 'Çıkış hedefi: production, quality_control, machine veya NULL (normal çıkış)';
COMMENT ON COLUMN warehouse_transactions.destination_id IS 'Hedef ID (machine_id gibi), opsiyonel';

DO $$
BEGIN
    RAISE NOTICE '✅ 1/2 - destination kolonları eklendi';
END $$;

-- =====================================================
-- ADIM 2: Warehouse trigger'ını güncelle (hedef desteği)
-- =====================================================
DROP TRIGGER IF EXISTS trg_update_warehouse_stock ON warehouse_transactions;

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

        RAISE NOTICE '✅ ÇIKIŞ: % adet çıkarıldı (item_id: %)', NEW.quantity, NEW.item_id;

        -- HEDEF VARSA İLGİLİ ENVANTERE EKLE
        IF NEW.destination_type = 'production' THEN
            -- Üretime gönder (hammadde olarak)
            INSERT INTO production_inventory (
                company_id,
                item_id,
                current_stock,
                item_type,
                notes
            ) VALUES (
                NEW.company_id,
                NEW.item_id,
                NEW.quantity,
                'raw_material',
                'Depodan direkt gönderim - Ref: ' || NEW.reference_number
            )
            ON CONFLICT (company_id, item_id, item_type)
            DO UPDATE SET
                current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
                updated_at = NOW();

            RAISE NOTICE '  → Üretime eklendi: % adet', NEW.quantity;

        ELSIF NEW.destination_type = 'quality_control' THEN
            -- Kalite kontrole gönder
            INSERT INTO quality_control_inventory (
                company_id,
                item_id,
                current_stock,
                notes
            ) VALUES (
                NEW.company_id,
                NEW.item_id,
                NEW.quantity,
                'Depodan direkt gönderim - Ref: ' || NEW.reference_number
            )
            ON CONFLICT (company_id, item_id)
            DO UPDATE SET
                current_stock = quality_control_inventory.current_stock + EXCLUDED.current_stock,
                updated_at = NOW();

            RAISE NOTICE '  → Kalite kontrole eklendi: % adet', NEW.quantity;

        ELSIF NEW.destination_type = 'machine' THEN
            -- Tezgaha gönder
            IF NEW.destination_id IS NULL THEN
                RAISE EXCEPTION 'Tezgaha gönderim için destination_id (machine_id) gerekli!';
            END IF;

            INSERT INTO machine_inventory (
                company_id,
                machine_id,
                item_id,
                current_stock,
                notes
            ) VALUES (
                NEW.company_id,
                NEW.destination_id,
                NEW.item_id,
                NEW.quantity,
                'Depodan direkt gönderim - Ref: ' || NEW.reference_number
            )
            ON CONFLICT (company_id, machine_id, item_id)
            DO UPDATE SET
                current_stock = machine_inventory.current_stock + EXCLUDED.current_stock,
                updated_at = NOW();

            RAISE NOTICE '  → Tezgaha eklendi: % adet (machine_id: %)', NEW.quantity, NEW.destination_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_warehouse_stock
    AFTER INSERT ON warehouse_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_stock();

DO $$
BEGIN
    RAISE NOTICE '✅ 2/2 - Warehouse trigger güncellendi (hedef desteği)';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ WAREHOUSE EXIT → DESTINATION HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Çalışma Mantığı:';
    RAISE NOTICE '';
    RAISE NOTICE '📤 Normal Çıkış (destination_type = NULL):';
    RAISE NOTICE '   • Sadece warehouse_items stoku azalır';
    RAISE NOTICE '';
    RAISE NOTICE '📤 Üretime Çıkış (destination_type = "production"):';
    RAISE NOTICE '   • warehouse_items stoku azalır';
    RAISE NOTICE '   • production_inventory''ye hammadde olarak eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '📤 Kalite Kontrole Çıkış (destination_type = "quality_control"):';
    RAISE NOTICE '   • warehouse_items stoku azalır';
    RAISE NOTICE '   • quality_control_inventory''ye eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '📤 Tezgaha Çıkış (destination_type = "machine"):';
    RAISE NOTICE '   • warehouse_items stoku azalır';
    RAISE NOTICE '   • machine_inventory''ye eklenir';
    RAISE NOTICE '   • destination_id (machine_id) zorunlu!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık depodan çıkış hedef envantere ulaşacak!';
    RAISE NOTICE '========================================';
END $$;

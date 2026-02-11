-- ÜRETİM → TEZGAH TRANSFER TRIGGER'INI DÜZELT
-- FIFO mantığı: Önce raw_material, bitince tashih kullan

CREATE OR REPLACE FUNCTION transfer_production_to_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    remaining_qty DECIMAL(15,3);
    raw_stock DECIMAL(15,3);
    tashih_stock DECIMAL(15,3);
    deduct_from_raw DECIMAL(15,3);
    deduct_from_tashih DECIMAL(15,3);
BEGIN
    remaining_qty := NEW.quantity;

    -- 1. raw_material stoğunu kontrol et
    SELECT COALESCE(current_stock, 0) INTO raw_stock
    FROM production_inventory
    WHERE company_id = NEW.company_id
      AND item_id = NEW.item_id
      AND item_type = 'raw_material';

    -- 2. tashih stoğunu kontrol et
    SELECT COALESCE(current_stock, 0) INTO tashih_stock
    FROM production_inventory
    WHERE company_id = NEW.company_id
      AND item_id = NEW.item_id
      AND item_type = 'tashih';

    RAISE NOTICE '🔍 Transfer: % adet | raw: % | tashih: %', NEW.quantity, raw_stock, tashih_stock;

    -- 3. Önce raw_material'den düş
    IF raw_stock > 0 THEN
        deduct_from_raw := LEAST(raw_stock, remaining_qty);

        UPDATE production_inventory
        SET current_stock = current_stock - deduct_from_raw,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'raw_material';

        remaining_qty := remaining_qty - deduct_from_raw;
        RAISE NOTICE '✅ raw_material''den düşüldü: %', deduct_from_raw;
    END IF;

    -- 4. Eğer hala miktar kaldıysa, tashih'ten düş
    IF remaining_qty > 0 AND tashih_stock > 0 THEN
        deduct_from_tashih := LEAST(tashih_stock, remaining_qty);

        UPDATE production_inventory
        SET current_stock = current_stock - deduct_from_tashih,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'tashih';

        remaining_qty := remaining_qty - deduct_from_tashih;
        RAISE NOTICE '✅ tashih''ten düşüldü: %', deduct_from_tashih;
    END IF;

    -- 5. Tezgah envanterine ekle
    INSERT INTO machine_inventory (company_id, machine_id, item_id, current_stock, notes)
    VALUES (NEW.company_id, NEW.machine_id, NEW.item_id, NEW.quantity, 'Transfer #' || NEW.id)
    ON CONFLICT (company_id, machine_id, item_id)
    DO UPDATE SET
        current_stock = machine_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RAISE NOTICE '✅ Tezgaha eklendi: %', NEW.quantity;

    RETURN NEW;
END;
$$;

-- Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS trg_transfer_prod_to_machine ON production_to_machine_transfers;
CREATE TRIGGER trg_transfer_prod_to_machine
    AFTER INSERT ON production_to_machine_transfers
    FOR EACH ROW
    EXECUTE FUNCTION transfer_production_to_machine();

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ TRANSFER TRIGGER DÜZELTİLDİ!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'FIFO mantığı:';
    RAISE NOTICE '  1. Önce raw_material''den düşer';
    RAISE NOTICE '  2. Bitmişse tashih''ten düşer';
    RAISE NOTICE '  3. Her iki kaynağı da akıllıca kullanır';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;

-- production_to_machine_transfers tablosuna item_type ekle
-- Böylece kullanıcı hammadde mi tashih mi seçtiğini bileceğiz

ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS item_type TEXT;

-- Trigger'ı güncelle - seçilen item_type'dan düş
CREATE OR REPLACE FUNCTION transfer_production_to_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Kullanıcının seçtiği item_type'dan düş (raw_material VEYA tashih)
    UPDATE production_inventory
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE company_id = NEW.company_id
      AND item_id = NEW.item_id
      AND item_type = COALESCE(NEW.item_type, 'raw_material'); -- Varsayılan raw_material

    -- Tezgah envanterine ekle
    INSERT INTO machine_inventory (company_id, machine_id, item_id, current_stock, notes)
    VALUES (NEW.company_id, NEW.machine_id, NEW.item_id, NEW.quantity,
            'Transfer #' || NEW.id || ' (' || COALESCE(NEW.item_type, 'raw_material') || ')')
    ON CONFLICT (company_id, machine_id, item_id)
    DO UPDATE SET
        current_stock = machine_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ TRANSFER TABLOSU GÜNCELLENDİ!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  ✓ item_type kolonu eklendi';
    RAISE NOTICE '  ✓ Trigger güncellendi';
    RAISE NOTICE '  ✓ Hammadde seçersen → raw_material düşer';
    RAISE NOTICE '  ✓ Taşıh seçersen → tashih düşer';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÜRETİM FAZLASI HAMMADDE GERİ DÖNÜŞÜ
-- =====================================================
-- Üretim kaydında: Verilen - (Üretilen + Fire) farkı
-- üretim stoğuna geri eklenir
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 ÜRETİM FAZLASI GERİ DÖNÜŞÜ...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Üretim trigger'ını güncelle
DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    req RECORD;
    total_assigned DECIMAL := 0;
    total_used DECIMAL := 0;
    unused_material DECIMAL := 0;
BEGIN
    -- 1. Mamülü üretim stoğuna ekle
    INSERT INTO production_inventory (company_id, item_id, current_stock, item_type, notes)
    VALUES (NEW.company_id, NEW.output_item_id, NEW.quantity, 'finished_product', 'Üretim #' || NEW.id)
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET current_stock = production_inventory.current_stock + EXCLUDED.current_stock, updated_at = NOW();

    -- 2. Tezgahtan atanan malzemeleri çıkar
    FOR req IN
        SELECT item_id, quantity FROM production_material_assignments
        WHERE company_id = NEW.company_id AND machine_id = NEW.machine_id AND assigned_date::date = NEW.production_date::date
    LOOP
        -- Toplam atanan
        total_assigned := total_assigned + (req.quantity * NEW.quantity);

        -- Tezgahtan çıkar
        UPDATE machine_inventory SET current_stock = current_stock - (req.quantity * NEW.quantity), updated_at = NOW()
        WHERE company_id = NEW.company_id AND machine_id = NEW.machine_id AND item_id = req.item_id;

        -- Toplam kullanılan = Mamül + Fire
        total_used := NEW.quantity;
    END LOOP;

    -- 3. FAZLA HAMMADDE HESAPLA VE GERİ EKLE
    -- Fire varsa fire kaydından çıkar
    DECLARE
        fire_quantity DECIMAL := 0;
    BEGIN
        SELECT COALESCE(SUM(quantity), 0) INTO fire_quantity
        FROM production_scrap_records
        WHERE company_id = NEW.company_id
        AND machine_id = NEW.machine_id
        AND recorded_at::date = NEW.production_date::date;

        -- Kullanılmayan = Atanan - (Üretilen + Fire)
        unused_material := total_assigned - (NEW.quantity + fire_quantity);

        RAISE NOTICE '📊 Atanan: %, Üretilen: %, Fire: %, Fark: %', total_assigned, NEW.quantity, fire_quantity, unused_material;

        -- Eğer fazla hammadde varsa üretim stoğuna geri ekle
        IF unused_material > 0 THEN
            FOR req IN
                SELECT item_id, quantity FROM production_material_assignments
                WHERE company_id = NEW.company_id AND machine_id = NEW.machine_id AND assigned_date::date = NEW.production_date::date
            LOOP
                -- Her hammaddeyi orantılı olarak geri ekle
                INSERT INTO production_inventory (company_id, item_id, current_stock, item_type, notes)
                VALUES (NEW.company_id, req.item_id, unused_material, 'raw_material', 'Fazla hammadde - Üretim #' || NEW.id)
                ON CONFLICT (company_id, item_id, item_type)
                DO UPDATE SET current_stock = production_inventory.current_stock + EXCLUDED.current_stock, updated_at = NOW();

                RAISE NOTICE '🔄 Üretime geri eklendi: % (item_id: %)', unused_material, req.item_id;
            END LOOP;
        END IF;
    END;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ÜRETİM FAZLASI GERİ DÖNÜŞÜ HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Çalışma Mantığı:';
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣  Üretim Kaydı Oluşturulur:';
    RAISE NOTICE '   • Mamül üretim stoğuna eklenir';
    RAISE NOTICE '   • Tezgahtan hammadde çıkar';
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣  Fark Hesaplanır:';
    RAISE NOTICE '   • Fark = Atanan - (Üretilen + Fire)';
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣  Fazla Hammadde Geri Döner:';
    RAISE NOTICE '   • Fark > 0 ise üretim stoğuna eklenir';
    RAISE NOTICE '   • Kullanılmayan malzeme kaybolmaz!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık atık malzeme kaybolmayacak!';
    RAISE NOTICE '========================================';
END $$;

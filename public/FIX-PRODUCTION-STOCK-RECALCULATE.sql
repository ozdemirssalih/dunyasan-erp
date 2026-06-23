-- ============================================================
-- ÜRETİM STOĞUNU YENİDEN HESAPLA
-- Trigger'ın çift düşürmesi yüzünden bozulan stokları düzeltir
-- ============================================================

-- 1. Eski fire kayıtlarının source_type'ını düzelt
UPDATE production_scrap_records
SET source_type = 'manual_scrap'
WHERE source_type = 'production';

-- 2. Finished product stoklarını yeniden hesapla
-- production_outputs'taki toplam quantity = gerçek mamül stok
-- (KK'ya gönderilen ve depoya transfer edilenler düşülmeli)
DO $$
DECLARE
    rec RECORD;
    total_produced DECIMAL;
    total_sent_qc DECIMAL;
    total_sent_warehouse DECIMAL;
    correct_stock DECIMAL;
BEGIN
    RAISE NOTICE 'Üretim stokları yeniden hesaplanıyor...';

    FOR rec IN
        SELECT DISTINCT company_id, item_id
        FROM production_inventory
        WHERE item_type = 'finished_product'
    LOOP
        -- Toplam üretilen
        SELECT COALESCE(SUM(quantity), 0) INTO total_produced
        FROM production_outputs
        WHERE company_id = rec.company_id AND output_item_id = rec.item_id;

        -- KK'ya gönderilen (onaylanan)
        SELECT COALESCE(SUM(quantity), 0) INTO total_sent_qc
        FROM production_to_qc_transfers
        WHERE company_id = rec.company_id AND item_id = rec.item_id AND status = 'approved';

        -- Depoya transfer edilen (onaylanan)
        SELECT COALESCE(SUM(quantity), 0) INTO total_sent_warehouse
        FROM production_to_warehouse_transfers
        WHERE company_id = rec.company_id AND item_id = rec.item_id AND status = 'approved';

        correct_stock := total_produced - total_sent_qc - total_sent_warehouse;
        IF correct_stock < 0 THEN correct_stock := 0; END IF;

        UPDATE production_inventory
        SET current_stock = correct_stock, updated_at = NOW()
        WHERE company_id = rec.company_id AND item_id = rec.item_id AND item_type = 'finished_product';

        RAISE NOTICE '  % → Üretilen: %, KK: %, Depo: %, Yeni Stok: %',
            rec.item_id, total_produced, total_sent_qc, total_sent_warehouse, correct_stock;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Tamamlandı! Stoklar yeniden hesaplandı.';
END $$;

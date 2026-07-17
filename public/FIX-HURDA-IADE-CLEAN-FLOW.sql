-- ============================================================
-- HURDA / İADE FLOW TERTEMİZ FIX
-- ============================================================
-- Bu migration üretim ve kalite kontrolden gelen iade/hurda
-- transferlerinin depoya onaylı ve doğru şekilde girmesini sağlar.
--
-- 1) production_to_warehouse_transfers'a transfer_type kolonu ekle
-- 2) QC → Depo trigger'ı: iade/hurda için stok işlemi yapma (frontend
--    hurda/iade item'a aktaracak). Sadece passed için warehouse'a ekle
-- 3) Üretim → Depo trigger'ı: transfer_type='hurda' ise warehouse_transactions'a
--    entry insert etme (frontend hurda item'a aktaracak); production_inventory
--    her durumda düşürülür
-- ============================================================

-- 1. transfer_type kolonu
ALTER TABLE production_to_warehouse_transfers
ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20) DEFAULT 'normal';

-- 2. QC → Depo trigger'ı düzelt
CREATE OR REPLACE FUNCTION approve_qc_to_warehouse_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE quality_control_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id;

        IF NEW.quality_result = 'passed' THEN
            INSERT INTO warehouse_transactions
                (company_id, item_id, type, quantity, notes, reference_number, created_by, created_at)
            VALUES
                (NEW.company_id, NEW.item_id, 'entry', NEW.quantity,
                 'KK''den - #' || NEW.id, 'QC-WH-' || NEW.id,
                 COALESCE(NEW.approved_by, NEW.requested_by), NOW());
        END IF;
        -- Iade/hurda: hiçbir stok işlemi yapma; frontend hurda/iade item'a aktarır
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Üretim → Depo trigger'ı düzelt (transfer_type kontrolü)
CREATE OR REPLACE FUNCTION approve_production_to_warehouse_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id AND item_type = 'finished_product';

        IF COALESCE(NEW.transfer_type, 'normal') = 'normal' THEN
            INSERT INTO warehouse_transactions
                (company_id, item_id, type, quantity, notes, reference_number, created_by, created_at)
            VALUES
                (NEW.company_id, NEW.item_id, 'entry', NEW.quantity,
                 'Üretimden - #' || NEW.id, 'PROD-WH-' || NEW.id,
                 COALESCE(NEW.approved_by, NEW.requested_by), NOW());
        END IF;
        -- transfer_type='hurda': warehouse_transactions insert etme; frontend hurda item'a aktarır
    END IF;
    RETURN NEW;
END;
$$;

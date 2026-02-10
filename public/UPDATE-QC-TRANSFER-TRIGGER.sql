-- production_to_qc_transfers trigger'ini guncelle
-- Sadece kaliteye ekleme yapsin, uretimden dusme yapmasin
-- (Cunku uretimden dusme zaten transfer olusturulurken yapiliyor)

-- Eski trigger ve fonksiyonu kaldir
DROP TRIGGER IF EXISTS trg_approve_prod_qc_transfer ON production_to_qc_transfers;
DROP FUNCTION IF EXISTS approve_production_to_qc_transfer();

-- Yeni fonksiyon: SADECE kaliteye ekle
CREATE OR REPLACE FUNCTION approve_production_to_qc_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- URETIMDEN DUSME KALDIRILDI!
        -- Sadece kalite kontrole ekle (varsa guncelle, yoksa olustur)
        INSERT INTO quality_control_inventory (company_id, item_id, current_stock, notes)
        VALUES (NEW.company_id, NEW.item_id, NEW.quantity, 'Uretimden - #' || NEW.id)
        ON CONFLICT (company_id, item_id)
        DO UPDATE SET
            current_stock = quality_control_inventory.current_stock + EXCLUDED.current_stock,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger'i yeniden olustur
CREATE TRIGGER trg_approve_prod_qc_transfer
AFTER UPDATE ON production_to_qc_transfers
FOR EACH ROW
EXECUTE FUNCTION approve_production_to_qc_transfer();

SELECT 'Trigger guncellendi!' as mesaj;
SELECT 'Artik sadece kaliteye ekleme yapacak, uretimden dusme yapmayacak.' as bilgi;

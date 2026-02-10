-- production_to_qc_transfers trigger'ini devre disi birak
-- Cunku JavaScript kodu stok islemlerini yapiyor

-- Trigger'i kaldir
DROP TRIGGER IF EXISTS trg_approve_prod_qc_transfer ON production_to_qc_transfers;

-- Fonksiyonu da kaldir (opsiyonel)
DROP FUNCTION IF EXISTS approve_production_to_qc_transfer();

SELECT 'production_to_qc_transfers trigger devre disi birakildi!' as mesaj;
SELECT 'Artik stok islemleri sadece JavaScript kodu tarafindan yapilacak.' as bilgi;

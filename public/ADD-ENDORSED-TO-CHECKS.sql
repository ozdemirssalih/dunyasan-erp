-- checks tablosuna endorsed status ekle (constraint varsa güncelle)
ALTER TABLE checks DROP CONSTRAINT IF EXISTS checks_status_check;
ALTER TABLE checks ADD CONSTRAINT checks_status_check
  CHECK (status IN ('pending', 'collected', 'paid', 'endorsed', 'bounced', 'cancelled'));
SELECT 'endorsed status eklendi!' as mesaj;

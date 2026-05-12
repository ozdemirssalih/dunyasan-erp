ALTER TABLE checks ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
SELECT 'bank_name kolonu eklendi!' as mesaj;

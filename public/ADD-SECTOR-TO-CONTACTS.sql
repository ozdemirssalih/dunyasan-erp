-- contacts tablosuna sektör kolonu ekle
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_contacts_sector ON contacts(sector);
SELECT 'sector kolonu eklendi!' as mesaj;

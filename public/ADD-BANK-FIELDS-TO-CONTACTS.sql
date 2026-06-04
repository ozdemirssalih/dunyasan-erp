-- Cari hesaplara (contacts) banka bilgileri ekle
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban VARCHAR(40);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);

SELECT 'contacts tablosuna banka alanlari eklendi!' as mesaj;

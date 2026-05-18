ALTER TABLE cash_accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(14,2);
SELECT 'credit_limit kolonu eklendi!' as mesaj;

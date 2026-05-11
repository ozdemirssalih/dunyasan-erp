ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS expense_category VARCHAR(100);
SELECT 'expense_category kolonu eklendi!' as mesaj;

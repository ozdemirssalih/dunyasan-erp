ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
SELECT 'birth_date kolonu eklendi!' as mesaj;

-- Production inventory tablosunun yapısını ve örnek veriyi göster

-- 1. Kolon yapısı
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'production_inventory'
ORDER BY ordinal_position;

-- 2. İlk 3 kayıt (tüm kolonlar)
SELECT * FROM production_inventory LIMIT 3;

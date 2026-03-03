-- warehouse_items tablosunun yapısını kontrol et
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouse_items'
ORDER BY ordinal_position;

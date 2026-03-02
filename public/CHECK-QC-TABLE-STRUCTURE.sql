-- quality_control_inventory tablosunun yapısını göster
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quality_control_inventory'
ORDER BY ordinal_position;

-- Örnek veri
SELECT * FROM quality_control_inventory LIMIT 3;

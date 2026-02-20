-- Mevcut project_machines tablosunun kolonlarını kontrol et
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_machines'
ORDER BY ordinal_position;

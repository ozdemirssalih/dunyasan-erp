-- Bugün yapılan scrap değişikliklerini geri al

-- 1. manual_scrap olan kayıtları production'a geri çevir
UPDATE production_scrap_records SET source_type = 'production' WHERE source_type = 'manual_scrap';

-- 2. Constraint'i eski haline döndür
ALTER TABLE production_scrap_records DROP CONSTRAINT IF EXISTS production_scrap_records_source_type_check;
ALTER TABLE production_scrap_records ADD CONSTRAINT production_scrap_records_source_type_check
  CHECK (source_type IN ('production', 'machine', 'warehouse'));

SELECT 'Geri alındı!' as mesaj;

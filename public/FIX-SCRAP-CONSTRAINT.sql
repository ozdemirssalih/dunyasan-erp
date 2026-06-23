-- source_type check constraint'ini güncelle
ALTER TABLE production_scrap_records DROP CONSTRAINT IF EXISTS production_scrap_records_source_type_check;
ALTER TABLE production_scrap_records ADD CONSTRAINT production_scrap_records_source_type_check
  CHECK (source_type IN ('production', 'machine', 'warehouse', 'manual_scrap'));

-- Şimdi eski kayıtları güncelle
UPDATE production_scrap_records SET source_type = 'manual_scrap' WHERE source_type = 'production';

SELECT 'Constraint güncellendi ve kayıtlar düzeltildi!' as mesaj;

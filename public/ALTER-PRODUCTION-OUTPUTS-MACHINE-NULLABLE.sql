-- production_outputs tablosunda machine_id artık zorunlu değil (stok bazlı sisteme geçiş)
ALTER TABLE production_outputs
  ALTER COLUMN machine_id DROP NOT NULL;

-- production_scrap_records tablosunda da machine_id nullable olsun
ALTER TABLE production_scrap_records
  ALTER COLUMN machine_id DROP NOT NULL;

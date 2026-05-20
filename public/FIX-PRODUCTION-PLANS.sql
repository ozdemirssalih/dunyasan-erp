-- production_plans tablosuna eksik kolonları ekle
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS machine_id UUID;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS completed_quantity INTEGER DEFAULT 0;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS notes TEXT;

SELECT 'production_plans kolonları güncellendi!' as mesaj;

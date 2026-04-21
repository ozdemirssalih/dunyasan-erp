-- production_outputs tablosuna input_item_id kolonu ekle
-- Üretim kaydı silindiğinde hammaddeyi geri ekleyebilmek için
ALTER TABLE production_outputs ADD COLUMN IF NOT EXISTS input_item_id UUID REFERENCES warehouse_items(id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_input_item ON production_outputs(input_item_id);
SELECT 'input_item_id kolonu eklendi!' as mesaj;

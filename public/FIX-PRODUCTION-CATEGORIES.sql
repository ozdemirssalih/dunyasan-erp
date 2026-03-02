-- Boş category değerlerini item_type'a göre doldur

UPDATE production_inventory
SET category = CASE
    WHEN item_type = 'raw_material' THEN 'Hammadde'
    WHEN item_type = 'finished_product' THEN 'Bitmiş Ürün'
    WHEN item_type = 'scrap' THEN 'Fire/Hurda'
    ELSE 'Yarı Mamül'
END
WHERE category IS NULL OR category = '';

-- Eğer item_type de NULL/boş ise, varsayılan 'Hammadde' yap
UPDATE production_inventory
SET category = 'Hammadde'
WHERE (category IS NULL OR category = '')
  AND (item_type IS NULL OR item_type = '');

-- Kontrol: Tüm kayıtları göster (category ile birlikte)
SELECT
    id,
    item_id,
    item_type,
    category,
    current_stock,
    notes
FROM production_inventory
ORDER BY created_at DESC
LIMIT 20;

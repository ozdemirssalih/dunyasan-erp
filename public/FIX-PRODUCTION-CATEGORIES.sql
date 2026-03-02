-- Tüm production_inventory kayıtlarının category değerini güncelle
-- Eğer category NULL ise, item_type'a göre doldur

UPDATE production_inventory
SET category = CASE
    WHEN item_type = 'raw_material' THEN 'Hammadde'
    WHEN item_type = 'finished_product' THEN 'Bitmiş Ürün'
    WHEN item_type = 'scrap' THEN 'Fire/Hurda'
    ELSE 'Yarı Mamül'
END
WHERE category IS NULL OR category = '';

-- Eğer item_type de NULL ise, varsayılan olarak 'Hammadde' yap
UPDATE production_inventory
SET category = 'Hammadde'
WHERE (category IS NULL OR category = '')
  AND (item_type IS NULL OR item_type = '');

-- Kontrol et
SELECT
    id,
    COALESCE(item_code, code, product_code, 'KOD-YOK') as kod,
    COALESCE(item_name, name, product_name, 'İsimsiz') as isim,
    item_type,
    category,
    current_stock
FROM production_inventory
ORDER BY id DESC
LIMIT 10;

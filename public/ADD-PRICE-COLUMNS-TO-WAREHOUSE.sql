-- ================================================================
-- WAREHOUSE ITEMS'A FİYAT KOLONLARI EKLE
-- ================================================================
-- Fatura kesilirken ürün fiyatları için gerekli
-- ================================================================

-- Satış fiyatı (müşteriye satış)
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS sales_price DECIMAL(15,2) DEFAULT 0;

-- Alış fiyatı (tedarikçiden alış)
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2) DEFAULT 0;

-- Index ekle (fiyat sorgularını hızlandırmak için)
CREATE INDEX IF NOT EXISTS idx_warehouse_items_sales_price ON warehouse_items(sales_price);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_purchase_price ON warehouse_items(purchase_price);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Warehouse items tablosuna fiyat kolonları eklendi!';
    RAISE NOTICE '   • sales_price - Satış fiyatı';
    RAISE NOTICE '   • purchase_price - Alış fiyatı';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Artık fatura kesilirken ürün fiyatları otomatik gelecek!';
    RAISE NOTICE '';
END $$;

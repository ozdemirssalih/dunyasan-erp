-- TOOLS TABLOSUNA MARKA SÜTUNU EKLEME
-- =========================================

-- Mevcut tools tablosuna supplier_brand sütunu ekle
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS supplier_brand VARCHAR(100);

-- Yorum ekle
COMMENT ON COLUMN tools.supplier_brand IS 'Tedarikçi marka bilgisi (EUROFER, LAMINA, ZCC-CT, vb.)';

-- Başarılı mesajı
SELECT 'supplier_brand sütunu başarıyla eklendi!' as message;

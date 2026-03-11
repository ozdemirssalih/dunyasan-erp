#!/usr/bin/env python3
import sys

def escape_sql(s):
    return s.replace("'", "''")

input_file = sys.argv[1] if len(sys.argv) > 1 else '../public/tools-data-full.txt'
output_file = sys.argv[2] if len(sys.argv) > 2 else '../public/FINAL-TOOLROOM-ALL-600.sql'

sql_values = []

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue

        parts = line.split('\t')
        if len(parts) < 4:
            continue

        tool_code = parts[0].strip()
        tool_name = parts[1].strip() if len(parts) > 1 else ''
        tool_type = parts[2].strip() if len(parts) > 2 else ''
        quantity = parts[3].strip() if len(parts) > 3 else '0'
        location = parts[4].strip() if len(parts) > 4 else ''
        brand = parts[5].strip() if len(parts) > 5 else ''

        # Parse quantity
        try:
            qty = int(quantity)
        except:
            qty = 0

        # min_quantity
        min_qty = 10 if 'ELMAS INSERT' in tool_type else 5

        # Brand
        brand_value = 'NULL' if not brand else f"'{escape_sql(brand)}'"

        sql_values.append(
            f"  ('{escape_sql(tool_code)}', '{escape_sql(tool_name)}', '{escape_sql(tool_type)}', {qty}, {min_qty}, '{escape_sql(location)}', 'available', {brand_value})"
        )

# Write SQL file
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("""-- =============================================
-- TAKIMHANE SİSTEMİ - TÜM 600+ TAKIM
-- =============================================
-- Direkt çalıştır! Company ID otomatik
-- {} takım eksiksiz dahil
-- =============================================

-- ADIM 1: Marka sütunu ekle
ALTER TABLE tools ADD COLUMN IF NOT EXISTS supplier_brand VARCHAR(100);
COMMENT ON COLUMN tools.supplier_brand IS 'Tedarikçi marka bilgisi';

-- ADIM 2: Tüm takımları ekle
INSERT INTO tools (company_id, tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand)
SELECT
  (SELECT id FROM companies LIMIT 1),
  tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand
FROM (VALUES
""".format(len(sql_values)))

    f.write(',\n'.join(sql_values))

    f.write("""
) AS t(tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand);

-- Başarı mesajı
SELECT 'Takımhane sistemi başarıyla kuruldu! Toplam ' || COUNT(*) || ' takım eklendi.' as message
FROM tools
WHERE company_id = (SELECT id FROM companies LIMIT 1);
""")

print(f"✅ {len(sql_values)} takım başarıyla SQL dosyasına eklendi!")
print(f"📁 Dosya: {output_file}")

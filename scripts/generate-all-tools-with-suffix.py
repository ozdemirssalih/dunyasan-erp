#!/usr/bin/env python3
import sys

def escape_sql(s):
    return s.replace("'", "''")

input_file = sys.argv[1] if len(sys.argv) > 1 else '../public/tools-data-full-v2.txt'
output_file = sys.argv[2] if len(sys.argv) > 2 else '../public/FINAL-TOOLROOM-ALL-WITH-SUFFIX.sql'

sql_values = []
code_counts = {}  # Her kodun kaç kez göründüğünü takip et
suffix_map = {}   # Her kod için hangi suffix'de olduğumuzu takip et

with open(input_file, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f, 1):
        line = line.strip()
        if not line:
            continue

        parts = line.split('\t')
        if len(parts) < 4:
            continue

        original_code = parts[0].strip()

        # Bu kodu daha önce gördük mü?
        if original_code in code_counts:
            code_counts[original_code] += 1
            # Suffix ekle (A, B, C, D...)
            suffix_index = code_counts[original_code] - 1  # 0=ilk, 1=A, 2=B...
            if suffix_index > 0:
                suffix = chr(64 + suffix_index)  # 65=A, 66=B, 67=C...
                tool_code = f"{original_code}{suffix}"
                print(f"✏️  Duplicate düzeltme: {original_code} -> {tool_code} (Tekrar #{suffix_index+1})")
            else:
                tool_code = original_code
        else:
            code_counts[original_code] = 1
            tool_code = original_code

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

# Duplicate istatistikleri
duplicates = {code: count for code, count in code_counts.items() if count > 1}
total_duplicates = sum(count - 1 for count in duplicates.values())

# Write SQL file
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("""-- =============================================
-- TAKIMHANE SİSTEMİ - TÜM {} TAKIM
-- =============================================
-- Direkt çalıştır! Company ID otomatik
-- Duplicate takımlar otomatik suffix ile girildi (A, B, C...)
-- Örnek: MT-DZ-003-01, MT-DZ-003-01A, MT-DZ-003-01B...
-- {} takım eksiksiz dahil
-- =============================================

-- ADIM 1: Marka sütunu ekle
ALTER TABLE tools ADD COLUMN IF NOT EXISTS supplier_brand VARCHAR(100);
COMMENT ON COLUMN tools.supplier_brand IS 'Tedarikçi marka bilgisi';

-- ADIM 2: ESKİ KAYITLARI SİL
DELETE FROM tools
WHERE company_id = (SELECT id FROM companies LIMIT 1);

-- ADIM 3: Tüm takımları ekle
INSERT INTO tools (company_id, tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand)
SELECT
  (SELECT id FROM companies LIMIT 1),
  tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand
FROM (VALUES
""".format(len(sql_values), len(sql_values)))

    f.write(',\n'.join(sql_values))

    f.write("""
) AS t(tool_code, tool_name, tool_type, quantity, min_quantity, location, status, supplier_brand);

-- Başarı mesajı
SELECT 'ESKİ KAYITLAR SİLİNDİ! Takımhane sistemi başarıyla kuruldu! Toplam ' || COUNT(*) || ' takım eklendi.' as message
FROM tools
WHERE company_id = (SELECT id FROM companies LIMIT 1);
""")

print(f"\n✅ {len(sql_values)} takım başarıyla SQL dosyasına eklendi!")
if duplicates:
    print(f"\n📋 Duplicate Takımlar (Suffix eklendi):")
    for code, count in sorted(duplicates.items()):
        suffixes = [code] + [f"{code}{chr(65+i)}" for i in range(count-1)]
        print(f"   • {code}: {count} kez ({', '.join(suffixes)})")
    print(f"\n✨ Toplam {len(duplicates)} farklı kod, {total_duplicates} duplicate kayıt otomatik düzeltildi!")
else:
    print(f"✨ Hiç duplicate kayıt yok!")
print(f"📁 Dosya: {output_file}")

#!/usr/bin/env python3

input_file = '../public/FINAL-TOOLROOM-ALL-WITH-SUFFIX.sql'
part1_file = '../public/FINAL-TOOLROOM-PART1-300.sql'
part2_file = '../public/FINAL-TOOLROOM-PART2-306.sql'

# SQL dosyasını oku
with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# VALUES satırlarını bul
values_start = None
values_end = None
for i, line in enumerate(lines):
    if 'FROM (VALUES' in line:
        values_start = i + 1
    if values_start and ') AS t(' in line:
        values_end = i
        break

# Header ve footer
header = ''.join(lines[:values_start])
footer = ''.join(lines[values_end:])

# VALUES satırları
values_lines = lines[values_start:values_end]

# İlk 300 ve son 306'ya böl
part1_values = values_lines[:300]
part2_values = values_lines[300:]

# PART 1: İlk 300 takım
with open(part1_file, 'w', encoding='utf-8') as f:
    f.write(header.replace('606 TAKIM', '300 TAKIM (PART 1/2)'))
    # Son satırdan virgülü kaldır
    for i, line in enumerate(part1_values):
        if i == len(part1_values) - 1:
            f.write(line.rstrip(',\n') + '\n')
        else:
            f.write(line)
    f.write(footer)

# PART 2: Kalan 306 takım (ESKİ KAYITLARI SİLME!)
part2_header = header.replace('606 TAKIM', '306 TAKIM (PART 2/2)')
part2_header = part2_header.replace('-- ADIM 2: ESKİ KAYITLARI SİL\nDELETE FROM tools\nWHERE company_id = (SELECT id FROM companies LIMIT 1);\n\n',
                                    '-- ADIM 2: ESKİ KAYITLAR ZATENSİLİNDİ (PART 1\'DE)\n-- Bu bölüm sadece kalan takımları ekler\n\n')

with open(part2_file, 'w', encoding='utf-8') as f:
    f.write(part2_header)
    # Son satırdan virgülü kaldır
    for i, line in enumerate(part2_values):
        if i == len(part2_values) - 1:
            f.write(line.rstrip(',\n') + '\n')
        else:
            f.write(line)
    f.write(footer)

print(f"✅ SQL 2 parçaya bölündü:")
print(f"   📁 Part 1: {part1_file} ({len(part1_values)} takım)")
print(f"   📁 Part 2: {part2_file} ({len(part2_values)} takım)")
print(f"\n🎯 Kullanım:")
print(f"   1. Önce PART1'i çalıştır (eski verileri siler, 300 takım ekler)")
print(f"   2. Sonra PART2'yi çalıştır (kalan 306 takımı ekler)")

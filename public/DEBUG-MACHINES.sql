-- MACHINES TABLOSUNA BAĞLI HER ŞEYİ GÖSTER

-- 1. Machines tablosundaki sütunlar
SELECT 'SÜTUNLAR' as kategori, column_name as isim, data_type as tip, is_nullable as nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'machines'
ORDER BY ordinal_position;

-- 2. Machines tablosundaki constraint'ler
SELECT 'CONSTRAINTS' as kategori, constraint_name as isim, constraint_type as tip
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'machines';

-- 3. Machines tablosuna referans veren foreign key'ler (BAŞKA TABLOLARDAN)
SELECT 'FOREIGN KEYS (Başka Tablolardan)' as kategori,
       tc.table_name as tablo,
       tc.constraint_name as isim,
       kcu.column_name as sutun
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'machines'
  AND tc.table_schema = 'public';

-- 4. Machines tablosundaki RLS politikaları
SELECT 'RLS POLİTİKALARI' as kategori, policyname as isim, cmd as komut, qual::text as koşul
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'machines';

-- 5. Machines ile ilgili VIEW'ler
SELECT 'VIEWS' as kategori, table_name as isim
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition LIKE '%machines%';

-- 6. Machines ile ilgili TRIGGER'lar
SELECT 'TRIGGERS' as kategori, trigger_name as isim, event_manipulation as olay
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'machines';

-- 7. Machines'e bağlı INDEX'ler
SELECT 'INDEXES' as kategori, indexname as isim, indexdef as tanimlama
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'machines';

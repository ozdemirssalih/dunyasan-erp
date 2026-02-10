-- roles tablosu RLS politikalarını düzelt

-- 1. Mevcut politikaları kontrol et
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY cmd, policyname;

-- 2. Mevcut kullanıcının rol bilgisini kontrol et
SELECT
    p.id,
    p.email,
    p.role_id,
    r.name as role_name,
    r.is_system_role
FROM profiles p
JOIN roles r ON p.role_id = r.id
WHERE p.id = auth.uid();

-- 3. Sistemdeki tüm rolleri listele
SELECT id, name, is_system_role FROM roles ORDER BY name;

-- 4. ESKİ POLİTİKALARI SİL
DROP POLICY IF EXISTS roles_insert ON roles;
DROP POLICY IF EXISTS roles_update ON roles;
DROP POLICY IF EXISTS roles_delete ON roles;
DROP POLICY IF EXISTS roles_select ON roles;

-- 5. YENİ POLİTİKALARI OLUŞTUR

-- SELECT: Herkes rolları görebilir
CREATE POLICY roles_select ON roles
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Sadece Admin ve Super Admin yeni rol oluşturabilir
CREATE POLICY roles_insert ON roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND r.name IN ('Admin', 'Super Admin')
  )
);

-- UPDATE: Sadece Admin ve Super Admin rol güncelleyebilir
CREATE POLICY roles_update ON roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND r.name IN ('Admin', 'Super Admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND r.name IN ('Admin', 'Super Admin')
  )
);

-- DELETE: Sadece Admin ve Super Admin rol silebilir (sistem rolleri hariç)
CREATE POLICY roles_delete ON roles
FOR DELETE
TO authenticated
USING (
  is_system_role = false
  AND EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND r.name IN ('Admin', 'Super Admin')
  )
);

-- 6. RLS'nin aktif olduğunu kontrol et
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'roles';

-- Eğer RLS aktif değilse, aktif et:
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 7. Yeni politikaları kontrol et
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY cmd, policyname;

-- 8. Success message
SELECT '✅ roles tablosu RLS politikaları düzeltildi!' as message;
SELECT 'Sadece Admin ve Super Admin rol oluşturabilir/düzenleyebilir' as note;

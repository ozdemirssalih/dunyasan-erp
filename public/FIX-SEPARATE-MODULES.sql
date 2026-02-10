-- Tüm rollerdeki eksik modülleri ekle (quality_control, projects, customers ayrı olmalı)

-- 1. ÖNCE KONTROL: Hangi rollerde hangi modüller var?
SELECT
    name,
    CASE WHEN permissions ? 'production' THEN '✅' ELSE '❌' END as production,
    CASE WHEN permissions ? 'quality_control' THEN '✅' ELSE '❌' END as quality_control,
    CASE WHEN permissions ? 'projects' THEN '✅' ELSE '❌' END as projects,
    CASE WHEN permissions ? 'customers' THEN '✅' ELSE '❌' END as customers,
    CASE WHEN permissions ? 'planning' THEN '✅' ELSE '❌' END as planning
FROM roles
ORDER BY name;

-- 2. TÜM ROLLERE EKSİK MODÜLLERİ EKLE
-- Her rolde yoksa quality_control, projects, customers modüllerini ekle

UPDATE roles
SET permissions = permissions ||
    jsonb_build_object(
        'quality_control', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false),
        'projects', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false),
        'customers', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    )
WHERE
    NOT (permissions ? 'quality_control')
    OR NOT (permissions ? 'projects')
    OR NOT (permissions ? 'customers');

-- 3. KONTROL: Şimdi tüm modüller var mı?
SELECT
    name,
    CASE WHEN permissions ? 'production' THEN '✅' ELSE '❌' END as production,
    CASE WHEN permissions ? 'quality_control' THEN '✅' ELSE '❌' END as quality_control,
    CASE WHEN permissions ? 'projects' THEN '✅' ELSE '❌' END as projects,
    CASE WHEN permissions ? 'customers' THEN '✅' ELSE '❌' END as customers
FROM roles
ORDER BY name;

-- 4. ÖNEMLİ: Eğer bir rolde "production" view: true ise ama quality_control, projects, customers false ise
-- Bu doğru ayrışma demektir. Kontrol edelim:
SELECT
    name,
    permissions->'production'->>'view' as production_view,
    permissions->'quality_control'->>'view' as quality_control_view,
    permissions->'projects'->>'view' as projects_view,
    permissions->'customers'->>'view' as customers_view
FROM roles
WHERE permissions->'production'->>'view' = 'true'
ORDER BY name;

-- 5. Success message
SELECT '✅ Tüm rollere quality_control, projects, customers modülleri eklendi!' as message;
SELECT 'Artık bu modüller ayrı olarak yönetilebilir' as note;

-- Mevcut rollerdeki permissions yapısını kontrol et

-- 1. Tüm rolleri ve permissions yapısını göster
SELECT
    id,
    name,
    description,
    is_system_role,
    jsonb_pretty(permissions) as permissions_structure
FROM roles
ORDER BY name;

-- 2. Hangi rollerde hangi modüller var?
SELECT
    name as role_name,
    jsonb_object_keys(permissions) as module_name
FROM roles
ORDER BY name, module_name;

-- 3. Üretim modülünde hangi izinler var?
SELECT
    name as role_name,
    permissions->'production' as production_permissions,
    permissions->'quality_control' as quality_control_permissions,
    permissions->'projects' as projects_permissions,
    permissions->'customers' as customers_permissions
FROM roles
WHERE permissions ? 'production'
ORDER BY name;

-- 4. Herhangi bir rolde kalite kontrol, müşteriler veya projeler üretim içinde mi?
SELECT
    name,
    CASE
        WHEN permissions->'production' ? 'quality_control' THEN '❌ SORUN: quality_control üretim içinde'
        WHEN permissions->'production' ? 'customers' THEN '❌ SORUN: customers üretim içinde'
        WHEN permissions->'production' ? 'projects' THEN '❌ SORUN: projects üretim içinde'
        ELSE '✅ OK: Ayrı modüller olarak var'
    END as durum
FROM roles;

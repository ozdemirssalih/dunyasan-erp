-- =============================================
-- WAREHOUSE TRIGGERS KONTROLÜ
-- =============================================
-- warehouse_transactions tablosunda trigger var mı kontrol eder
-- =============================================

-- Tüm trigger'ları listele
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table IN ('warehouse_transactions', 'warehouse_items', 'qc_to_warehouse_transfers')
ORDER BY event_object_table, trigger_name;

-- Detaylı trigger tanımlarını göster
SELECT
    n.nspname as schema_name,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('warehouse_transactions', 'warehouse_items', 'qc_to_warehouse_transfers')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

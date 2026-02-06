-- =====================================================
-- WAREHOUSE TRANSACTION TRIGGER KONTROLÜ
-- =====================================================

-- Mevcut trigger'ları kontrol et
SELECT 'WAREHOUSE_TRANSACTIONS TRIGGERS:' as bilgi;

SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'warehouse_transactions';

-- warehouse_transactions trigger fonksiyonlarını kontrol et
SELECT 'WAREHOUSE TRIGGER FUNCTIONS:' as bilgi;

SELECT
    proname as function_name,
    prosrc as source_code
FROM pg_proc
WHERE proname LIKE '%warehouse%transaction%'
   OR proname LIKE '%update%warehouse%stock%';

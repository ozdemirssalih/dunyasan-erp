-- Production inventory verilerini kontrol et

SELECT
    pi.id,
    pi.item_id,
    pi.category as production_category,
    pi.item_type,
    pi.current_stock,
    wi.code as warehouse_code,
    wi.name as warehouse_name,
    wi.category as warehouse_category
FROM production_inventory pi
LEFT JOIN warehouse_items wi ON pi.item_id = wi.id
ORDER BY pi.created_at DESC
LIMIT 10;

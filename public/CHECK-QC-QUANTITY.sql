-- KK deposundaki toplam adet
SELECT
    COUNT(*) as urun_cesit_sayisi,
    SUM(quantity) as toplam_adet
FROM quality_control_inventory;

-- Detaylı liste
SELECT
    id,
    item_id,
    quantity,
    status,
    created_at
FROM quality_control_inventory
ORDER BY created_at DESC;

-- 18 Mayıs tarihli TÜM çek izlerini sil

-- Kasa kayıtları (CHKOUT ve CHECK referanslı)
DELETE FROM cash_transactions
WHERE created_at >= '2026-05-18T00:00:00'
  AND created_at < '2026-05-19T00:00:00'
  AND (reference_number LIKE 'CHKOUT-%' OR reference_number LIKE 'CHECK-%' OR payment_method = 'check');

-- Cari hesap kayıtları (CHK referanslı)
DELETE FROM current_account_transactions
WHERE created_at >= '2026-05-18T00:00:00'
  AND created_at < '2026-05-19T00:00:00'
  AND (reference_number LIKE 'CHK-%' OR description LIKE '%çek%' OR description LIKE '%Çek%');

-- Çekler
DELETE FROM checks
WHERE created_at >= '2026-05-18T00:00:00'
  AND created_at < '2026-05-19T00:00:00';

SELECT '18 Mayıs tarihli tüm çek izleri silindi!' as mesaj;

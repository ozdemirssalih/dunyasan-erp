-- 18 Mayıs tarihli tüm çekleri ve ilgili kasa kayıtlarını sil
DELETE FROM cash_transactions
WHERE reference_number LIKE 'CHKOUT-%'
  AND created_at >= '2026-05-18T00:00:00'
  AND created_at < '2026-05-19T00:00:00';

DELETE FROM checks
WHERE created_at >= '2026-05-18T00:00:00'
  AND created_at < '2026-05-19T00:00:00';

SELECT '18 Mayıs tarihli tüm çekler ve kasa kayıtları silindi!' as mesaj;

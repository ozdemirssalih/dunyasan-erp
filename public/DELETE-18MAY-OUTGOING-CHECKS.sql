DELETE FROM cash_transactions
WHERE reference_number LIKE 'CHKOUT-%'
  AND transaction_date >= '2026-05-18T00:00:00'
  AND transaction_date < '2026-05-19T00:00:00';
SELECT 'sadece 18.05.2026 giden çek kayıtları silindi!' as mesaj;

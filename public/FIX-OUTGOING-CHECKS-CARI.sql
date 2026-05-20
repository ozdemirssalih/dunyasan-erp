-- Mevcut giden çekleri cariye + olarak yansıt
-- Daha önce yansıtılmamış olanları ekler
INSERT INTO cash_transactions (company_id, transaction_type, amount, currency, payment_method, transaction_date, description, reference_number, supplier_id, created_by)
SELECT
  c.company_id,
  'expense',
  c.amount,
  c.currency,
  'check',
  c.check_date,
  'Giden çek: ' || c.check_number,
  'CHKOUT-' || c.check_number,
  c.supplier_id,
  c.created_by
FROM checks c
WHERE c.check_type = 'outgoing'
  AND c.supplier_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cash_transactions ct
    WHERE ct.reference_number = 'CHKOUT-' || c.check_number
    AND ct.company_id = c.company_id
  );

SELECT 'Mevcut giden çekler cariye yansıtıldı!' as mesaj;

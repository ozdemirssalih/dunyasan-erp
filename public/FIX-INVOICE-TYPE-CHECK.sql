-- invoice_type check constraint güncelle - gr ekle
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('sales', 'purchase', 'gr', 'expense_invoice', 'incoming_return', 'outgoing_return', 'withholding', 'exempt', 'purchase_fx', 'sales_fx'));
SELECT 'invoice_type constraint güncellendi!' as mesaj;

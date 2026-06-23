-- Giden çeklerin cariye yansıtılan kayıtlarını geri al
DELETE FROM cash_transactions WHERE reference_number LIKE 'CHKOUT-%';
SELECT 'Giden çek cari kayıtları silindi!' as mesaj;

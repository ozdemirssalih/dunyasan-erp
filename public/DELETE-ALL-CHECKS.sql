-- Tüm çek kayıtlarını sil
DELETE FROM checks WHERE TRUE;

-- Çeklerle ilgili cari kayıtları da sil (CHK- referansıyla başlayanlar)
DELETE FROM current_account_transactions WHERE reference_number LIKE 'CHK-%';

-- Çeklerle ilgili kasa kayıtlarını da sil
DELETE FROM cash_transactions WHERE payment_method = 'check';

SELECT 'Tüm çek kayıtları silindi!' as mesaj;

-- =============================================
-- MUHASEBE VE CARİ HESAPLARI SIFIRLA
-- =============================================
-- TÜM İŞLEMLER SİLİNECEK - DİKKATLİ KULLANIN!
-- =============================================

-- 1. FATURA KALEMLERİNİ SİL (önce bağımlı kayıtlar)
DELETE FROM invoice_items;

-- 2. FATURALARI SİL
DELETE FROM invoices;

-- 3. HESAP TRANSFERLERİNİ SİL
DELETE FROM account_transfers;

-- 4. MUHASEBE İŞLEMLERİNİ SİL
DELETE FROM accounting_transactions;

-- 5. NAKİT İŞLEMLERİNİ SİL
DELETE FROM cash_transactions;

-- 6. CARİ HESAP İŞLEMLERİNİ SİL
DELETE FROM current_account_transactions;

-- 7. KASA/BANKA BAKİYELERİNİ SIFIRLA
UPDATE payment_accounts
SET current_balance = 0,
    updated_at = NOW();

-- 8. CARİ HESAP BAKİYELERİNİ SIFIRLA
UPDATE current_accounts
SET current_balance = 0,
    updated_at = NOW();

-- İşlem tamamlandı mesajı
SELECT
    '✅ Muhasebe ve Cari Hesaplar Sıfırlandı!' as message,
    (SELECT COUNT(*) FROM cash_transactions) as kasa_islemleri,
    (SELECT COUNT(*) FROM current_account_transactions) as cari_islemleri,
    (SELECT COUNT(*) FROM invoices) as faturalar,
    (SELECT COUNT(*) FROM accounting_transactions) as muhasebe_islemleri,
    (SELECT SUM(current_balance) FROM payment_accounts) as kasa_banka_bakiyesi,
    (SELECT SUM(current_balance) FROM current_accounts) as cari_bakiyesi;

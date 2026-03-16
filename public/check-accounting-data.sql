-- =============================================
-- MUHASEBEdeki VERİLERİ KONTROL ET
-- =============================================

-- 1. Tüm cari işlemleri göster (RLS bypass için admin olarak)
SELECT
    id,
    company_id,
    transaction_type,
    customer_id,
    supplier_id,
    amount,
    currency,
    status,
    transaction_date,
    description,
    reference_number,
    created_at,
    created_by
FROM current_account_transactions
ORDER BY created_at DESC
LIMIT 20;

-- 2. Toplam kayıt sayısı
SELECT
    COUNT(*) as toplam_cari_islem,
    COUNT(CASE WHEN transaction_type = 'receivable' THEN 1 END) as alacak_sayisi,
    COUNT(CASE WHEN transaction_type = 'payable' THEN 1 END) as borc_sayisi
FROM current_account_transactions;

-- 3. Kasa işlemleri
SELECT
    id,
    company_id,
    transaction_type,
    customer_id,
    supplier_id,
    amount,
    currency,
    transaction_date,
    description,
    reference_number,
    created_at
FROM cash_transactions
ORDER BY created_at DESC
LIMIT 20;

-- 4. Toplam kasa işlemi
SELECT
    COUNT(*) as toplam_kasa_islem,
    COUNT(CASE WHEN transaction_type = 'income' THEN 1 END) as gelir_sayisi,
    COUNT(CASE WHEN transaction_type = 'expense' THEN 1 END) as gider_sayisi
FROM cash_transactions;

-- 5. RLS Politikalarını kontrol et
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('current_account_transactions', 'cash_transactions')
ORDER BY tablename, policyname;

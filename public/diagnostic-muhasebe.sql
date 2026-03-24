-- ============================================
-- MUHASEBE SİSTEMİ DİAGNOSTİK SORGUSU
-- ============================================
-- Bu sorgu mevcut durumu gösterir
-- ============================================

-- 1. current_account_transactions tablosu var mı?
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'current_account_transactions'
) as table_exists;

-- 2. Sütunları listele
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'current_account_transactions'
ORDER BY ordinal_position;

-- 3. Constraint'leri göster
SELECT
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'current_account_transactions';

-- 4. Mevcut kayıt sayısı
SELECT
    COUNT(*) as toplam_kayit,
    COUNT(DISTINCT customer_id) as musteri_sayisi,
    COUNT(DISTINCT supplier_id) as tedarikci_sayisi
FROM current_account_transactions;

-- 5. Transaction type dağılımı
SELECT
    transaction_type,
    COUNT(*) as adet,
    SUM(amount) as toplam_tutar
FROM current_account_transactions
GROUP BY transaction_type;

-- 6. Son 5 kayıt
SELECT
    id,
    transaction_type,
    customer_id,
    supplier_id,
    amount,
    currency,
    transaction_date,
    description,
    reference_number,
    created_at
FROM current_account_transactions
ORDER BY created_at DESC
LIMIT 5;

-- 7. RLS Politikaları
SELECT
    polname as policy_name,
    polcmd as command,
    polpermissive as permissive
FROM pg_policy
WHERE polrelid = 'current_account_transactions'::regclass;

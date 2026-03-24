-- ============================================
-- MUHASEBE ŞEMASI DÜZELTMESİ
-- ============================================
-- Problem: current_account_transactions tablosunda
-- transaction_type için 'debit'/'credit' CHECK constraint var
-- ama kod 'receivable'/'payable' kullanıyor
-- ============================================

-- 1. Mevcut constraint'i kaldır
ALTER TABLE current_account_transactions
DROP CONSTRAINT IF EXISTS current_account_transactions_transaction_type_check;

-- 2. Yeni constraint ekle (receivable/payable)
ALTER TABLE current_account_transactions
ADD CONSTRAINT current_account_transactions_transaction_type_check
CHECK (transaction_type IN ('receivable', 'payable'));

-- 3. due_date'i nullable yap (zorunlu değil)
ALTER TABLE current_account_transactions
ALTER COLUMN due_date DROP NOT NULL;

-- 4. Mevcut verileri kontrol et
SELECT
    transaction_type,
    COUNT(*) as count
FROM current_account_transactions
GROUP BY transaction_type;

-- 5. Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ MUHASEBE ŞEMASI DÜZELTİLDİ!';
    RAISE NOTICE '';
    RAISE NOTICE 'Değişiklikler:';
    RAISE NOTICE '1. transaction_type: debit/credit → receivable/payable';
    RAISE NOTICE '2. due_date: NOT NULL → NULL (opsiyonel)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık faturalar cariye düşebilir!';
END $$;

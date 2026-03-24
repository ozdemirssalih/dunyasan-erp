-- ============================================
-- TEMİZ MUHASEBE SİSTEMİ - SIFIRDAN
-- ============================================
-- Tarih: 2026-03-24
-- Amaç: Tüm muhasebe tablolarını sıfırdan temiz oluştur
-- ============================================

-- Önce tüm eski tabloları temizle
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS current_account_transactions CASCADE;
DROP TABLE IF EXISTS accounting_categories CASCADE;
DROP TABLE IF EXISTS checks CASCADE;

-- ============================================
-- 1. CARİ HESAP İŞLEMLERİ
-- ============================================
-- Müşterilerden alacaklarımız ve tedarikçilere borçlarımız

CREATE TABLE current_account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- İşlem türü: receivable (alacak) veya payable (borç)
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('receivable', 'payable')),

    -- Müşteri VEYA tedarikçi (ikisi birden olamaz)
    customer_id UUID,
    supplier_id UUID,
    CHECK (
        (transaction_type = 'receivable' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (transaction_type = 'payable' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    ),

    -- Tutar bilgileri
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'TRY' NOT NULL,

    -- Tarihler (due_date opsiyonel)
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NULL,

    -- Referans bilgileri
    description TEXT,
    reference_number VARCHAR(100),  -- Fatura numarası, irsaliye no, vb.

    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- İndeksler
CREATE INDEX idx_current_account_company ON current_account_transactions(company_id);
CREATE INDEX idx_current_account_customer ON current_account_transactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_current_account_supplier ON current_account_transactions(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_current_account_type ON current_account_transactions(transaction_type);
CREATE INDEX idx_current_account_date ON current_account_transactions(transaction_date DESC);
CREATE INDEX idx_current_account_reference ON current_account_transactions(reference_number) WHERE reference_number IS NOT NULL;

-- ============================================
-- 2. KASA İŞLEMLERİ
-- ============================================
-- Gerçekleşen ödemeler ve tahsilatlar

CREATE TABLE cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- İşlem türü: income (tahsilat) veya expense (ödeme)
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('income', 'expense')),

    -- Kimden/Kime (opsiyonel - direkt kasa işlemi de olabilir)
    customer_id UUID,
    supplier_id UUID,

    -- Tutar
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'TRY' NOT NULL,

    -- Ödeme yöntemi
    payment_method VARCHAR(20) DEFAULT 'cash'
        CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),

    -- Tarih
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Referans
    description TEXT,
    reference_number VARCHAR(100),

    -- Hangi cari işlemi için (opsiyonel)
    related_transaction_id UUID REFERENCES current_account_transactions(id) ON DELETE SET NULL,

    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- İndeksler
CREATE INDEX idx_cash_company ON cash_transactions(company_id);
CREATE INDEX idx_cash_customer ON cash_transactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_cash_supplier ON cash_transactions(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_cash_type ON cash_transactions(transaction_type);
CREATE INDEX idx_cash_date ON cash_transactions(transaction_date DESC);
CREATE INDEX idx_cash_related ON cash_transactions(related_transaction_id) WHERE related_transaction_id IS NOT NULL;

-- ============================================
-- 3. ÇEK TAKİP
-- ============================================
CREATE TABLE checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- Çek bilgileri
    check_number VARCHAR(100) NOT NULL,
    check_type VARCHAR(20) NOT NULL CHECK (check_type IN ('incoming', 'outgoing')),

    -- Tutar
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'TRY' NOT NULL,

    -- Tarihler
    check_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Kimden/Kime
    customer_id UUID,
    supplier_id UUID,
    CHECK (
        (check_type = 'incoming' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (check_type = 'outgoing' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    ),

    -- Durum
    status VARCHAR(20) DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'collected', 'paid', 'bounced', 'cancelled')),

    -- Belge
    document_url TEXT,
    description TEXT,

    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- İndeksler
CREATE INDEX idx_checks_company ON checks(company_id);
CREATE INDEX idx_checks_customer ON checks(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_checks_supplier ON checks(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_checks_type ON checks(check_type);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_due_date ON checks(due_date);

-- ============================================
-- 4. RLS POLİTİKALARI
-- ============================================

-- Current Account Transactions
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view their current account transactions"
ON current_account_transactions FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can insert their current account transactions"
ON current_account_transactions FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can update their current account transactions"
ON current_account_transactions FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can delete their current account transactions"
ON current_account_transactions FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Cash Transactions
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view their cash transactions"
ON cash_transactions FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can insert their cash transactions"
ON cash_transactions FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can update their cash transactions"
ON cash_transactions FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can delete their cash transactions"
ON cash_transactions FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Checks
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view their checks"
ON checks FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can insert their checks"
ON checks FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can update their checks"
ON checks FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company users can delete their checks"
ON checks FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- 5. YORUMLAR
-- ============================================

COMMENT ON TABLE current_account_transactions IS 'Cari hesap alacak/borç kayıtları - Faturalardan otomatik oluşur';
COMMENT ON TABLE cash_transactions IS 'Kasa işlemleri - Gerçekleşen ödemeler ve tahsilatlar';
COMMENT ON TABLE checks IS 'Çek takip sistemi - Alınan ve verilen çekler';

COMMENT ON COLUMN current_account_transactions.transaction_type IS 'receivable: müşteriden alacağımız | payable: tedarikçiye borcumuz';
COMMENT ON COLUMN current_account_transactions.due_date IS 'Vade tarihi (opsiyonel)';

COMMENT ON COLUMN cash_transactions.transaction_type IS 'income: tahsilat (gelen para) | expense: ödeme (giden para)';
COMMENT ON COLUMN cash_transactions.related_transaction_id IS 'Hangi cari hesap işlemini kapatıyor (opsiyonel)';

COMMENT ON COLUMN checks.check_type IS 'incoming: alınan çek | outgoing: verilen çek';
COMMENT ON COLUMN checks.status IS 'pending: beklemede | collected: tahsil edildi | paid: ödendi | bounced: karşılıksız | cancelled: iptal';

-- ============================================
-- ✅ BAŞARI MESAJI
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TEMİZ MUHASEBE SİSTEMİ OLUŞTURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Oluşturulan Tablolar:';
    RAISE NOTICE '  1. current_account_transactions';
    RAISE NOTICE '  2. cash_transactions';
    RAISE NOTICE '  3. checks';
    RAISE NOTICE '';
    RAISE NOTICE 'Özellikler:';
    RAISE NOTICE '  ✓ Temiz şema (receivable/payable)';
    RAISE NOTICE '  ✓ due_date nullable';
    RAISE NOTICE '  ✓ Güçlü constraint''ler';
    RAISE NOTICE '  ✓ Optimize edilmiş indeksler';
    RAISE NOTICE '  ✓ RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık faturalar cariye düşebilir!';
    RAISE NOTICE '========================================';
END $$;

-- =============================================
-- TEK CARİ HESAP SİSTEMİ - UNIFIED CURRENT ACCOUNTS
-- =============================================
-- Tüm müşteri ve tedarikçiler tek listede
-- Faturalar otomatik olarak cari hesaba işlenir
-- 8 Fatura Türü:
--   1. sales (+)           : Satış Faturası
--   2. purchase (-)        : Alış Faturası
--   3. incoming_return (-) : Gelen İade (müşteriden)
--   4. outgoing_return (+) : Giden İade (tedarikçiye)
--   5. withholding (-)     : Tevkifatlı Fatura
--   6. exempt (-)          : İstisna Fatura
--   7. purchase_fx (-)     : Alış Kur Farkı
--   8. sales_fx (+)        : Satış Kur Farkı
-- =============================================

-- ========================================
-- ADIM 1: YENİ TABLOLARI OLUŞTUR
-- ========================================

-- 1.1: CARİ HESAPLAR (TEK LİSTE - Müşteri + Tedarikçi)
CREATE TABLE IF NOT EXISTS current_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Temel Bilgiler
    account_code VARCHAR(50) NOT NULL, -- CA-0001, CA-0002...
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('customer', 'supplier', 'both')),

    -- Vergi Bilgileri
    tax_number VARCHAR(50),
    tax_office VARCHAR(255),

    -- İletişim
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    contact_person VARCHAR(255),

    -- Finansal
    opening_balance DECIMAL(15,2) DEFAULT 0, -- Açılış bakiyesi
    current_balance DECIMAL(15,2) DEFAULT 0, -- Güncel bakiye (alacak+ / borç-)
    currency VARCHAR(3) DEFAULT 'TL',
    credit_limit DECIMAL(15,2),
    payment_term_days INTEGER DEFAULT 0,

    -- Notlar ve Durum
    notes TEXT,
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(company_id, account_code)
);

CREATE INDEX idx_current_accounts_company ON current_accounts(company_id);
CREATE INDEX idx_current_accounts_type ON current_accounts(account_type);
CREATE INDEX idx_current_accounts_balance ON current_accounts(current_balance);

COMMENT ON TABLE current_accounts IS 'Tek cari hesap sistemi - tüm müşteri ve tedarikçiler';
COMMENT ON COLUMN current_accounts.current_balance IS 'Pozitif=Alacak, Negatif=Borç';

-- 1.2: CARİ HESAP HAREKETLERİ (İşlemler)
CREATE TABLE IF NOT EXISTS current_account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES current_accounts(id) ON DELETE CASCADE,

    -- İşlem Detayları
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'sales',            -- Satış Faturası (+)
        'purchase',         -- Alış Faturası (-)
        'incoming_return',  -- Gelen İade (-)
        'outgoing_return',  -- Giden İade (+)
        'withholding',      -- Tevkifatlı Fatura (-)
        'exempt',           -- İstisna Fatura (-)
        'purchase_fx',      -- Alış Kur Farkı (-)
        'sales_fx',         -- Satış Kur Farkı (+)
        'payment',          -- Ödeme
        'receipt',          -- Tahsilat
        'manual'            -- Manuel İşlem
    )),

    direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
    -- debit  = borç  (-)
    -- credit = alacak (+)

    -- Tutar Bilgileri
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TL',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    amount_tl DECIMAL(15,2) GENERATED ALWAYS AS (amount * exchange_rate) STORED,

    -- Bağlantılar
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    waybill_id UUID REFERENCES waybills(id) ON DELETE SET NULL,
    payment_id UUID, -- Ödeme/Tahsilat ID (gelecekte payment tablosu)

    -- Açıklama ve Tarih
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE, -- Vade tarihi (opsiyonel)

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    CHECK (amount > 0)
);

CREATE INDEX idx_ca_transactions_company ON current_account_transactions(company_id);
CREATE INDEX idx_ca_transactions_account ON current_account_transactions(account_id);
CREATE INDEX idx_ca_transactions_type ON current_account_transactions(transaction_type);
CREATE INDEX idx_ca_transactions_date ON current_account_transactions(transaction_date);
CREATE INDEX idx_ca_transactions_invoice ON current_account_transactions(invoice_id);

COMMENT ON TABLE current_account_transactions IS 'Cari hesap işlem kayıtları';
COMMENT ON COLUMN current_account_transactions.direction IS 'debit=borç(-), credit=alacak(+)';

-- ========================================
-- ADIM 2: MEVCUT VERİLERİ MIGRATE ET
-- ========================================

-- 2.1: Tedarikçileri (suppliers) cari hesaba taşı
INSERT INTO current_accounts (
    company_id, account_code, account_name, account_type,
    tax_number, tax_office, address, phone, email, contact_person,
    opening_balance, current_balance, currency, payment_term_days, notes,
    is_active, created_at, created_by
)
SELECT
    company_id,
    'CA-S-' || LPAD(ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at)::TEXT, 4, '0') as account_code,
    company_name as account_name,
    'supplier' as account_type,
    tax_number,
    tax_office,
    address,
    phone,
    email,
    contact_person,
    0 as opening_balance,
    0 as current_balance,
    'TL' as currency,
    payment_term_days,
    notes,
    is_active,
    created_at,
    NULL as created_by
FROM suppliers
WHERE NOT EXISTS (
    SELECT 1 FROM current_accounts ca
    WHERE ca.company_id = suppliers.company_id
    AND ca.tax_number = suppliers.tax_number
);

-- 2.2: Müşterileri (customers) cari hesaba taşı
INSERT INTO current_accounts (
    company_id, account_code, account_name, account_type,
    tax_number, tax_office, address, phone, email, contact_person,
    opening_balance, current_balance, currency, payment_term_days, notes,
    is_active, created_at, created_by
)
SELECT
    company_id,
    'CA-C-' || LPAD(ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at)::TEXT, 4, '0') as account_code,
    company_name as account_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.company_id = customers.company_id
            AND s.tax_number = customers.tax_number
        ) THEN 'both'
        ELSE 'customer'
    END as account_type,
    tax_number,
    tax_office,
    address,
    phone,
    email,
    contact_person,
    0 as opening_balance,
    0 as current_balance,
    'TL' as currency,
    payment_term_days,
    notes,
    is_active,
    created_at,
    NULL as created_by
FROM customers
WHERE NOT EXISTS (
    SELECT 1 FROM current_accounts ca
    WHERE ca.company_id = customers.company_id
    AND ca.tax_number = customers.tax_number
);

-- 2.3: Hem müşteri hem tedarikçi olanları güncelle
UPDATE current_accounts ca
SET account_type = 'both'
WHERE EXISTS (
    SELECT 1 FROM suppliers s
    WHERE s.company_id = ca.company_id
    AND s.tax_number = ca.tax_number
    AND ca.account_type = 'customer'
)
AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.company_id = ca.company_id
    AND c.tax_number = ca.tax_number
    AND ca.account_type = 'supplier'
);

-- ========================================
-- ADIM 3: INVOICES TABLOSUNU GENİŞLET
-- ========================================

-- 3.1: Yeni invoice_type değerleri ekle
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
    CHECK (invoice_type IN (
        'sales',            -- Satış Faturası
        'purchase',         -- Alış Faturası
        'incoming_return',  -- Gelen İade
        'outgoing_return',  -- Giden İade
        'withholding',      -- Tevkifatlı Fatura
        'exempt',           -- İstisna Fatura
        'purchase_fx',      -- Alış Kur Farkı
        'sales_fx'          -- Satış Kur Farkı
    ));

-- 3.2: Cari hesap ID kolonu ekle
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS current_account_id UUID REFERENCES current_accounts(id);

-- 3.3: Mevcut faturaları cari hesaba bağla
-- Satış faturaları -> Müşterilere
UPDATE invoices i
SET current_account_id = ca.id
FROM customers c
JOIN current_accounts ca ON ca.company_id = c.company_id AND ca.tax_number = c.tax_number
WHERE i.invoice_type = 'sales'
AND i.customer_id = c.id
AND i.current_account_id IS NULL;

-- Alış faturaları -> Tedarikçilere
UPDATE invoices i
SET current_account_id = ca.id
FROM suppliers s
JOIN current_accounts ca ON ca.company_id = s.company_id AND ca.tax_number = s.tax_number
WHERE i.invoice_type = 'purchase'
AND i.supplier_id = s.id
AND i.current_account_id IS NULL;

-- ========================================
-- ADIM 4: OTOMATİK TRİGGERLAR OLUŞTUR
-- ========================================

-- 4.1: Fatura eklendiğinde cari hesaba işle
CREATE OR REPLACE FUNCTION process_invoice_to_current_account()
RETURNS TRIGGER AS $$
DECLARE
    v_direction VARCHAR(10);
BEGIN
    -- Fatura türüne göre yön belirle
    v_direction := CASE NEW.invoice_type
        WHEN 'sales' THEN 'credit'           -- Satış: Alacak (+)
        WHEN 'purchase' THEN 'debit'         -- Alış: Borç (-)
        WHEN 'incoming_return' THEN 'debit'  -- Gelen İade: Borç (-)
        WHEN 'outgoing_return' THEN 'credit' -- Giden İade: Alacak (+)
        WHEN 'withholding' THEN 'debit'      -- Tevkifatlı: Borç (-)
        WHEN 'exempt' THEN 'debit'           -- İstisna: Borç (-)
        WHEN 'purchase_fx' THEN 'debit'      -- Alış Kur Farkı: Borç (-)
        WHEN 'sales_fx' THEN 'credit'        -- Satış Kur Farkı: Alacak (+)
        ELSE 'debit'
    END;

    -- Cari hesap hareket kaydı oluştur (sadece current_account_id varsa)
    IF NEW.current_account_id IS NOT NULL THEN
        INSERT INTO current_account_transactions (
            company_id, account_id, transaction_type, direction,
            amount, currency, exchange_rate,
            invoice_id, description, transaction_date, due_date,
            created_by
        ) VALUES (
            NEW.company_id,
            NEW.current_account_id,
            NEW.invoice_type,
            v_direction,
            NEW.total_amount,
            NEW.currency,
            COALESCE(NEW.exchange_rate, 1),
            NEW.id,
            'Fatura No: ' || NEW.invoice_number,
            NEW.invoice_date,
            NEW.due_date,
            NEW.created_by
        );

        -- Cari hesap bakiyesini güncelle
        UPDATE current_accounts
        SET
            current_balance = current_balance +
                CASE v_direction
                    WHEN 'credit' THEN (NEW.total_amount * COALESCE(NEW.exchange_rate, 1))
                    WHEN 'debit' THEN -(NEW.total_amount * COALESCE(NEW.exchange_rate, 1))
                END,
            updated_at = NOW()
        WHERE id = NEW.current_account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı bağla
DROP TRIGGER IF EXISTS trigger_invoice_to_current_account ON invoices;
CREATE TRIGGER trigger_invoice_to_current_account
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION process_invoice_to_current_account();

-- 4.2: Cari hesap hareketleri eklendiğinde bakiyeyi güncelle
CREATE OR REPLACE FUNCTION update_current_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Manuel işlemler için bakiye güncelle
    IF NEW.transaction_type = 'manual' THEN
        UPDATE current_accounts
        SET
            current_balance = current_balance +
                CASE NEW.direction
                    WHEN 'credit' THEN NEW.amount_tl
                    WHEN 'debit' THEN -NEW.amount_tl
                END,
            updated_at = NOW()
        WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ca_balance ON current_account_transactions;
CREATE TRIGGER trigger_update_ca_balance
    AFTER INSERT ON current_account_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_current_account_balance();

-- ========================================
-- ADIM 5: YARDIMCI FONKSİYONLAR
-- ========================================

-- 5.1: Cari hesap bakiyesi hesapla (doğrulama için)
CREATE OR REPLACE FUNCTION calculate_current_account_balance(p_account_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_balance DECIMAL(15,2);
BEGIN
    SELECT
        COALESCE(SUM(
            CASE direction
                WHEN 'credit' THEN amount_tl
                WHEN 'debit' THEN -amount_tl
            END
        ), 0)
    INTO v_balance
    FROM current_account_transactions
    WHERE account_id = p_account_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- 5.2: Cari hesap özeti
CREATE OR REPLACE FUNCTION get_current_account_summary(p_company_id UUID)
RETURNS TABLE (
    total_accounts BIGINT,
    total_receivables DECIMAL(15,2),
    total_payables DECIMAL(15,2),
    net_balance DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_accounts,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as total_receivables,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) as total_payables,
        COALESCE(SUM(current_balance), 0) as net_balance
    FROM current_accounts
    WHERE company_id = p_company_id
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ADIM 6: RLS POLİCY (Row Level Security)
-- ========================================

ALTER TABLE current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi şirketlerinin verilerini görebilir
CREATE POLICY current_accounts_company_isolation ON current_accounts
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM user_companies
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY ca_transactions_company_isolation ON current_account_transactions
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM user_companies
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- ADIM 7: BAKİYELERİ YENİDEN HESAPLA
-- ========================================

-- Tüm cari hesapların bakiyelerini yeniden hesapla
UPDATE current_accounts ca
SET current_balance = calculate_current_account_balance(ca.id),
    updated_at = NOW();

-- ========================================
-- BAŞARILI!
-- ========================================

SELECT '✅ TEK CARİ HESAP SİSTEMİ KURULDU!' as message;
SELECT '📊 Toplam Cari Hesap: ' || COUNT(*)::TEXT FROM current_accounts;
SELECT '💰 Toplam İşlem: ' || COUNT(*)::TEXT FROM current_account_transactions;
SELECT '📄 8 Fatura Türü Aktif!' as invoice_types;

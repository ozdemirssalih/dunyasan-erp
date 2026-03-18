-- =============================================
-- CARİ HESAPLAR SİSTEMİ - SON DÜZELTME
-- =============================================
-- Mevcut yapıyı bozmadan tüm eksikleri tamamla
-- =============================================

-- ========================================
-- ADIM 1: current_accounts tablosunu güncelle
-- ========================================

-- Eksik kolonları ekle
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS account_code VARCHAR(50);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS tax_office VARCHAR(255);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TL';
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 0;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS created_by UUID;

-- Referans kolonları (eski sistemle uyumluluk için)
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS supplier_id UUID;

-- Constraint ekle
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'current_accounts_account_type_check') THEN
        ALTER TABLE current_accounts ADD CONSTRAINT current_accounts_account_type_check
        CHECK (account_type IN ('customer', 'supplier', 'both'));
    END IF;
END $$;

-- Index'ler
DROP INDEX IF EXISTS idx_current_accounts_company;
DROP INDEX IF EXISTS idx_current_accounts_type;
DROP INDEX IF EXISTS idx_current_accounts_balance;
DROP INDEX IF EXISTS idx_current_accounts_code;
DROP INDEX IF EXISTS idx_current_accounts_customer;
DROP INDEX IF EXISTS idx_current_accounts_supplier;

CREATE INDEX idx_current_accounts_company ON current_accounts(company_id);
CREATE INDEX idx_current_accounts_type ON current_accounts(account_type);
CREATE INDEX idx_current_accounts_balance ON current_accounts(current_balance);
CREATE INDEX idx_current_accounts_code ON current_accounts(account_code);
CREATE INDEX idx_current_accounts_customer ON current_accounts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_current_accounts_supplier ON current_accounts(supplier_id) WHERE supplier_id IS NOT NULL;

-- ========================================
-- ADIM 2: Mevcut customers ve suppliers'dan cari hesap oluştur
-- ========================================

-- Müşteriler için (eğer current_accounts'ta yoksa)
INSERT INTO current_accounts (
    company_id, account_code, account_name, account_type,
    tax_number, tax_office, address, phone, email, contact_person,
    current_balance, currency, payment_term_days, notes,
    is_active, created_at, customer_id
)
SELECT DISTINCT
    c.company_id,
    'CA-C-' || LPAD(c.id::TEXT, 6, '0') as account_code,
    c.customer_name as account_name,
    'customer' as account_type,
    c.tax_number,
    c.tax_office,
    c.address,
    c.phone,
    c.email,
    c.contact_person,
    0 as current_balance,
    'TL' as currency,
    COALESCE(c.payment_term_days, 0),
    c.notes,
    COALESCE(c.is_active, true),
    COALESCE(c.created_at, NOW()),
    c.id as customer_id
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM current_accounts ca
    WHERE ca.customer_id = c.id
);

-- Tedarikçiler için (eğer current_accounts'ta yoksa)
INSERT INTO current_accounts (
    company_id, account_code, account_name, account_type,
    tax_number, tax_office, address, phone, email, contact_person,
    current_balance, currency, payment_term_days, notes,
    is_active, created_at, supplier_id
)
SELECT DISTINCT
    s.company_id,
    'CA-S-' || LPAD(s.id::TEXT, 6, '0') as account_code,
    s.company_name as account_name,
    'supplier' as account_type,
    s.tax_number,
    s.tax_office,
    s.address,
    s.phone,
    s.email,
    s.contact_person,
    0 as current_balance,
    'TL' as currency,
    COALESCE(s.payment_term_days, 0),
    s.notes,
    COALESCE(s.is_active, true),
    COALESCE(s.created_at, NOW()),
    s.id as supplier_id
FROM suppliers s
WHERE NOT EXISTS (
    SELECT 1 FROM current_accounts ca
    WHERE ca.supplier_id = s.id
);

-- Hem müşteri hem tedarikçi olanları 'both' yap
UPDATE current_accounts ca
SET account_type = 'both'
WHERE customer_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM current_accounts ca2
    WHERE ca2.supplier_id IS NOT NULL
    AND ca2.company_id = ca.company_id
    AND (
        ca2.tax_number = ca.tax_number OR
        ca2.account_name = ca.account_name
    )
);

-- Eksik account_code'ları doldur
UPDATE current_accounts
SET account_code = 'CA-' || LPAD(id::TEXT, 8, '0')
WHERE account_code IS NULL OR account_code = '';

-- Eksik account_name'leri doldur
UPDATE current_accounts
SET account_name = 'Cari Hesap ' || account_code
WHERE account_name IS NULL OR account_name = '';

-- Eksik account_type'ları doldur
UPDATE current_accounts
SET account_type = CASE
    WHEN customer_id IS NOT NULL AND supplier_id IS NOT NULL THEN 'both'
    WHEN customer_id IS NOT NULL THEN 'customer'
    WHEN supplier_id IS NOT NULL THEN 'supplier'
    ELSE 'customer'
END
WHERE account_type IS NULL;

-- ========================================
-- ADIM 3: current_account_transactions tablosunu güncelle
-- ========================================

-- Eksik kolonları ekle
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(30);
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS direction VARCHAR(10);
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2);
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TL';
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4) DEFAULT 1;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS waybill_id UUID;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS payment_id UUID;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE current_account_transactions ADD COLUMN IF NOT EXISTS due_date DATE;

-- amount_tl generated column ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'current_account_transactions'
        AND column_name = 'amount_tl'
    ) THEN
        ALTER TABLE current_account_transactions
        ADD COLUMN amount_tl DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(amount, 0) * COALESCE(exchange_rate, 1)) STORED;
    END IF;
END $$;

-- Foreign key constraint'ler
DO $$
BEGIN
    -- account_id FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cat_account_id_fkey') THEN
        ALTER TABLE current_account_transactions
        ADD CONSTRAINT cat_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES current_accounts(id) ON DELETE CASCADE;
    END IF;

    -- invoice_id FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cat_invoice_id_fkey') THEN
        ALTER TABLE current_account_transactions
        ADD CONSTRAINT cat_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
    END IF;

    -- waybill_id FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cat_waybill_id_fkey') THEN
        ALTER TABLE current_account_transactions
        ADD CONSTRAINT cat_waybill_id_fkey
        FOREIGN KEY (waybill_id) REFERENCES waybills(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Check constraint'ler
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cat_transaction_type_check') THEN
        ALTER TABLE current_account_transactions
        ADD CONSTRAINT cat_transaction_type_check
        CHECK (transaction_type IN (
            'sales', 'purchase', 'incoming_return', 'outgoing_return',
            'withholding', 'exempt', 'purchase_fx', 'sales_fx',
            'payment', 'receipt', 'manual', 'receivable', 'payable'
        ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cat_direction_check') THEN
        ALTER TABLE current_account_transactions
        ADD CONSTRAINT cat_direction_check
        CHECK (direction IN ('debit', 'credit'));
    END IF;
END $$;

-- Index'ler
DROP INDEX IF EXISTS idx_cat_company;
DROP INDEX IF EXISTS idx_cat_account;
DROP INDEX IF EXISTS idx_cat_type;
DROP INDEX IF EXISTS idx_cat_date;
DROP INDEX IF EXISTS idx_cat_invoice;

CREATE INDEX idx_cat_company ON current_account_transactions(company_id);
CREATE INDEX idx_cat_account ON current_account_transactions(account_id);
CREATE INDEX idx_cat_type ON current_account_transactions(transaction_type);
CREATE INDEX idx_cat_date ON current_account_transactions(transaction_date);
CREATE INDEX idx_cat_invoice ON current_account_transactions(invoice_id) WHERE invoice_id IS NOT NULL;

-- ========================================
-- ADIM 4: Mevcut transaction'ları account_id'ye bağla
-- ========================================

-- customer_id'den account_id bul
UPDATE current_account_transactions cat
SET account_id = ca.id
FROM current_accounts ca
WHERE cat.account_id IS NULL
AND cat.customer_id IS NOT NULL
AND ca.customer_id = cat.customer_id;

-- supplier_id'den account_id bul
UPDATE current_account_transactions cat
SET account_id = ca.id
FROM current_accounts ca
WHERE cat.account_id IS NULL
AND cat.supplier_id IS NOT NULL
AND ca.supplier_id = cat.supplier_id;

-- Eksik transaction_type'ları doldur
UPDATE current_account_transactions
SET transaction_type = CASE
    WHEN transaction_type IN ('receivable', 'payable') THEN transaction_type
    WHEN customer_id IS NOT NULL THEN 'receipt'
    WHEN supplier_id IS NOT NULL THEN 'payment'
    ELSE 'manual'
END
WHERE transaction_type IS NULL OR transaction_type = '';

-- Eksik direction'ları doldur
UPDATE current_account_transactions
SET direction = CASE
    WHEN transaction_type IN ('sales', 'outgoing_return', 'sales_fx', 'receipt', 'receivable') THEN 'credit'
    WHEN transaction_type IN ('purchase', 'incoming_return', 'withholding', 'exempt', 'purchase_fx', 'payment', 'payable') THEN 'debit'
    WHEN customer_id IS NOT NULL THEN 'credit'
    WHEN supplier_id IS NOT NULL THEN 'debit'
    ELSE 'debit'
END
WHERE direction IS NULL OR direction = '';

-- Eksik amount'ları doldur (paid_amount'tan veya 0)
UPDATE current_account_transactions
SET amount = COALESCE(paid_amount, 0)
WHERE amount IS NULL;

-- ========================================
-- ADIM 5: invoices tablosunu güncelle
-- ========================================

-- current_account_id kolonu ekle
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS current_account_id UUID;

-- invoice_type constraint'i güncelle
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
    CHECK (invoice_type IN (
        'sales', 'purchase', 'incoming_return', 'outgoing_return',
        'withholding', 'exempt', 'purchase_fx', 'sales_fx'
    ));

-- Mevcut faturaları current_accounts'a bağla
-- Satış faturaları (customer_id'den)
UPDATE invoices i
SET current_account_id = ca.id
FROM current_accounts ca
WHERE i.current_account_id IS NULL
AND i.invoice_type IN ('sales', 'outgoing_return', 'sales_fx')
AND i.customer_id IS NOT NULL
AND ca.customer_id = i.customer_id;

-- Alış faturaları (supplier_id'den)
UPDATE invoices i
SET current_account_id = ca.id
FROM current_accounts ca
WHERE i.current_account_id IS NULL
AND i.invoice_type IN ('purchase', 'incoming_return', 'withholding', 'exempt', 'purchase_fx')
AND i.supplier_id IS NOT NULL
AND ca.supplier_id = i.supplier_id;

-- ========================================
-- ADIM 6: RLS Policy'leri
-- ========================================

ALTER TABLE current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS current_accounts_company_isolation ON current_accounts;
DROP POLICY IF EXISTS ca_transactions_company_isolation ON current_account_transactions;

CREATE POLICY current_accounts_company_isolation ON current_accounts
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    );

CREATE POLICY ca_transactions_company_isolation ON current_account_transactions
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- ADIM 7: Trigger Fonksiyonları
-- ========================================

-- Fatura eklendiğinde cari hesaba işle
CREATE OR REPLACE FUNCTION process_invoice_to_current_account()
RETURNS TRIGGER AS $$
DECLARE
    v_direction VARCHAR(10);
BEGIN
    -- Fatura türüne göre yön belirle
    v_direction := CASE NEW.invoice_type
        WHEN 'sales' THEN 'credit'
        WHEN 'purchase' THEN 'debit'
        WHEN 'incoming_return' THEN 'debit'
        WHEN 'outgoing_return' THEN 'credit'
        WHEN 'withholding' THEN 'debit'
        WHEN 'exempt' THEN 'debit'
        WHEN 'purchase_fx' THEN 'debit'
        WHEN 'sales_fx' THEN 'credit'
        ELSE 'debit'
    END;

    -- Cari hesap hareket kaydı oluştur
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
            COALESCE(NEW.currency, 'TL'),
            COALESCE(NEW.exchange_rate, 1),
            NEW.id,
            'Fatura No: ' || NEW.invoice_number,
            NEW.invoice_date,
            NEW.due_date,
            NEW.created_by
        );

        -- Bakiye güncelle
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

DROP TRIGGER IF EXISTS trigger_invoice_to_current_account ON invoices;
CREATE TRIGGER trigger_invoice_to_current_account
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION process_invoice_to_current_account();

-- ========================================
-- ADIM 8: Yardımcı Fonksiyonlar
-- ========================================

CREATE OR REPLACE FUNCTION calculate_current_account_balance(p_account_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_balance DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(
        CASE direction
            WHEN 'credit' THEN COALESCE(amount_tl, amount * COALESCE(exchange_rate, 1))
            WHEN 'debit' THEN -COALESCE(amount_tl, amount * COALESCE(exchange_rate, 1))
        END
    ), 0)
    INTO v_balance
    FROM current_account_transactions
    WHERE account_id = p_account_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- BAŞARILI!
-- ========================================

SELECT '✅ CARİ HESAPLAR SİSTEMİ KURULDU!' as message;
SELECT '📊 Toplam Cari Hesap: ' || COUNT(*)::TEXT as info FROM current_accounts;
SELECT '💰 Toplam İşlem: ' || COUNT(*)::TEXT as info FROM current_account_transactions;

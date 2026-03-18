-- =============================================
-- CARİ HESAPLAR TABLOSUNU GÜNCELLEMEYİ DÜZELT
-- =============================================
-- Mevcut tabloyu koruyarak eksik kolonları ekle
-- =============================================

-- ADIM 1: Eksik kolonları ekle
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
ALTER TABLE current_accounts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ADIM 2: Constraint ekle (eğer yoksa)
DO $$
BEGIN
    -- account_type check constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'current_accounts_account_type_check'
    ) THEN
        ALTER TABLE current_accounts
        ADD CONSTRAINT current_accounts_account_type_check
        CHECK (account_type IN ('customer', 'supplier', 'both'));
    END IF;
END $$;

-- ADIM 3: Index'leri oluştur
DROP INDEX IF EXISTS idx_current_accounts_company;
DROP INDEX IF EXISTS idx_current_accounts_type;
DROP INDEX IF EXISTS idx_current_accounts_balance;
DROP INDEX IF EXISTS idx_current_accounts_code;

CREATE INDEX idx_current_accounts_company ON current_accounts(company_id);
CREATE INDEX idx_current_accounts_type ON current_accounts(account_type);
CREATE INDEX idx_current_accounts_balance ON current_accounts(current_balance);
CREATE INDEX idx_current_accounts_code ON current_accounts(account_code);

-- ADIM 4: current_account_transactions tablosunu kontrol et ve oluştur
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

    -- Tutar Bilgileri
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TL',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    amount_tl DECIMAL(15,2) GENERATED ALWAYS AS (amount * exchange_rate) STORED,

    -- Bağlantılar
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    waybill_id UUID REFERENCES waybills(id) ON DELETE SET NULL,
    payment_id UUID,

    -- Açıklama ve Tarih
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    CHECK (amount > 0)
);

-- Index'ler
DROP INDEX IF EXISTS idx_ca_transactions_company;
DROP INDEX IF EXISTS idx_ca_transactions_account;
DROP INDEX IF EXISTS idx_ca_transactions_type;
DROP INDEX IF EXISTS idx_ca_transactions_date;
DROP INDEX IF EXISTS idx_ca_transactions_invoice;

CREATE INDEX idx_ca_transactions_company ON current_account_transactions(company_id);
CREATE INDEX idx_ca_transactions_account ON current_account_transactions(account_id);
CREATE INDEX idx_ca_transactions_type ON current_account_transactions(transaction_type);
CREATE INDEX idx_ca_transactions_date ON current_account_transactions(transaction_date);
CREATE INDEX idx_ca_transactions_invoice ON current_account_transactions(invoice_id);

-- ADIM 5: Mevcut verilerden account_type'ı belirle
-- Eğer customer_id varsa customer, supplier_id varsa supplier
UPDATE current_accounts ca
SET account_type = CASE
    WHEN ca.customer_id IS NOT NULL AND ca.supplier_id IS NOT NULL THEN 'both'
    WHEN ca.customer_id IS NOT NULL THEN 'customer'
    WHEN ca.supplier_id IS NOT NULL THEN 'supplier'
    ELSE 'customer' -- default
END
WHERE account_type IS NULL;

-- ADIM 6: account_code oluştur (eğer yoksa)
UPDATE current_accounts
SET account_code = 'CA-' || LPAD(ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at)::TEXT, 4, '0')
WHERE account_code IS NULL OR account_code = '';

-- ADIM 7: account_name oluştur (eğer yoksa)
-- customer_name veya supplier_name'den al
UPDATE current_accounts ca
SET account_name = COALESCE(
    (SELECT customer_name FROM customers c WHERE c.id = ca.customer_id LIMIT 1),
    (SELECT company_name FROM suppliers s WHERE s.id = ca.supplier_id LIMIT 1),
    'Tanımsız Cari'
)
WHERE account_name IS NULL OR account_name = '';

-- ADIM 8: invoices tablosunu güncelle
-- invoice_type constraint'i güncelle
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
    CHECK (invoice_type IN (
        'sales',
        'purchase',
        'incoming_return',
        'outgoing_return',
        'withholding',
        'exempt',
        'purchase_fx',
        'sales_fx'
    ));

-- current_account_id kolonu ekle (eğer yoksa)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS current_account_id UUID REFERENCES current_accounts(id);

-- Mevcut faturaları cari hesaba bağla
-- Satış faturaları
UPDATE invoices i
SET current_account_id = ca.id
FROM current_accounts ca
WHERE i.invoice_type IN ('sales', 'outgoing_return', 'sales_fx')
AND i.customer_id IS NOT NULL
AND ca.customer_id = i.customer_id
AND i.current_account_id IS NULL;

-- Alış faturaları
UPDATE invoices i
SET current_account_id = ca.id
FROM current_accounts ca
WHERE i.invoice_type IN ('purchase', 'incoming_return', 'withholding', 'exempt', 'purchase_fx')
AND i.supplier_id IS NOT NULL
AND ca.supplier_id = i.supplier_id
AND i.current_account_id IS NULL;

-- ADIM 9: RLS Policy
ALTER TABLE current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS current_accounts_company_isolation ON current_accounts;
DROP POLICY IF EXISTS ca_transactions_company_isolation ON current_account_transactions;

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

-- ADIM 10: Trigger fonksiyonları
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

SELECT '✅ CARİ HESAPLAR TABLOSU GÜNCELLENDİ!' as message;
SELECT '📊 Toplam Cari Hesap: ' || COUNT(*)::TEXT FROM current_accounts;

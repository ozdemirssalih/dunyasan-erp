-- ========================================
-- MUHASEBE TABLOLARINI SİL VE YENİDEN OLUŞTUR
-- ========================================

-- Önce tüm tabloları sil (CASCADE ile bağlantılı veriler de silinir)
DROP TABLE IF EXISTS account_transfers CASCADE;
DROP TABLE IF EXISTS accounting_transactions CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS current_accounts CASCADE;
DROP TABLE IF EXISTS payment_accounts CASCADE;
DROP TABLE IF EXISTS accounting_categories CASCADE;

-- ========================================
-- TABLOLARI YENİDEN OLUŞTUR
-- ========================================

-- 1️⃣ GELİR/GİDER KATEGORİLERİ
CREATE TABLE accounting_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ KASA/BANKA HESAPLARI
CREATE TABLE payment_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank')),
    currency TEXT DEFAULT 'TRY',
    current_balance DECIMAL(15,2) DEFAULT 0,
    bank_name TEXT,
    iban TEXT,
    account_number TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3️⃣ CARİ HESAPLAR
CREATE TABLE current_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    tax_office TEXT,
    tax_number TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- 4️⃣ FATURALAR
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('purchase', 'sales')),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'TRY',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, invoice_number)
);

-- 5️⃣ FATURA KALEMLERİ
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_code TEXT,
    description TEXT,
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT DEFAULT 'adet',
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 20,
    discount_rate DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6️⃣ MUHASEBE İŞLEMLERİ
CREATE TABLE accounting_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7️⃣ TRANSFER İŞLEMLERİ
CREATE TABLE account_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
    to_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    reference_number TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- İNDEXLER
-- ========================================

CREATE INDEX idx_accounting_transactions_company ON accounting_transactions(company_id);
CREATE INDEX idx_accounting_transactions_date ON accounting_transactions(transaction_date);
CREATE INDEX idx_accounting_transactions_type ON accounting_transactions(transaction_type);

CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_status ON invoices(payment_status);

CREATE INDEX idx_current_accounts_company ON current_accounts(company_id);
CREATE INDEX idx_current_accounts_type ON current_accounts(type);

CREATE INDEX idx_payment_accounts_company ON payment_accounts(company_id);

-- ========================================
-- BAŞARI MESAJI
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ MUHASEBE TABLOLARI OLUŞTURULDU!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 7 Tablo:';
    RAISE NOTICE '   1. accounting_categories';
    RAISE NOTICE '   2. payment_accounts';
    RAISE NOTICE '   3. current_accounts';
    RAISE NOTICE '   4. invoices';
    RAISE NOTICE '   5. invoice_items';
    RAISE NOTICE '   6. accounting_transactions';
    RAISE NOTICE '   7. account_transfers';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Hazır!';
    RAISE NOTICE '';
END $$;

-- ========================================
-- MUHASEBE MODÜLÜ - VERİTABANI TABLOLARI
-- ========================================

-- 1️⃣ GELİR/GİDER KATEGORİLERİ
CREATE TABLE IF NOT EXISTS accounting_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')), -- gelir / gider
    description TEXT,
    icon TEXT, -- İkon adı (opsiyonel)
    color TEXT, -- Renk kodu (opsiyonel)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ KASA/BANKA HESAPLARI
CREATE TABLE IF NOT EXISTS payment_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank')), -- kasa / banka
    currency TEXT DEFAULT 'TRY',
    current_balance DECIMAL(15,2) DEFAULT 0,
    bank_name TEXT, -- Banka adı (bank için)
    iban TEXT, -- IBAN (bank için)
    account_number TEXT, -- Hesap No
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3️⃣ CARİ HESAPLAR (Müşteri/Tedarikçi)
CREATE TABLE IF NOT EXISTS current_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')), -- müşteri / tedarikçi
    code TEXT NOT NULL, -- Cari kodu
    name TEXT NOT NULL, -- Firma/Kişi adı
    tax_office TEXT,
    tax_number TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    credit_limit DECIMAL(15,2) DEFAULT 0, -- Kredi limiti
    current_balance DECIMAL(15,2) DEFAULT 0, -- Güncel bakiye (+alacak, -borç)
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- 4️⃣ FATURALAR
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('purchase', 'sales')), -- alış / satış
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE, -- Vade tarihi
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,
    subtotal DECIMAL(15,2) DEFAULT 0, -- Ara toplam
    tax_amount DECIMAL(15,2) DEFAULT 0, -- KDV tutarı
    discount_amount DECIMAL(15,2) DEFAULT 0, -- İndirim
    total_amount DECIMAL(15,2) DEFAULT 0, -- Genel toplam
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')), -- bekliyor / kısmi / ödendi
    paid_amount DECIMAL(15,2) DEFAULT 0, -- Ödenen tutar
    currency TEXT DEFAULT 'TRY',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, invoice_number)
);

-- 5️⃣ FATURA KALEMLERİ
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_code TEXT,
    description TEXT,
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT DEFAULT 'adet',
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 20, -- KDV oranı (%)
    discount_rate DECIMAL(5,2) DEFAULT 0, -- İndirim oranı (%)
    line_total DECIMAL(15,2) NOT NULL, -- Satır toplamı
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6️⃣ MUHASEBE İŞLEMLERİ (Ana kayıt tablosu)
CREATE TABLE IF NOT EXISTS accounting_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')), -- gelir / gider / transfer
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number TEXT, -- Referans no (dekont, fiş no vb)
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7️⃣ TRANSFER İŞLEMLERİ (Kasa/Banka arası transfer)
CREATE TABLE IF NOT EXISTS account_transfers (
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
-- İNDEXLER (Performans için)
-- ========================================

CREATE INDEX IF NOT EXISTS idx_accounting_transactions_company ON accounting_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_transactions_date ON accounting_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounting_transactions_type ON accounting_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_current_accounts_company ON current_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_current_accounts_type ON current_accounts(type);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_company ON payment_accounts(company_id);

-- ========================================
-- VARSAYILAN KATEGORİLER
-- ========================================

-- Not: Company-specific kategoriler, her şirket için otomatik oluşturulacak
-- Şimdilik manuel ekleme yapılacak

-- ========================================
-- BAŞARI MESAJI
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ MUHASEBE MODÜLÜ TABLOLARI OLUŞTURULDU!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Oluşturulan Tablolar:';
    RAISE NOTICE '   1. accounting_categories - Gelir/Gider kategorileri';
    RAISE NOTICE '   2. payment_accounts - Kasa/Banka hesapları';
    RAISE NOTICE '   3. current_accounts - Cari hesaplar (Müşteri/Tedarikçi)';
    RAISE NOTICE '   4. invoices - Faturalar';
    RAISE NOTICE '   5. invoice_items - Fatura kalemleri';
    RAISE NOTICE '   6. accounting_transactions - Ana işlem kayıtları';
    RAISE NOTICE '   7. account_transfers - Transfer işlemleri';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Özellikler:';
    RAISE NOTICE '   - Gelir/Gider takibi';
    RAISE NOTICE '   - Fatura yönetimi (Alış/Satış)';
    RAISE NOTICE '   - Cari hesap yönetimi';
    RAISE NOTICE '   - Kasa/Banka hareketleri';
    RAISE NOTICE '   - Transfer işlemleri';
    RAISE NOTICE '';
END $$;

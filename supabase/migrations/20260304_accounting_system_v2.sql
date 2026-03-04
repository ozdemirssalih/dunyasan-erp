-- Önceki tabloları temizle
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS current_account_transactions CASCADE;
DROP TABLE IF EXISTS accounting_categories CASCADE;

-- CARİ HESAP İŞLEMLERİ (Alacak/Borç Kayıtları)
CREATE TABLE current_account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- İşlem türü: alacak (receivable) veya borç (payable)
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receivable', 'payable')),

    -- Müşteri veya tedarikçi
    customer_id UUID,
    supplier_id UUID,

    -- Tutar bilgileri
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    paid_amount DECIMAL(15,2) DEFAULT 0 CHECK (paid_amount >= 0),
    currency VARCHAR(10) DEFAULT 'TRY',

    -- Durum
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),

    -- Tarih bilgileri
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL, -- Vade tarihi zorunlu

    -- Açıklama
    description TEXT,
    reference_number VARCHAR(100),

    -- Kategori
    category_id UUID,

    -- Audit
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KASA İŞLEMLERİ (Sadece gerçekleşen ödemeler)
CREATE TABLE cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- İşlem türü: tahsilat (income) veya ödeme (expense)
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),

    -- Müşteri veya tedarikçi
    customer_id UUID,
    supplier_id UUID,

    -- Tutar bilgileri
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'TRY',

    -- Ödeme yöntemi
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),

    -- Hangi alacak/borcu kapatıyor (opsiyonel - direkt kasa işlemi de olabilir)
    related_account_transaction_id UUID REFERENCES current_account_transactions(id) ON DELETE SET NULL,

    -- Tarih
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Açıklama
    description TEXT,
    reference_number VARCHAR(100),

    -- Kategori
    category_id UUID,

    -- Audit
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MUHASEBE KATEGORİLERİ
CREATE TABLE accounting_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('receivable', 'payable', 'income', 'expense')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name, type)
);

-- İNDEKSLER
-- Current Account Transactions
CREATE INDEX idx_cat_company_id ON current_account_transactions(company_id);
CREATE INDEX idx_cat_customer_id ON current_account_transactions(customer_id);
CREATE INDEX idx_cat_supplier_id ON current_account_transactions(supplier_id);
CREATE INDEX idx_cat_status ON current_account_transactions(status);
CREATE INDEX idx_cat_due_date ON current_account_transactions(due_date);
CREATE INDEX idx_cat_transaction_type ON current_account_transactions(transaction_type);

-- Cash Transactions
CREATE INDEX idx_cash_company_id ON cash_transactions(company_id);
CREATE INDEX idx_cash_customer_id ON cash_transactions(customer_id);
CREATE INDEX idx_cash_supplier_id ON cash_transactions(supplier_id);
CREATE INDEX idx_cash_transaction_date ON cash_transactions(transaction_date);
CREATE INDEX idx_cash_related_transaction ON cash_transactions(related_account_transaction_id);

-- Accounting Categories
CREATE INDEX idx_acc_categories_company_id ON accounting_categories(company_id);
CREATE INDEX idx_acc_categories_type ON accounting_categories(type);

-- RLS POLİTİKALARI
-- Current Account Transactions
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view current account transactions of their company"
ON current_account_transactions FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert current account transactions for their company"
ON current_account_transactions FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update current account transactions of their company"
ON current_account_transactions FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete current account transactions of their company"
ON current_account_transactions FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Cash Transactions
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash transactions of their company"
ON cash_transactions FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cash transactions for their company"
ON cash_transactions FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cash transactions of their company"
ON cash_transactions FOR UPDATE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cash transactions of their company"
ON cash_transactions FOR DELETE
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Accounting Categories
ALTER TABLE accounting_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories from their company" ON accounting_categories
  FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert categories for their company" ON accounting_categories
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update categories from their company" ON accounting_categories
  FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete categories from their company" ON accounting_categories
  FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- YORUMLAR
COMMENT ON TABLE current_account_transactions IS 'Cari hesap alacak/borç kayıtları - Vadeli işlemler';
COMMENT ON TABLE cash_transactions IS 'Kasa işlemleri - Gerçekleşen ödemeler/tahsilatlar';
COMMENT ON TABLE accounting_categories IS 'Muhasebe kategorileri';

COMMENT ON COLUMN current_account_transactions.transaction_type IS 'receivable: alacak (müşteriden), payable: borç (tedarikçiye)';
COMMENT ON COLUMN current_account_transactions.status IS 'unpaid: ödenmemiş, partial: kısmen ödenmiş, paid: ödenmiş';
COMMENT ON COLUMN current_account_transactions.paid_amount IS 'Ne kadar ödenmiş';

COMMENT ON COLUMN cash_transactions.transaction_type IS 'income: tahsilat, expense: ödeme';
COMMENT ON COLUMN cash_transactions.related_account_transaction_id IS 'Hangi cari hesap işlemini kapatıyor';

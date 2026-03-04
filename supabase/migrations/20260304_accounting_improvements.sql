-- Önce current_account_transactions tablosunu oluştur
CREATE TABLE IF NOT EXISTS current_account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,

    -- Cari hesap sahibi (müşteri veya tedarikçi)
    account_type TEXT CHECK (account_type IN ('customer', 'supplier')),
    account_id UUID, -- customer_companies.id veya suppliers.id
    account_name TEXT, -- Hızlı erişim için denormalize

    -- İşlem bilgileri
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')), -- borç/alacak
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'TRY',

    -- Açıklamalar
    description TEXT,
    reference_number TEXT, -- Fatura no, irsaliye no, vb.
    document_type TEXT, -- 'invoice', 'payment', 'manual', 'other'

    -- Tarih ve kullanıcı
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE, -- Vade tarihi
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Yeni alanlar
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),
    customer_id UUID,
    supplier_id UUID,
    category_id UUID
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_cat_company ON current_account_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_account ON current_account_transactions(account_id, account_type);
CREATE INDEX IF NOT EXISTS idx_cat_date ON current_account_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_customer_id ON current_account_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_supplier_id ON current_account_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_payment_method ON current_account_transactions(payment_method);

-- RLS politikaları
ALTER TABLE current_account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transactions of their company" ON current_account_transactions;
CREATE POLICY "Users can view transactions of their company"
    ON current_account_transactions FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert transactions for their company" ON current_account_transactions;
CREATE POLICY "Users can insert transactions for their company"
    ON current_account_transactions FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update transactions of their company" ON current_account_transactions;
CREATE POLICY "Users can update transactions of their company"
    ON current_account_transactions FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete transactions of their company" ON current_account_transactions;
CREATE POLICY "Users can delete transactions of their company"
    ON current_account_transactions FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Muhasebe kategorileri tablosu
CREATE TABLE IF NOT EXISTS accounting_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name, type)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_accounting_categories_company_id ON accounting_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_type ON accounting_categories(type);

-- RLS Politikaları
ALTER TABLE accounting_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories from their company" ON accounting_categories;
CREATE POLICY "Users can view categories from their company" ON accounting_categories
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert categories for their company" ON accounting_categories;
CREATE POLICY "Users can insert categories for their company" ON accounting_categories
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update categories from their company" ON accounting_categories;
CREATE POLICY "Users can update categories from their company" ON accounting_categories
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete categories from their company" ON accounting_categories;
CREATE POLICY "Users can delete categories from their company" ON accounting_categories
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Kategori referansı ekle (tablo oluşturulduktan sonra)
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_category_id ON current_account_transactions(category_id);

-- Varsayılan kategoriler ekle (örnek veriler)
-- Bu kategoriler her şirket için ayrı ayrı oluşturulmalı
-- Aşağıdaki INSERT sadece örnek, gerçek kullanımda uygulama üzerinden eklenecek

COMMENT ON TABLE accounting_categories IS 'Gelir ve gider kategorileri';
COMMENT ON COLUMN current_account_transactions.payment_method IS 'Ödeme yöntemi: nakit, havale, çek, diğer';
COMMENT ON COLUMN current_account_transactions.category_id IS 'İşlem kategorisi';

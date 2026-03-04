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

-- current_account_transactions tablosuna yeni alanlar ekle
ALTER TABLE current_account_transactions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS supplier_id UUID;

-- Yeni indeksler
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_category_id ON current_account_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_payment_method ON current_account_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_customer_id ON current_account_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_current_account_transactions_supplier_id ON current_account_transactions(supplier_id);

-- Varsayılan kategoriler ekle (örnek veriler)
-- Bu kategoriler her şirket için ayrı ayrı oluşturulmalı
-- Aşağıdaki INSERT sadece örnek, gerçek kullanımda uygulama üzerinden eklenecek

COMMENT ON TABLE accounting_categories IS 'Gelir ve gider kategorileri';
COMMENT ON COLUMN current_account_transactions.payment_method IS 'Ödeme yöntemi: nakit, havale, çek, diğer';
COMMENT ON COLUMN current_account_transactions.category_id IS 'İşlem kategorisi';

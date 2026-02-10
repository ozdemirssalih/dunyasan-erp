-- Cari hesap hareketleri tablosu
-- Müşteriler ve tedarikçiler için borç/alacak takibi

CREATE TABLE IF NOT EXISTS current_account_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Cari hesap sahibi (müşteri veya tedarikçi)
    account_type TEXT NOT NULL CHECK (account_type IN ('customer', 'supplier')),
    account_id UUID NOT NULL, -- customer_companies.id veya suppliers.id
    account_name TEXT NOT NULL, -- Hızlı erişim için denormalize

    -- İşlem bilgileri
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')), -- borç/alacak
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'TRY',

    -- Açıklamalar
    description TEXT,
    reference_number TEXT, -- Fatura no, irsaliye no, vb.
    document_type TEXT, -- 'invoice', 'payment', 'other'

    -- Tarih ve kullanıcı
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_cat_company ON current_account_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_account ON current_account_transactions(account_id, account_type);
CREATE INDEX IF NOT EXISTS idx_cat_date ON current_account_transactions(transaction_date DESC);

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

-- Bakiye hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_current_account_balance(
    p_account_id UUID,
    p_account_type TEXT
)
RETURNS DECIMAL(15, 2) LANGUAGE plpgsql AS $$
DECLARE
    v_balance DECIMAL(15, 2);
BEGIN
    SELECT
        COALESCE(
            SUM(CASE
                WHEN transaction_type = 'debit' THEN amount
                WHEN transaction_type = 'credit' THEN -amount
            END),
            0
        )
    INTO v_balance
    FROM current_account_transactions
    WHERE account_id = p_account_id
      AND account_type = p_account_type;

    RETURN v_balance;
END;
$$;

SELECT 'Cari hesaplar tablosu oluşturuldu!' as mesaj;

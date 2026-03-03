-- ================================================================
-- KAPSAMLI MUHASEBE SİSTEMİ (DÜZELTİLMİŞ)
-- ================================================================
-- Özellikler:
-- ✅ Teklif, Sipariş, İrsaliye, Fatura, İade
-- ✅ Nakit, Çek, Senet, Kredi Kartı, EFT ödemeleri
-- ✅ Çek portföyü (Alınan/Verilen çekler, ciro, tahsil)
-- ✅ Senet yönetimi (Alınan/Verilen senetler)
-- ✅ Vade takibi
-- ✅ Kısmi ödeme
-- ✅ KDV hesaplama
-- ✅ Tahsilat/Ödeme yönetimi
-- ================================================================

-- DOĞRU SIRADA TABLOLARI SİL (Bağımlılıkları önce)
DROP TABLE IF EXISTS disbursements CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS payments CASCADE;  -- Önce payments (checks'e bağımlı)
DROP TABLE IF EXISTS document_items CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS promissory_notes CASCADE;
DROP TABLE IF EXISTS checks CASCADE;

-- ================================================================
-- 1. BELGELER (Teklif, Sipariş, İrsaliye, Fatura, İade)
-- ================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,

    -- Belge Tipi
    document_type TEXT NOT NULL CHECK (document_type IN ('quotation', 'order', 'waybill', 'invoice', 'return_invoice', 'proforma')),
    -- quotation: Teklif
    -- order: Sipariş (sales_order veya purchase_order)
    -- waybill: İrsaliye (sevk irsaliyesi)
    -- invoice: Fatura (sales_invoice veya purchase_invoice)
    -- return_invoice: İade Faturası
    -- proforma: Proforma Fatura

    -- Satış mı Alış mı?
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sales', 'purchase')),
    -- sales: Satış (müşteriye)
    -- purchase: Alış (tedarikçiden)

    -- Belge Numarası
    document_series TEXT DEFAULT 'A', -- Seri: A, B, C, vb.
    document_number INTEGER NOT NULL, -- Numara: 1, 2, 3, vb.

    -- Tarihler
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE, -- Vade tarihi (vadeli satışlarda)

    -- Tutarlar
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0, -- Ara toplam (KDV hariç)
    discount_amount DECIMAL(15,2) DEFAULT 0, -- Genel iskonto
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Toplam KDV
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Genel toplam

    -- Ödeme Durumu
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    -- unpaid: Ödenmedi
    -- partial: Kısmi ödendi
    -- paid: Tamamen ödendi

    paid_amount DECIMAL(15,2) DEFAULT 0, -- Ödenen tutar
    remaining_amount DECIMAL(15,2) DEFAULT 0, -- Kalan tutar

    -- Açıklama
    description TEXT,
    notes TEXT,

    -- Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(company_id, document_type, transaction_type, document_series, document_number)
);

CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_current_account ON documents(current_account_id);
CREATE INDEX idx_documents_type ON documents(document_type, transaction_type);
CREATE INDEX idx_documents_date ON documents(document_date);
CREATE INDEX idx_documents_due_date ON documents(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_documents_payment_status ON documents(payment_status);

-- ================================================================
-- 2. BELGE KALEMLERİ
-- ================================================================
CREATE TABLE document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    -- Ürün/Hizmet
    item_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL,
    item_code TEXT, -- Ürün kodu (silinen ürünler için)
    item_name TEXT NOT NULL, -- Ürün adı

    -- Miktar ve Birim
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT DEFAULT 'Adet', -- Birim (Adet, Kg, Litre, vb.)

    -- Fiyat
    unit_price DECIMAL(15,2) NOT NULL,

    -- İskonto
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,

    -- KDV
    tax_percent DECIMAL(5,2) DEFAULT 20, -- KDV oranı (%, örn: 20)
    tax_amount DECIMAL(15,2) DEFAULT 0,

    -- Toplam
    line_total DECIMAL(15,2) NOT NULL, -- Satır toplamı (KDV dahil)

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_items_document ON document_items(document_id);
CREATE INDEX idx_document_items_item ON document_items(item_id);

-- ================================================================
-- 3. ÇEK YÖNETİMİ (Alınan/Verilen Çekler)
-- ================================================================
CREATE TABLE checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Çek Tipi
    check_type TEXT NOT NULL CHECK (check_type IN ('received', 'issued')),
    -- received: Alınan Çek (müşteriden)
    -- issued: Verilen Çek (tedarikçiye)

    -- Cari Hesap
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,

    -- Çek Bilgileri
    check_number TEXT NOT NULL, -- Çek numarası
    bank_name TEXT NOT NULL, -- Banka adı
    branch_name TEXT, -- Şube adı
    branch_code TEXT, -- Şube kodu
    account_number TEXT, -- Hesap numarası

    -- Tarihler
    check_date DATE NOT NULL, -- Çek tarihi
    due_date DATE NOT NULL, -- Vade tarihi

    -- Tutar
    amount DECIMAL(15,2) NOT NULL,

    -- Durum
    status TEXT NOT NULL DEFAULT 'portfolio' CHECK (status IN ('portfolio', 'deposited', 'collected', 'bounced', 'endorsed', 'cancelled')),
    -- portfolio: Portföyde (elde)
    -- deposited: Bankaya verildi
    -- collected: Tahsil edildi
    -- bounced: Karşılıksız çıktı
    -- endorsed: Ciro edildi (başkasına verildi)
    -- cancelled: İptal edildi

    -- Tahsilat/Ödeme hesabı
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,

    -- Tahsilat/Ödeme tarihi
    collection_date DATE,

    -- Ciro bilgisi
    endorsed_to UUID REFERENCES current_accounts(id) ON DELETE SET NULL, -- Kime ciro edildi
    endorsed_date DATE,

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_checks_company ON checks(company_id);
CREATE INDEX idx_checks_type ON checks(check_type);
CREATE INDEX idx_checks_current_account ON checks(current_account_id);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_due_date ON checks(due_date);
CREATE INDEX idx_checks_check_number ON checks(check_number);

-- ================================================================
-- 4. SENET YÖNETİMİ (Alınan/Verilen Senetler)
-- ================================================================
CREATE TABLE promissory_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Senet Tipi
    note_type TEXT NOT NULL CHECK (note_type IN ('received', 'issued')),
    -- received: Alınan Senet (müşteriden)
    -- issued: Verilen Senet (tedarikçiye)

    -- Cari Hesap
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,

    -- Senet Bilgileri
    note_number TEXT NOT NULL, -- Senet numarası

    -- Tarihler
    issue_date DATE NOT NULL, -- Düzenleme tarihi
    due_date DATE NOT NULL, -- Vade tarihi

    -- Tutar
    amount DECIMAL(15,2) NOT NULL,

    -- Durum
    status TEXT NOT NULL DEFAULT 'portfolio' CHECK (status IN ('portfolio', 'collected', 'protested', 'cancelled')),
    -- portfolio: Portföyde
    -- collected: Tahsil edildi
    -- protested: Protesto edildi
    -- cancelled: İptal edildi

    -- Tahsilat hesabı
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,

    -- Tahsilat tarihi
    collection_date DATE,

    -- Yer bilgisi
    place_of_issue TEXT, -- Düzenlendiği yer
    place_of_payment TEXT, -- Ödeme yeri

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_promissory_notes_company ON promissory_notes(company_id);
CREATE INDEX idx_promissory_notes_type ON promissory_notes(note_type);
CREATE INDEX idx_promissory_notes_current_account ON promissory_notes(current_account_id);
CREATE INDEX idx_promissory_notes_status ON promissory_notes(status);
CREATE INDEX idx_promissory_notes_due_date ON promissory_notes(due_date);

-- ================================================================
-- 5. ÖDEMELER (Fatura ödemeleri)
-- ================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- İlişkili Belge
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    -- Cari Hesap
    current_account_id UUID REFERENCES current_accounts(id) ON DELETE SET NULL,

    -- Ödeme Tipi
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'check', 'promissory_note', 'credit_card', 'bank_transfer', 'open_account')),
    -- cash: Nakit/Peşin
    -- check: Çek
    -- promissory_note: Senet
    -- credit_card: Kredi Kartı
    -- bank_transfer: EFT/Havale
    -- open_account: Açık Hesap (Vadeli)

    -- Tarih ve Tutar
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,

    -- Hangi kasa/banka hesabına?
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,

    -- İlişkili Çek/Senet
    check_id UUID REFERENCES checks(id) ON DELETE SET NULL,
    promissory_note_id UUID REFERENCES promissory_notes(id) ON DELETE SET NULL,

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payments_company ON payments(company_id);
CREATE INDEX idx_payments_document ON payments(document_id);
CREATE INDEX idx_payments_current_account ON payments(current_account_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_type ON payments(payment_type);

-- ================================================================
-- 6. TAHSİLAT (Müşteriden para alma)
-- ================================================================
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Müşteri
    current_account_id UUID NOT NULL REFERENCES current_accounts(id) ON DELETE CASCADE,

    -- Ödeme Tipi
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'check', 'promissory_note', 'credit_card', 'bank_transfer')),

    -- Tarih ve Tutar
    collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,

    -- Hangi kasa/bankaya?
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,

    -- İlişkili Çek/Senet
    check_id UUID REFERENCES checks(id) ON DELETE SET NULL,
    promissory_note_id UUID REFERENCES promissory_notes(id) ON DELETE SET NULL,

    -- İlişkili Fatura (varsa)
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_collections_company ON collections(company_id);
CREATE INDEX idx_collections_current_account ON collections(current_account_id);
CREATE INDEX idx_collections_date ON collections(collection_date);
CREATE INDEX idx_collections_type ON collections(payment_type);

-- ================================================================
-- 7. ÖDEME (Tedarikçiye para verme)
-- ================================================================
CREATE TABLE disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Tedarikçi
    current_account_id UUID NOT NULL REFERENCES current_accounts(id) ON DELETE CASCADE,

    -- Ödeme Tipi
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'check', 'promissory_note', 'credit_card', 'bank_transfer')),

    -- Tarih ve Tutar
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,

    -- Hangi kasa/bankadan?
    payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,

    -- İlişkili Çek/Senet
    check_id UUID REFERENCES checks(id) ON DELETE SET NULL,
    promissory_note_id UUID REFERENCES promissory_notes(id) ON DELETE SET NULL,

    -- İlişkili Fatura (varsa)
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

    -- Açıklama
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_disbursements_company ON disbursements(company_id);
CREATE INDEX idx_disbursements_current_account ON disbursements(current_account_id);
CREATE INDEX idx_disbursements_date ON disbursements(payment_date);
CREATE INDEX idx_disbursements_type ON disbursements(payment_type);

-- ================================================================
-- BAŞLANGIÇ VERİLERİ
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ ✅ ✅ KAPSAMLI MUHASEBE SİSTEMİ BAŞARIYLA OLUŞTURULDU! ✅ ✅ ✅';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Oluşturulan Tablolar:';
    RAISE NOTICE '   1. ✅ documents - Teklif, Sipariş, İrsaliye, Fatura, İade';
    RAISE NOTICE '   2. ✅ document_items - Belge kalemleri';
    RAISE NOTICE '   3. ✅ checks - Çek yönetimi (Alınan/Verilen)';
    RAISE NOTICE '   4. ✅ promissory_notes - Senet yönetimi (Alınan/Verilen)';
    RAISE NOTICE '   5. ✅ payments - Ödeme kayıtları';
    RAISE NOTICE '   6. ✅ collections - Tahsilat kayıtları';
    RAISE NOTICE '   7. ✅ disbursements - Ödeme kayıtları';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Özellikler:';
    RAISE NOTICE '   ✅ Teklif, Sipariş, İrsaliye, Fatura, İade';
    RAISE NOTICE '   ✅ Nakit, Çek, Senet, Kredi Kartı, EFT';
    RAISE NOTICE '   ✅ Çek portföyü (Ciro, Tahsil, Karşılıksız)';
    RAISE NOTICE '   ✅ Senet yönetimi (Portföy, Tahsil, Protesto)';
    RAISE NOTICE '   ✅ Vade takibi';
    RAISE NOTICE '   ✅ Kısmi ödeme';
    RAISE NOTICE '   ✅ KDV hesaplama';
    RAISE NOTICE '   ✅ Tahsilat/Ödeme yönetimi';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Artık fatura kesebilir, çek yönetebilirsiniz!';
    RAISE NOTICE '';
    RAISE NOTICE '📍 Sayfalar:';
    RAISE NOTICE '   • /dashboard/accounting/invoices - Fatura Yönetimi';
    RAISE NOTICE '   • /dashboard/accounting/checks - Çek Yönetimi';
    RAISE NOTICE '   • /dashboard/accounting/current-accounts - Cari Hesaplar';
    RAISE NOTICE '';
END $$;

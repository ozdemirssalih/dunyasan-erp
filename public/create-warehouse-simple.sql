-- DÜNYASAN ERP - Depo Modülü (Basitleştirilmiş)
-- Gelen/Giden stok takibi, kategori yönetimi, satın alma talepleri

-- 1. Stok Kategorileri Tablosu
CREATE TABLE IF NOT EXISTS warehouse_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kategorileri ekle
INSERT INTO warehouse_categories (name, description) VALUES
    ('Hammadde', 'Ham madde ve temel üretim malzemeleri'),
    ('Yarı Mamül', 'İşlenmiş ancak henüz tamamlanmamış ürünler'),
    ('Boryağ', 'Boryağ malzemeleri'),
    ('Temizlik Malzemeleri', 'Temizlik ve hijyen malzemeleri'),
    ('Sarf Malzemeleri', 'Tüketim malzemeleri'),
    ('Mamül', 'Bitmiş ürünler'),
    ('Aparat', 'Aparat ve yardımcı ekipmanlar')
ON CONFLICT (name) DO NOTHING;

-- 2. Stok Kalemleri Tablosu
CREATE TABLE IF NOT EXISTS warehouse_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES warehouse_categories(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'adet',
    current_stock DECIMAL(15,3) DEFAULT 0 NOT NULL,
    min_stock DECIMAL(15,3) DEFAULT 0,
    max_stock DECIMAL(15,3),
    unit_price DECIMAL(15,2) DEFAULT 0,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- 3. Birimler/Departmanlar Tablosu
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- Örnek departmanlar ekle
DO $$
BEGIN
    INSERT INTO departments (company_id, name, description)
    SELECT
        c.id,
        'Üretim',
        'Üretim bölümü'
    FROM companies c
    WHERE NOT EXISTS (
        SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Üretim'
    );

    INSERT INTO departments (company_id, name, description)
    SELECT
        c.id,
        d.name,
        d.description
    FROM companies c
    CROSS JOIN (VALUES
        ('Kalite Kontrol', 'Kalite kontrol departmanı'),
        ('Sevkiyat', 'Sevkiyat ve lojistik'),
        ('Bakım-Onarım', 'Bakım ve onarım birimi'),
        ('Ar-Ge', 'Araştırma ve geliştirme')
    ) AS d(name, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM departments WHERE company_id = c.id AND departments.name = d.name
    );
END $$;

-- 4. Stok Hareketleri Tablosu
CREATE TABLE IF NOT EXISTS warehouse_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('entry', 'exit')),
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2),

    -- Giriş için
    supplier TEXT,
    invoice_number TEXT,

    -- Çıkış için
    destination_type TEXT CHECK (destination_type IN ('department', 'shipment', 'waste', 'return')),
    department_id UUID REFERENCES departments(id),
    shipment_destination TEXT,

    -- Ortak
    reference_number TEXT,
    notes TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Satın Alma Talepleri Tablosu
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID REFERENCES warehouse_items(id),
    item_name TEXT NOT NULL,
    category_id UUID REFERENCES warehouse_categories(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
    reason TEXT,
    estimated_price DECIMAL(15,2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'completed', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bildirimler Tablosu
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company ON warehouse_items(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON warehouse_items(category_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_code ON warehouse_items(code);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_item ON warehouse_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_company ON warehouse_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_date ON warehouse_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON purchase_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- RLS Policies
ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Warehouse Categories (Herkes okuyabilir)
DROP POLICY IF EXISTS "Anyone can view warehouse categories" ON warehouse_categories;
CREATE POLICY "Anyone can view warehouse categories" ON warehouse_categories
    FOR SELECT TO authenticated USING (true);

-- Warehouse Items (Şirket bazlı)
DROP POLICY IF EXISTS "Users can view company warehouse items" ON warehouse_items;
CREATE POLICY "Users can view company warehouse items" ON warehouse_items
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company warehouse items" ON warehouse_items;
CREATE POLICY "Users can insert company warehouse items" ON warehouse_items
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update company warehouse items" ON warehouse_items;
CREATE POLICY "Users can update company warehouse items" ON warehouse_items
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete company warehouse items" ON warehouse_items;
CREATE POLICY "Users can delete company warehouse items" ON warehouse_items
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Departments
DROP POLICY IF EXISTS "Users can view company departments" ON departments;
CREATE POLICY "Users can view company departments" ON departments
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Warehouse Transactions
DROP POLICY IF EXISTS "Users can view company warehouse transactions" ON warehouse_transactions;
CREATE POLICY "Users can view company warehouse transactions" ON warehouse_transactions
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company warehouse transactions" ON warehouse_transactions;
CREATE POLICY "Users can insert company warehouse transactions" ON warehouse_transactions
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Purchase Requests
DROP POLICY IF EXISTS "Users can view company purchase requests" ON purchase_requests;
CREATE POLICY "Users can view company purchase requests" ON purchase_requests
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company purchase requests" ON purchase_requests;
CREATE POLICY "Users can insert company purchase requests" ON purchase_requests
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update company purchase requests" ON purchase_requests;
CREATE POLICY "Users can update company purchase requests" ON purchase_requests
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Trigger: Stok güncelleme
CREATE OR REPLACE FUNCTION update_warehouse_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'entry' THEN
        UPDATE warehouse_items
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;
    ELSIF NEW.type = 'exit' THEN
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_warehouse_stock ON warehouse_transactions;
CREATE TRIGGER trigger_update_warehouse_stock
    AFTER INSERT ON warehouse_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_stock();

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Depo modülü başarıyla oluşturuldu!';
    RAISE NOTICE '📦 Kategoriler, stok kalemleri, hareketler ve talep sistemi hazır';
    RAISE NOTICE '🔄 Otomatik stok güncelleme aktif';
END $$;

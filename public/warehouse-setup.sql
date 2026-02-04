-- DÜNYASAN ERP - Depo Modülü
-- Adım adım kurulum

-- 1. Stok Kategorileri
CREATE TABLE IF NOT EXISTS warehouse_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO warehouse_categories (name, description) VALUES
    ('Hammadde', 'Ham madde ve temel üretim malzemeleri'),
    ('Yarı Mamül', 'İşlenmiş ancak henüz tamamlanmamış ürünler'),
    ('Boryağ', 'Boryağ malzemeleri'),
    ('Temizlik Malzemeleri', 'Temizlik ve hijyen malzemeleri'),
    ('Sarf Malzemeleri', 'Tüketim malzemeleri'),
    ('Mamül', 'Bitmiş ürünler'),
    ('Aparat', 'Aparat ve yardımcı ekipmanlar')
ON CONFLICT (name) DO NOTHING;

-- 2. Stok Kalemleri
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

-- 3. Departmanlar
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- 4. Stok Hareketleri
CREATE TABLE IF NOT EXISTS warehouse_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('entry', 'exit')),
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2),
    supplier TEXT,
    invoice_number TEXT,
    destination_type TEXT,
    department_id UUID REFERENCES departments(id),
    shipment_destination TEXT,
    reference_number TEXT,
    notes TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Satın Alma Talepleri
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID REFERENCES warehouse_items(id),
    item_name TEXT NOT NULL,
    category_id UUID REFERENCES warehouse_categories(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'medium',
    reason TEXT,
    estimated_price DECIMAL(15,2),
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bildirimler
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
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_item ON warehouse_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_company ON warehouse_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON purchase_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- RLS Aktif Et
ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "view_categories" ON warehouse_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "view_items" ON warehouse_items FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_items" ON warehouse_items FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "update_items" ON warehouse_items FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "delete_items" ON warehouse_items FOR DELETE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_departments" ON departments FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_transactions" ON warehouse_transactions FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_transactions" ON warehouse_transactions FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_requests" ON purchase_requests FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_requests" ON purchase_requests FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "update_requests" ON purchase_requests FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Departmanları ekle (her şirket için)
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Üretim', 'Üretim bölümü'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Üretim');

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Kalite Kontrol', 'Kalite kontrol departmanı'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Kalite Kontrol');

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Sevkiyat', 'Sevkiyat ve lojistik'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Sevkiyat');

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Bakım-Onarım', 'Bakım ve onarım birimi'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Bakım-Onarım');

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Ar-Ge', 'Araştırma ve geliştirme'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE company_id = c.id AND name = 'Ar-Ge');

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Depo modülü tabloları oluşturuldu!';
    RAISE NOTICE '📦 7 kategori, 5 departman hazır';
    RAISE NOTICE '⚠️ Şimdi trigger SQL dosyasını çalıştırın: warehouse-trigger.sql';
END $$;

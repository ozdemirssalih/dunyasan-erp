-- =====================================================
-- PROFESYONEL PROJE YÖNETİMİ SİSTEMİ
-- =====================================================
-- Müşteriler, Takımlar, Proje İlişkileri
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 PROJE YÖNETİMİ SİSTEMİ KURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 0: PROJECTS TABLOSUNU GÜNCELLE
-- =====================================================
-- Status, code ve description kolonları ekle
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled'));

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS description TEXT;

-- Mevcut projelere kod ata (eğer yoksa)
DO $$
DECLARE
    proj RECORD;
    new_code VARCHAR(50);
    counter INT := 1;
BEGIN
    FOR proj IN SELECT id FROM projects WHERE project_code IS NULL OR project_code = ''
    LOOP
        new_code := 'PRJ-' || LPAD(counter::TEXT, 4, '0');
        UPDATE projects SET project_code = new_code WHERE id = proj.id;
        counter := counter + 1;
    END LOOP;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ 0/7 - Projects tablosu güncellendi (status, code, description)';
END $$;

-- =====================================================
-- ADIM 1: MÜŞTERİLER TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_number VARCHAR(50),
    tax_office VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, customer_code)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

COMMENT ON TABLE customers IS 'Müşteriler';

DO $$
BEGIN
    RAISE NOTICE '✅ 1/7 - Müşteriler tablosu oluşturuldu';
END $$;

-- =====================================================
-- ADIM 2: TAKIMLAR TABLOSU
-- =====================================================
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tool_code VARCHAR(50) NOT NULL,
    tool_name VARCHAR(255) NOT NULL,
    tool_type VARCHAR(100),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'lost')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, tool_code)
);

CREATE INDEX IF NOT EXISTS idx_tools_company ON tools(company_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);

COMMENT ON TABLE tools IS 'Takımlar ve Ekipmanlar';

DO $$
BEGIN
    RAISE NOTICE '✅ 2/7 - Takımlar tablosu oluşturuldu';
END $$;

-- =====================================================
-- ADIM 3: PROJE-MÜŞTERİ İLİŞKİSİ
-- =====================================================
CREATE TABLE IF NOT EXISTS project_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_project_customers_project ON project_customers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_customers_customer ON project_customers(customer_id);

DO $$
BEGIN
    RAISE NOTICE '✅ 3/7 - Proje-Müşteri ilişkisi oluşturuldu';
END $$;

-- =====================================================
-- ADIM 4: PROJE-TEZGAH İLİŞKİSİ
-- =====================================================
CREATE TABLE IF NOT EXISTS project_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(project_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_project_machines_project ON project_machines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_machine ON project_machines(machine_id);

DO $$
BEGIN
    RAISE NOTICE '✅ 4/7 - Proje-Tezgah ilişkisi oluşturuldu';
END $$;

-- =====================================================
-- ADIM 5: PROJE HAMMADDE İHTİYACI
-- =====================================================
CREATE TABLE IF NOT EXISTS project_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity_needed DECIMAL(15,3) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_project_materials_project ON project_materials(project_id);

DO $$
BEGIN
    RAISE NOTICE '✅ 5/7 - Proje Hammaddeler tablosu oluşturuldu';
END $$;

-- =====================================================
-- ADIM 6: PROJE MAMÜL HEDEF
-- =====================================================
CREATE TABLE IF NOT EXISTS project_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity_target DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_produced DECIMAL(15,3) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_project_products_project ON project_products(project_id);

DO $$
BEGIN
    RAISE NOTICE '✅ 6/7 - Proje Mamüller tablosu oluşturuldu';
END $$;

-- =====================================================
-- ADIM 7: PROJE-TAKIM İLİŞKİSİ
-- =====================================================
CREATE TABLE IF NOT EXISTS project_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    returned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(project_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_tool ON project_tools(tool_id);

DO $$
BEGIN
    RAISE NOTICE '✅ 7/7 - Proje-Takım ilişkisi oluşturuldu';
END $$;

-- =====================================================
-- RLS POLİCİES
-- =====================================================

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_all" ON customers;
CREATE POLICY "customers_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tools
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools_all" ON tools;
CREATE POLICY "tools_all" ON tools FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project relations
ALTER TABLE project_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_customers_all" ON project_customers;
CREATE POLICY "project_customers_all" ON project_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_machines_all" ON project_machines;
CREATE POLICY "project_machines_all" ON project_machines FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_materials_all" ON project_materials;
CREATE POLICY "project_materials_all" ON project_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_products_all" ON project_products;
CREATE POLICY "project_products_all" ON project_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_tools_all" ON project_tools;
CREATE POLICY "project_tools_all" ON project_tools FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS politikaları oluşturuldu';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PROJE YÖNETİMİ SİSTEMİ HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Yeni Özellikler:';
    RAISE NOTICE '';
    RAISE NOTICE '👥 Müşteriler:';
    RAISE NOTICE '   • Müşteri tanımlama';
    RAISE NOTICE '   • Projeye müşteri atama';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Takımlar:';
    RAISE NOTICE '   • Takım tanımlama';
    RAISE NOTICE '   • Projeye takım atama';
    RAISE NOTICE '   • Durum takibi (mevcut/kullanımda/bakımda)';
    RAISE NOTICE '';
    RAISE NOTICE '🏭 Proje-Tezgah:';
    RAISE NOTICE '   • Projede hangi tezgahlar çalışıyor';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Proje Hammadde/Mamül:';
    RAISE NOTICE '   • İhtiyaç listesi';
    RAISE NOTICE '   • Hedef miktarlar';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık proje yönetimi profesyonel!';
    RAISE NOTICE '========================================';
END $$;

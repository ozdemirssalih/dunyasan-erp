-- DÜNYASAN ERP - Proje Bazlı Üretim Takip Sistemi
-- Proje yönetimi, parça takibi, operasyonlar, hammadde, takım ve kater yönetimi

-- =====================================================
-- ADIM 1: Müşteri Firmalar Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_customer_companies_company ON customer_companies(company_id);

-- RLS
ALTER TABLE customer_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_companies_select" ON customer_companies;
DROP POLICY IF EXISTS "customer_companies_insert" ON customer_companies;
DROP POLICY IF EXISTS "customer_companies_update" ON customer_companies;
DROP POLICY IF EXISTS "customer_companies_delete" ON customer_companies;

CREATE POLICY "customer_companies_select" ON customer_companies
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "customer_companies_insert" ON customer_companies
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "customer_companies_update" ON customer_companies
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "customer_companies_delete" ON customer_companies
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 2: Projeler Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    customer_company_id UUID REFERENCES customer_companies(id) ON DELETE SET NULL,
    scope_duration INTEGER, -- Gün cinsinden
    start_date DATE NOT NULL,
    end_date DATE, -- Hesaplanan veya manuel
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

CREATE POLICY "projects_select" ON projects
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "projects_insert" ON projects
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "projects_update" ON projects
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "projects_delete" ON projects
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 3: Proje Parçaları Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS project_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_code TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'adet',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_parts_project ON project_parts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_parts_code ON project_parts(part_code);

-- RLS
ALTER TABLE project_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_parts_select" ON project_parts;
DROP POLICY IF EXISTS "project_parts_insert" ON project_parts;
DROP POLICY IF EXISTS "project_parts_update" ON project_parts;
DROP POLICY IF EXISTS "project_parts_delete" ON project_parts;

CREATE POLICY "project_parts_select" ON project_parts
    FOR SELECT TO authenticated
    USING (project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "project_parts_insert" ON project_parts
    FOR INSERT TO authenticated
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "project_parts_update" ON project_parts
    FOR UPDATE TO authenticated
    USING (project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "project_parts_delete" ON project_parts
    FOR DELETE TO authenticated
    USING (project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- =====================================================
-- ADIM 4: Operasyonlar Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS project_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES project_parts(id) ON DELETE CASCADE,
    operation_name TEXT NOT NULL,
    operation_order INTEGER NOT NULL DEFAULT 1,
    machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    estimated_time INTEGER, -- Dakika cinsinden
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_operations_part ON project_operations(part_id);
CREATE INDEX IF NOT EXISTS idx_project_operations_order ON project_operations(operation_order);

-- RLS
ALTER TABLE project_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_operations_select" ON project_operations;
DROP POLICY IF EXISTS "project_operations_insert" ON project_operations;
DROP POLICY IF EXISTS "project_operations_update" ON project_operations;
DROP POLICY IF EXISTS "project_operations_delete" ON project_operations;

CREATE POLICY "project_operations_select" ON project_operations
    FOR SELECT TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_operations_insert" ON project_operations
    FOR INSERT TO authenticated
    WITH CHECK (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_operations_update" ON project_operations
    FOR UPDATE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_operations_delete" ON project_operations
    FOR DELETE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

-- =====================================================
-- ADIM 5: Proje Hammaddeleri Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS project_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES project_parts(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_materials_part ON project_materials(part_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_material ON project_materials(material_id);

-- RLS
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_materials_select" ON project_materials;
DROP POLICY IF EXISTS "project_materials_insert" ON project_materials;
DROP POLICY IF EXISTS "project_materials_update" ON project_materials;
DROP POLICY IF EXISTS "project_materials_delete" ON project_materials;

CREATE POLICY "project_materials_select" ON project_materials
    FOR SELECT TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_materials_insert" ON project_materials
    FOR INSERT TO authenticated
    WITH CHECK (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_materials_update" ON project_materials
    FOR UPDATE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_materials_delete" ON project_materials
    FOR DELETE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

-- =====================================================
-- ADIM 6: Proje Takımları Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS project_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES project_parts(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_code TEXT,
    tool_type TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_tools_part ON project_tools(part_id);

-- RLS
ALTER TABLE project_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_tools_select" ON project_tools;
DROP POLICY IF EXISTS "project_tools_insert" ON project_tools;
DROP POLICY IF EXISTS "project_tools_update" ON project_tools;
DROP POLICY IF EXISTS "project_tools_delete" ON project_tools;

CREATE POLICY "project_tools_select" ON project_tools
    FOR SELECT TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_tools_insert" ON project_tools
    FOR INSERT TO authenticated
    WITH CHECK (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_tools_update" ON project_tools
    FOR UPDATE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_tools_delete" ON project_tools
    FOR DELETE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

-- =====================================================
-- ADIM 7: Proje Katerleri Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS project_cutters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES project_parts(id) ON DELETE CASCADE,
    cutter_name TEXT NOT NULL,
    cutter_code TEXT,
    cutter_type TEXT,
    diameter DECIMAL(10,3),
    diameter_unit TEXT DEFAULT 'mm',
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_cutters_part ON project_cutters(part_id);

-- RLS
ALTER TABLE project_cutters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cutters_select" ON project_cutters;
DROP POLICY IF EXISTS "project_cutters_insert" ON project_cutters;
DROP POLICY IF EXISTS "project_cutters_update" ON project_cutters;
DROP POLICY IF EXISTS "project_cutters_delete" ON project_cutters;

CREATE POLICY "project_cutters_select" ON project_cutters
    FOR SELECT TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_cutters_insert" ON project_cutters
    FOR INSERT TO authenticated
    WITH CHECK (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_cutters_update" ON project_cutters
    FOR UPDATE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

CREATE POLICY "project_cutters_delete" ON project_cutters
    FOR DELETE TO authenticated
    USING (part_id IN (SELECT id FROM project_parts WHERE project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))));

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROJE BAZLI ÜRETİM TAKİP SİSTEMİ KURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '7 Yeni Tablo:';
    RAISE NOTICE '   - customer_companies (Müşteri firmalar)';
    RAISE NOTICE '   - projects (Projeler)';
    RAISE NOTICE '   - project_parts (Proje parçaları)';
    RAISE NOTICE '   - project_operations (Operasyonlar)';
    RAISE NOTICE '   - project_materials (Hammaddeler)';
    RAISE NOTICE '   - project_tools (Takımlar)';
    RAISE NOTICE '   - project_cutters (Katerler)';
    RAISE NOTICE '';
    RAISE NOTICE 'Özellikler:';
    RAISE NOTICE '   - Müşteri bazlı proje yönetimi';
    RAISE NOTICE '   - Parça ve operasyon takibi';
    RAISE NOTICE '   - Hammadde planlama (üretim stoklarından)';
    RAISE NOTICE '   - Takım ve kater yönetimi';
    RAISE NOTICE '   - Proje durum takibi';
    RAISE NOTICE '';
    RAISE NOTICE 'Sistem hazır!';
    RAISE NOTICE '';
END $$;

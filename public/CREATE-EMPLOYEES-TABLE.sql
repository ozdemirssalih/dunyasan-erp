-- PERSONEL YÖNETİMİ SİSTEMİ

-- 1. Personel tablosu
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    hire_date DATE,
    salary DECIMAL(15,2),
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, employee_code)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);

-- RLS Politikaları
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their company's employees" ON employees;
CREATE POLICY "Users can view their company's employees"
    ON employees FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS "Users can create employees" ON employees;
CREATE POLICY "Users can create employees"
    ON employees FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their company's employees" ON employees;
CREATE POLICY "Users can update their company's employees"
    ON employees FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their company's employees" ON employees;
CREATE POLICY "Users can delete their company's employees"
    ON employees FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ PERSONEL YÖNETİM SİSTEMİ HAZIR!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  ✓ employees tablosu oluşturuldu';
    RAISE NOTICE '  ✓ Index''ler eklendi';
    RAISE NOTICE '  ✓ RLS politikaları ayarlandı';
    RAISE NOTICE '';
    RAISE NOTICE 'Özellikler:';
    RAISE NOTICE '  • Personel kodu (benzersiz)';
    RAISE NOTICE '  • Departman ve pozisyon takibi';
    RAISE NOTICE '  • İletişim bilgileri';
    RAISE NOTICE '  • İşe giriş tarihi';
    RAISE NOTICE '  • Aktif/Pasif durum yönetimi';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;

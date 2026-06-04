-- ============================================
-- İNSAN KAYNAKLARI TABLOLARI
-- ============================================

-- 1. İZİN TAKİP TABLOSU
CREATE TABLE IF NOT EXISTS employee_leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_company ON employee_leaves(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_dates ON employee_leaves(start_date, end_date);

ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_leaves_company_access" ON employee_leaves
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 2. AVANS TAKİP TABLOSU
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  installments INT DEFAULT 1,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  remaining_amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'open',
  payment_method VARCHAR(50),
  cash_account_id UUID REFERENCES cash_accounts(id),
  cash_transaction_id UUID REFERENCES cash_transactions(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_advances_employee ON salary_advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_advances_company ON salary_advances(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_advances_status ON salary_advances(status);

ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_advances_company_access" ON salary_advances
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 3. MAAŞ ÖDEME TABLOSU
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  gross_salary DECIMAL(15,2) NOT NULL,
  advance_deduction DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  overtime_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50),
  cash_account_id UUID REFERENCES cash_accounts(id),
  cash_transaction_id UUID REFERENCES cash_transactions(id),
  status VARCHAR(20) DEFAULT 'paid',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_company ON salary_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(period_year, period_month);

ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_payments_company_access" ON salary_payments
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 4. EMPLOYEES tablosuna eksik alanları ekle
ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_leave_days INT DEFAULT 14;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS iban VARCHAR(40);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sgk_number VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS children_count INT DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education_level VARCHAR(50);

SELECT 'IK tablolari basariyla olusturuldu!' as mesaj;

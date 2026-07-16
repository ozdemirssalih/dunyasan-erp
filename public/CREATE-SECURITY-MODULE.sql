-- ============================================================
-- GÜVENLİK MODÜLÜ — Ziyaretçi / Araç / Personel / Kargo
-- ============================================================

-- Ziyaretçi Girişleri
CREATE TABLE IF NOT EXISTS security_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  tc_no VARCHAR(20),
  passport_no VARCHAR(30),
  phone VARCHAR(30),
  visitor_company VARCHAR(200),
  visiting_person VARCHAR(200),
  visiting_department VARCHAR(100),
  purpose TEXT,
  badge_no VARCHAR(50),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  entry_by UUID,
  exit_by UUID,
  kvkk_consent BOOLEAN DEFAULT FALSE,
  photo_url TEXT,
  status VARCHAR(20) DEFAULT 'inside' CHECK (status IN ('inside','left')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Araç Girişleri
CREATE TABLE IF NOT EXISTS security_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(50),
  driver_name VARCHAR(200) NOT NULL,
  driver_tc VARCHAR(20),
  driver_phone VARCHAR(30),
  driver_company VARCHAR(200),
  purpose VARCHAR(200),
  cargo_info TEXT,
  entry_km NUMERIC(10,1),
  exit_km NUMERIC(10,1),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  entry_by UUID,
  exit_by UUID,
  status VARCHAR(20) DEFAULT 'inside' CHECK (status IN ('inside','left')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personel Giriş-Çıkış Logları
CREATE TABLE IF NOT EXISTS security_employee_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  employee_id UUID,
  employee_name VARCHAR(200),
  employee_tc VARCHAR(20),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in','out')),
  log_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(30) DEFAULT 'manual',
  logged_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kargo / Paket Kayıtları
CREATE TABLE IF NOT EXISTS security_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in','out')),
  package_type VARCHAR(50),
  courier_company VARCHAR(100),
  tracking_no VARCHAR(100),
  sender VARCHAR(200),
  receiver VARCHAR(200),
  receiver_department VARCHAR(100),
  description TEXT,
  quantity INT DEFAULT 1,
  weight NUMERIC(8,2),
  received_by UUID,
  received_by_name VARCHAR(200),
  log_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_visitors_company_status ON security_visitors(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_visitors_entry ON security_visitors(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_sec_vehicles_company_status ON security_vehicles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_vehicles_entry ON security_vehicles(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_sec_vehicles_plate ON security_vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_sec_emplog_company ON security_employee_logs(company_id, log_time DESC);
CREATE INDEX IF NOT EXISTS idx_sec_pkg_company ON security_packages(company_id, log_time DESC);

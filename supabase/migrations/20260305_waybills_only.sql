-- Migration: Create waybills (irsaliyeler) table ONLY
-- Date: 2026-03-05
-- Note: Storage policies already exist for accounting-documents bucket

-- Create waybills table
CREATE TABLE IF NOT EXISTS waybills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Waybill details
  waybill_number VARCHAR(50) NOT NULL,
  waybill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  waybill_type VARCHAR(20) NOT NULL CHECK (waybill_type IN ('inbound', 'outbound')),

  -- Relations
  inventory_transaction_id UUID, -- warehouse_transactions tablosu mevcut olmayabilir
  customer_id UUID,
  supplier_id UUID,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- Document
  document_url TEXT, -- PDF irsaliye belgesi (accounting-documents bucket'da)

  -- Additional info
  notes TEXT,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(company_id, waybill_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waybills_company_id ON waybills(company_id);
CREATE INDEX IF NOT EXISTS idx_waybills_status ON waybills(status);
CREATE INDEX IF NOT EXISTS idx_waybills_waybill_type ON waybills(waybill_type);
CREATE INDEX IF NOT EXISTS idx_waybills_waybill_date ON waybills(waybill_date);

-- Enable RLS
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Drop if exists first, then create)
DROP POLICY IF EXISTS "Users can view waybills for their company" ON waybills;
CREATE POLICY "Users can view waybills for their company"
ON waybills
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert waybills for their company" ON waybills;
CREATE POLICY "Users can insert waybills for their company"
ON waybills
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update waybills for their company" ON waybills;
CREATE POLICY "Users can update waybills for their company"
ON waybills
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete waybills for their company" ON waybills;
CREATE POLICY "Users can delete waybills for their company"
ON waybills
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_waybills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waybills_updated_at
BEFORE UPDATE ON waybills
FOR EACH ROW
EXECUTE FUNCTION update_waybills_updated_at();

-- Add comments
COMMENT ON TABLE waybills IS 'Irsaliye (waybill/delivery note) records';
COMMENT ON COLUMN waybills.waybill_number IS 'Unique waybill number within company';
COMMENT ON COLUMN waybills.waybill_type IS 'inbound (giriş) or outbound (çıkış)';
COMMENT ON COLUMN waybills.status IS 'pending (bekliyor), completed (tamamlandı), cancelled (iptal)';
COMMENT ON COLUMN waybills.document_url IS 'Path to PDF waybill document in accounting-documents bucket';

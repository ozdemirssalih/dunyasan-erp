-- Migration: Create waybills (irsaliyeler) table
-- Date: 2026-03-05
-- Description: Waybill/delivery note management system

-- Create waybills table
CREATE TABLE IF NOT EXISTS waybills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Waybill details
  waybill_number VARCHAR(50) NOT NULL,
  waybill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('inbound', 'outbound')),

  -- Relations
  inventory_transaction_id UUID REFERENCES inventory_transactions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customer_companies(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- Document
  document_url TEXT, -- PDF irsaliye belgesi

  -- Additional info
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(company_id, waybill_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waybills_company_id ON waybills(company_id);
CREATE INDEX IF NOT EXISTS idx_waybills_status ON waybills(status);
CREATE INDEX IF NOT EXISTS idx_waybills_type ON waybills(type);
CREATE INDEX IF NOT EXISTS idx_waybills_customer_id ON waybills(customer_id);
CREATE INDEX IF NOT EXISTS idx_waybills_supplier_id ON waybills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_waybills_inventory_transaction_id ON waybills(inventory_transaction_id);
CREATE INDEX IF NOT EXISTS idx_waybills_waybill_date ON waybills(waybill_date);

-- Enable RLS
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view waybills for their company"
ON waybills
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert waybills for their company"
ON waybills
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update waybills for their company"
ON waybills
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

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
COMMENT ON COLUMN waybills.type IS 'inbound (giriş) or outbound (çıkış)';
COMMENT ON COLUMN waybills.status IS 'pending (bekliyor), completed (tamamlandı), cancelled (iptal)';
COMMENT ON COLUMN waybills.document_url IS 'Path to PDF waybill document in storage';

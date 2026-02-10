-- ANA DEPO ENVANTER TABLOSU OLUSTUR
-- warehouse_inventory tablosu production_inventory ve quality_control_inventory ile ayni yapida olacak

-- ============================================================
-- 1. TABLO OLUSTUR
-- ============================================================

CREATE TABLE IF NOT EXISTS warehouse_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    current_stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, item_id),
    CONSTRAINT warehouse_inventory_stock_non_negative CHECK (current_stock >= 0)
);

-- ============================================================
-- 2. INDEX OLUSTUR
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_company
ON warehouse_inventory(company_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_item
ON warehouse_inventory(item_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_company_item
ON warehouse_inventory(company_id, item_id);

-- ============================================================
-- 3. RLS POLITIKALARI
-- ============================================================

ALTER TABLE warehouse_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouse_inventory_select ON warehouse_inventory;
CREATE POLICY warehouse_inventory_select ON warehouse_inventory
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS warehouse_inventory_insert ON warehouse_inventory;
CREATE POLICY warehouse_inventory_insert ON warehouse_inventory
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS warehouse_inventory_update ON warehouse_inventory;
CREATE POLICY warehouse_inventory_update ON warehouse_inventory
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS warehouse_inventory_delete ON warehouse_inventory;
CREATE POLICY warehouse_inventory_delete ON warehouse_inventory
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- ============================================================
-- 4. KONTROL
-- ============================================================

SELECT 'warehouse_inventory tablosu olusturuldu!' as mesaj;
SELECT 'RLS politikalari eklendi.' as bilgi;
SELECT 'Stok negatif olamaz constraint eklendi.' as guvenlik;

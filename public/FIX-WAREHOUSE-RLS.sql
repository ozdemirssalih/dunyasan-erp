-- =====================================================
-- WAREHOUSE RLS POLİTİKALARINI DÜZELT
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Warehouse RLS politikaları düzeltiliyor...';
    RAISE NOTICE '';
END $$;

-- warehouse_items için RLS politikaları
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_items_all" ON warehouse_items;
DROP POLICY IF EXISTS "warehouse_items_select" ON warehouse_items;
DROP POLICY IF EXISTS "warehouse_items_insert" ON warehouse_items;
DROP POLICY IF EXISTS "warehouse_items_update" ON warehouse_items;
DROP POLICY IF EXISTS "warehouse_items_delete" ON warehouse_items;

CREATE POLICY "warehouse_items_all"
ON warehouse_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- warehouse_transactions için RLS politikaları
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_transactions_all" ON warehouse_transactions;
DROP POLICY IF EXISTS "warehouse_transactions_select" ON warehouse_transactions;
DROP POLICY IF EXISTS "warehouse_transactions_insert" ON warehouse_transactions;
DROP POLICY IF EXISTS "warehouse_transactions_update" ON warehouse_transactions;
DROP POLICY IF EXISTS "warehouse_transactions_delete" ON warehouse_transactions;

CREATE POLICY "warehouse_transactions_all"
ON warehouse_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- warehouse_categories için RLS politikaları
ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_categories_all" ON warehouse_categories;
DROP POLICY IF EXISTS "warehouse_categories_select" ON warehouse_categories;
DROP POLICY IF EXISTS "warehouse_categories_insert" ON warehouse_categories;
DROP POLICY IF EXISTS "warehouse_categories_update" ON warehouse_categories;
DROP POLICY IF EXISTS "warehouse_categories_delete" ON warehouse_categories;

CREATE POLICY "warehouse_categories_all"
ON warehouse_categories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ WAREHOUSE RLS POLİTİKALARI DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ warehouse_items: Herkes her şeyi görebilir';
    RAISE NOTICE '✅ warehouse_transactions: Herkes her şeyi görebilir';
    RAISE NOTICE '✅ warehouse_categories: Herkes her şeyi görebilir';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık stokları görebilirsin!';
    RAISE NOTICE '========================================';
END $$;

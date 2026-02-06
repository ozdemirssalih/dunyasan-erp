-- =====================================================
-- DÜNYASAN ERP - TÜM RLS KISITLAMALARINI KALDIR
-- =====================================================
-- HERKESİN HER ŞEYİ GÖRMESİNİ SAĞLA
-- Company_id kontrolü YOK
-- =====================================================

DO $$
DECLARE
    table_record RECORD;
    policy_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TÜM RLS POLİTİKALARI TEMİZLENİYOR...';
    RAISE NOTICE '========================================';

    -- Tüm politikaları bul ve sil
    FOR table_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT IN ('spatial_ref_sys')
    LOOP
        -- Her tablo için tüm politikaları sil
        FOR policy_record IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = table_record.schemaname
              AND tablename = table_record.tablename
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                policy_record.policyname,
                table_record.schemaname,
                table_record.tablename);
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Tüm eski politikalar silindi';
END $$;

-- =====================================================
-- YENİ POLİTİKALAR: HERKES HER ŞEYİ GÖREBİLİR
-- =====================================================

-- DEPO
CREATE POLICY "warehouse_items_all" ON warehouse_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "warehouse_transactions_all" ON warehouse_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "warehouse_categories_all" ON warehouse_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "purchase_requests_all" ON purchase_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ÜRETİM
CREATE POLICY "production_inventory_all" ON production_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_material_requests_all" ON production_material_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_material_assignments_all" ON production_material_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_outputs_all" ON production_outputs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_qc_transfers_all" ON production_to_qc_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- KALİTE KONTROL
CREATE POLICY "quality_control_inventory_all" ON quality_control_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TEZGAHLAR
CREATE POLICY "machines_all" ON machines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machine_inventory_all" ON machine_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_machine_transfers_all" ON production_to_machine_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FİRE
CREATE POLICY "production_scrap_records_all" ON production_scrap_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PROJELER
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'projects') THEN
        EXECUTE 'CREATE POLICY "projects_all" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'project_parts') THEN
        EXECUTE 'CREATE POLICY "project_parts_all" ON project_parts FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- KULLANICILAR
CREATE POLICY "profiles_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ŞİRKETLER
CREATE POLICY "companies_all" ON companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DEPARTMANLAR
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'departments') THEN
        EXECUTE 'CREATE POLICY "departments_all" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- BİLDİRİMLER
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications') THEN
        EXECUTE 'CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid())';
        EXECUTE 'CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid())';
    END IF;
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅✅✅ TÜM RLS KISITLAMALARI KALDIRILDI! ✅✅✅';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık:';
    RAISE NOTICE '   • TÜM authenticated kullanıcılar';
    RAISE NOTICE '   • TÜM verileri görebilir';
    RAISE NOTICE '   • TÜM işlemleri yapabilir';
    RAISE NOTICE '   • Company_id KONTROLÜ YOK!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Güncellenen Tablolar:';
    RAISE NOTICE '   ✓ Depo tabloları';
    RAISE NOTICE '   ✓ Üretim tabloları';
    RAISE NOTICE '   ✓ Kalite kontrol tabloları';
    RAISE NOTICE '   ✓ Tezgah tabloları (YENİ)';
    RAISE NOTICE '   ✓ Fire tabloları (YENİ)';
    RAISE NOTICE '   ✓ Proje tabloları';
    RAISE NOTICE '   ✓ Makine tabloları';
    RAISE NOTICE '';
    RAISE NOTICE '🚨 UYARI: Herkes her şeyi görebilir!';
    RAISE NOTICE '========================================';
END $$;

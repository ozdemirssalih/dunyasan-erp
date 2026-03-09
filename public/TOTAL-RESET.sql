-- =====================================================
-- TOPLAM SIFIRLA - TÜM OPERASYONEL VERİLER
-- =====================================================
-- Tüm işlem verilerini siler (üretim, transfer, fatura, muhasebe, stok)
-- Tanımları korur (ürünler, müşteriler, tedarikçiler, kategoriler)
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔥 TOPLAM SIFIRLAMA BAŞLIYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Tüm operasyonel veriler silinecek!';
    RAISE NOTICE '✅ Tanımlar korunacak (ürünler, müşteriler, vb.)';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: MUHASEBE VERİLERİNİ SİL
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '💰 Muhasebe verileri siliniyor...';
    RAISE NOTICE '';

    -- 1. Fatura kalemleri (invoice_items)
    DELETE FROM invoice_items;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ invoice_items: % kayıt', deleted_count;

    -- 2. Faturalar (invoices)
    DELETE FROM invoices;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ invoices: % kayıt', deleted_count;

    -- 3. Kasa işlemleri (cash_transactions)
    DELETE FROM cash_transactions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ cash_transactions: % kayıt', deleted_count;

    -- 4. Cari hesap işlemleri (current_account_transactions)
    DELETE FROM current_account_transactions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ current_account_transactions: % kayıt', deleted_count;

    -- 5. Muhasebe işlemleri (accounting_transactions - eğer varsa)
    BEGIN
        DELETE FROM accounting_transactions;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ accounting_transactions: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ accounting_transactions: tablo yok';
    END;

    -- 6. Hesap transferleri (account_transfers - eğer varsa)
    BEGIN
        DELETE FROM account_transfers;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ account_transfers: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ account_transfers: tablo yok';
    END;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Muhasebe verileri temizlendi!';
END $$;

-- =====================================================
-- ADIM 2: İRSALİYELERİ SİL
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📄 İrsaliyeler siliniyor...';

    DELETE FROM waybills;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ waybills: % kayıt', deleted_count;

    RAISE NOTICE '';
    RAISE NOTICE '✅ İrsaliyeler temizlendi!';
END $$;

-- =====================================================
-- ADIM 3: SATIN ALMA / SATIŞ SİPARİŞLERİNİ SİL
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📦 Sipariş verileri siliniyor...';
    RAISE NOTICE '';

    -- 1. Satış siparişi kalemleri
    BEGIN
        DELETE FROM sales_order_items;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ sales_order_items: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ sales_order_items: tablo yok';
    END;

    -- 2. Satış siparişleri
    BEGIN
        DELETE FROM sales_orders;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ sales_orders: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ sales_orders: tablo yok';
    END;

    -- 3. Satınalma siparişi kalemleri
    BEGIN
        DELETE FROM purchase_order_items;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ purchase_order_items: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ purchase_order_items: tablo yok';
    END;

    -- 4. Satınalma siparişleri
    BEGIN
        DELETE FROM purchase_orders;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ purchase_orders: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ purchase_orders: tablo yok';
    END;

    -- 5. Satınalma talepleri
    DELETE FROM purchase_requests;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ purchase_requests: % kayıt', deleted_count;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Sipariş verileri temizlendi!';
END $$;

-- =====================================================
-- ADIM 4: ÜRETİM VERİLERİNİ SİL
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏭 Üretim verileri siliniyor...';
    RAISE NOTICE '';

    -- 1. Production outputs (en bağımlı)
    DELETE FROM production_outputs;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_outputs: % kayıt', deleted_count;

    -- 2. Scrap records
    DELETE FROM production_scrap_records;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_scrap_records: % kayıt', deleted_count;

    -- 3. Production to machine transfers
    DELETE FROM production_to_machine_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_machine_transfers: % kayıt', deleted_count;

    -- 4. QC to warehouse transfers
    DELETE FROM qc_to_warehouse_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers: % kayıt', deleted_count;

    -- 5. Production to QC transfers
    DELETE FROM production_to_qc_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_qc_transfers: % kayıt', deleted_count;

    -- 6. Production to warehouse transfers
    DELETE FROM production_to_warehouse_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_warehouse_transfers: % kayıt', deleted_count;

    -- 7. Production material requests
    DELETE FROM production_material_requests;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_material_requests: % kayıt', deleted_count;

    -- 8. Production material assignments
    DELETE FROM production_material_assignments;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_material_assignments: % kayıt', deleted_count;

    -- 9. Günlük üretim kayıtları
    BEGIN
        DELETE FROM daily_production;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ daily_production: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ daily_production: tablo yok';
    END;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Üretim verileri temizlendi!';
END $$;

-- =====================================================
-- ADIM 5: ENVANTER/STOK KAYITLARINI SİL
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 Envanter kayıtları siliniyor...';
    RAISE NOTICE '';

    -- 1. Machine inventory
    DELETE FROM machine_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ machine_inventory: % kayıt', deleted_count;

    -- 2. Quality control inventory
    DELETE FROM quality_control_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ quality_control_inventory: % kayıt', deleted_count;

    -- 3. Production inventory
    DELETE FROM production_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_inventory: % kayıt', deleted_count;

    -- 4. Warehouse transactions
    DELETE FROM warehouse_transactions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ warehouse_transactions: % kayıt', deleted_count;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Envanter kayıtları temizlendi!';
END $$;

-- =====================================================
-- ADIM 6: DEPO STOKLARINI SIFIRLA
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Depo stokları sıfırlanıyor...';

    UPDATE warehouse_items
    SET
        current_stock = 0,
        updated_at = NOW();
    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE '   ✓ % ürünün stoğu sıfırlandı', updated_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Depo stokları sıfırlandı!';
END $$;

-- =====================================================
-- ADIM 7: PROJE VERİLERİNİ SİL (varsa)
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 Proje verileri siliniyor...';
    RAISE NOTICE '';

    -- 1. Project tool deliveries
    BEGIN
        DELETE FROM project_tool_deliveries;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ project_tool_deliveries: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ project_tool_deliveries: tablo yok';
    END;

    -- 2. Project tools
    BEGIN
        DELETE FROM project_tools;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ project_tools: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ project_tools: tablo yok';
    END;

    -- 3. Project materials
    BEGIN
        DELETE FROM project_materials;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ project_materials: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ project_materials: tablo yok';
    END;

    -- 4. Project machines
    BEGIN
        DELETE FROM project_machines;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ project_machines: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ project_machines: tablo yok';
    END;

    -- 5. Projects
    BEGIN
        DELETE FROM projects;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ projects: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ projects: tablo yok';
    END;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Proje verileri temizlendi!';
END $$;

-- =====================================================
-- ADIM 8: DİĞER OPERASYONEL VERİLER
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🗂️  Diğer veriler siliniyor...';
    RAISE NOTICE '';

    -- Chat mesajları
    BEGIN
        DELETE FROM chat_messages;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ chat_messages: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ chat_messages: tablo yok';
    END;

    -- Employee records
    BEGIN
        DELETE FROM employee_records;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ employee_records: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ employee_records: tablo yok';
    END;

    -- Quality control documents
    BEGIN
        DELETE FROM quality_control_documents;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ quality_control_documents: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ quality_control_documents: tablo yok';
    END;

    -- Warehouse QC documents
    BEGIN
        DELETE FROM warehouse_qc_documents;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   ✓ warehouse_qc_documents: % kayıt', deleted_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   ⊘ warehouse_qc_documents: tablo yok';
    END;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Diğer veriler temizlendi!';
END $$;

-- =====================================================
-- DOĞRULAMA
-- =====================================================
DO $$
DECLARE
    stock_sum DECIMAL := 0;
    item_count INTEGER := 0;
    customer_count INTEGER := 0;
    supplier_count INTEGER := 0;
    machine_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 TEMİZLİK SONRASI DURUM';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Toplam stok
    SELECT COALESCE(SUM(current_stock), 0) INTO stock_sum FROM warehouse_items;
    SELECT COUNT(*) INTO item_count FROM warehouse_items;

    RAISE NOTICE '📦 DEPO:';
    RAISE NOTICE '   • Toplam ürün: %', item_count;
    RAISE NOTICE '   • Toplam stok: %', stock_sum;
    RAISE NOTICE '';

    -- Müşteriler
    SELECT COUNT(*) INTO customer_count FROM customers;
    RAISE NOTICE '👥 MÜŞTERİLER: % adet (korundu)', customer_count;

    -- Tedarikçiler
    SELECT COUNT(*) INTO supplier_count FROM suppliers;
    RAISE NOTICE '🏢 TEDARİKÇİLER: % adet (korundu)', supplier_count;

    -- Makineler
    SELECT COUNT(*) INTO machine_count FROM machines;
    RAISE NOTICE '⚙️  MAKİNELER: % adet (korundu)', machine_count;

    RAISE NOTICE '';
END $$;

-- =====================================================
-- TABLO DURUMLARI
-- =====================================================
SELECT 'TÜM TABLO DURUMLARI:' as bilgi;

SELECT
    'invoices' as tablo,
    COUNT(*) as kayit_sayisi
FROM invoices
UNION ALL
SELECT 'waybills', COUNT(*) FROM waybills
UNION ALL
SELECT 'cash_transactions', COUNT(*) FROM cash_transactions
UNION ALL
SELECT 'current_account_transactions', COUNT(*) FROM current_account_transactions
UNION ALL
SELECT 'warehouse_transactions', COUNT(*) FROM warehouse_transactions
UNION ALL
SELECT 'production_outputs', COUNT(*) FROM production_outputs
UNION ALL
SELECT 'production_inventory', COUNT(*) FROM production_inventory
UNION ALL
SELECT 'quality_control_inventory', COUNT(*) FROM quality_control_inventory
UNION ALL
SELECT 'machine_inventory', COUNT(*) FROM machine_inventory
UNION ALL
SELECT 'purchase_requests', COUNT(*) FROM purchase_requests
ORDER BY tablo;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TOPLAM SIFIRLAMA TAMAMLANDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  SİLİNEN VERİLER:';
    RAISE NOTICE '   • Tüm faturalar ve irsaliyeler';
    RAISE NOTICE '   • Tüm muhasebe işlemleri';
    RAISE NOTICE '   • Tüm üretim kayıtları';
    RAISE NOTICE '   • Tüm transfer geçmişleri';
    RAISE NOTICE '   • Tüm kalite kontrol kayıtları';
    RAISE NOTICE '   • Tüm envanter kayıtları';
    RAISE NOTICE '   • Tüm stok işlemleri';
    RAISE NOTICE '   • Tüm sipariş kayıtları';
    RAISE NOTICE '';
    RAISE NOTICE '✅ KORUNAN TANIMLAR:';
    RAISE NOTICE '   • Ürün tanımları (warehouse_items - stoklar sıfırlandı)';
    RAISE NOTICE '   • Müşteriler (customers)';
    RAISE NOTICE '   • Tedarikçiler (suppliers)';
    RAISE NOTICE '   • Makineler (machines)';
    RAISE NOTICE '   • Kullanıcılar (profiles)';
    RAISE NOTICE '   • Şirketler (companies)';
    RAISE NOTICE '   • Muhasebe kategorileri (accounting_categories)';
    RAISE NOTICE '   • Ödeme hesapları (payment_accounts)';
    RAISE NOTICE '   • Cari hesap tanımları (current_accounts)';
    RAISE NOTICE '   • Çalışanlar (employees)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Sistem tamamen temiz, sıfırdan başlayabilirsiniz!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =============================================
-- CARİ VE MUHASEBE VERİLERİNİ SIFIRLAMA
-- =============================================
-- DOĞRUDAN ÇALIŞTIR - Tüm muhasebe verilerini siler!
-- =============================================

DO $$
DECLARE
  v_company_id UUID;
  deleted_cash INTEGER := 0;
  deleted_current INTEGER := 0;
  deleted_checks INTEGER := 0;
  deleted_waybills INTEGER := 0;
  deleted_invoices INTEGER := 0;
BEGIN
  -- Şirket ID'sini al
  SELECT id INTO v_company_id FROM companies LIMIT 1;

  RAISE NOTICE '🔥 Tüm muhasebe verileri siliniyor...';

  -- 1. KASA İŞLEMLERİ
  DELETE FROM cash_transactions WHERE company_id = v_company_id;
  GET DIAGNOSTICS deleted_cash = ROW_COUNT;

  -- 2. CARİ HESAP İŞLEMLERİ
  DELETE FROM current_account_transactions WHERE company_id = v_company_id;
  GET DIAGNOSTICS deleted_current = ROW_COUNT;

  -- 3. ÇEKLER
  DELETE FROM checks WHERE company_id = v_company_id;
  GET DIAGNOSTICS deleted_checks = ROW_COUNT;

  -- 4. İRSALİYELER
  DELETE FROM waybills WHERE company_id = v_company_id;
  GET DIAGNOSTICS deleted_waybills = ROW_COUNT;

  -- 5. FATURALAR
  DELETE FROM invoices WHERE company_id = v_company_id;
  GET DIAGNOSTICS deleted_invoices = ROW_COUNT;

  RAISE NOTICE '✅ Kasa: % | Cari: % | Çek: % | İrsaliye: % | Fatura: %',
    deleted_cash, deleted_current, deleted_checks, deleted_waybills, deleted_invoices;
  RAISE NOTICE '🎉 TAMAMLANDI!';
END $$;

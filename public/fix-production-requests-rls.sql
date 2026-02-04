-- DÜNYASAN ERP - Üretim Talepleri RLS Düzeltmesi
-- Depo yöneticisinin talepleri güncelleyebilmesi için UPDATE policy eksik

-- Önce mevcut policy varsa sil
DROP POLICY IF EXISTS "update_production_requests" ON production_material_requests;

-- Yeni policy ekle
CREATE POLICY "update_production_requests" ON production_material_requests
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Üretim talepleri UPDATE policy eklendi!';
    RAISE NOTICE '📝 Artık depo yöneticisi talepleri onaylayabilir/reddedebilir';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Test: Üretimden talep oluşturun, depoda görün ve onaylayın!';
END $$;

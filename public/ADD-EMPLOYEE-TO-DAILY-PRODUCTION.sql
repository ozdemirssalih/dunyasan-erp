-- GÜNLÜK ÜRETİME PERSONEL EKLEMESİ

-- 1. machine_daily_production tablosuna employee_id kolonu ekle
ALTER TABLE machine_daily_production
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- 2. Index ekle
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_employee
ON machine_daily_production(employee_id);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ GÜNLÜK ÜRETİME PERSONEL EKLENDİ!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  ✓ employee_id kolonu eklendi';
    RAISE NOTICE '  ✓ Index oluşturuldu';
    RAISE NOTICE '';
    RAISE NOTICE 'Artık günlük üretim kayıtlarında:';
    RAISE NOTICE '  • Hangi personelin çalıştığı';
    RAISE NOTICE '  • Personel bazlı üretim takibi';
    RAISE NOTICE '  • Personel performans analizi';
    RAISE NOTICE '  yapılabilir.';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;

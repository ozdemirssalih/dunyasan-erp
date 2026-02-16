-- GÜNLÜK ÜRETİM CONSTRAINT GÜNCELLEMESİ
-- Shift bazlı benzersizlik: Aynı tezgah, proje, tarih için farklı vardiyalarda kayıt yapılabilir

-- 1. Eski constraint'i kaldır
ALTER TABLE machine_daily_production
DROP CONSTRAINT IF EXISTS machine_daily_production_machine_id_project_id_production_d_key;

-- 2. Yeni constraint ekle (shift dahil)
ALTER TABLE machine_daily_production
ADD CONSTRAINT machine_daily_production_unique_shift
UNIQUE (machine_id, project_id, production_date, shift);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ GÜNLÜK ÜRETİM CONSTRAINT GÜNCELLENDİ!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  ✓ Eski constraint kaldırıldı';
    RAISE NOTICE '  ✓ Yeni shift bazlı constraint eklendi';
    RAISE NOTICE '';
    RAISE NOTICE 'Artık:';
    RAISE NOTICE '  • Aynı gün farklı vardiyalarda kayıt eklenebilir';
    RAISE NOTICE '  • Aynı vardiya için tekrar kayıt eklenemez';
    RAISE NOTICE '  • Vardiya boş ise NULL olarak kaydedilir';
    RAISE NOTICE '';
    RAISE NOTICE 'Örnek:';
    RAISE NOTICE '  ✅ Tezgah-1, Proje-A, 2026-02-16, Gündüz';
    RAISE NOTICE '  ✅ Tezgah-1, Proje-A, 2026-02-16, Gece';
    RAISE NOTICE '  ❌ Tezgah-1, Proje-A, 2026-02-16, Gündüz (TEKRAR)';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;

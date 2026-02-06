-- =====================================================
-- DÜNYASAN ERP - FİRE (SCRAP) YÖNETİM SİSTEMİ
-- =====================================================
-- Teslim edilemeyen, bozulan, hatalı malzemelerin takibi
-- Fire stoğu ayrı olarak tutuluyor
-- =====================================================

-- =====================================================
-- ADIM 1: FİRE KAYIT TABLOSU
-- =====================================================

CREATE TABLE IF NOT EXISTS production_scrap_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('machine', 'production', 'warehouse')),
    machine_id UUID REFERENCES machines(id), -- Eğer tezgahtan fire ise
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    scrap_reason TEXT NOT NULL CHECK (scrap_reason IN (
        'damaged',          -- Hasarlı
        'defective',        -- Kusurlu
        'expired',          -- Süresi geçmiş
        'process_error',    -- İşlem hatası
        'quality_fail',     -- Kalite kontrolden geçemedi
        'measurement_error',-- Ölçü hatası
        'material_fault',   -- Malzeme hatası
        'other'            -- Diğer
    )),
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrap_records_company ON production_scrap_records(company_id);
CREATE INDEX IF NOT EXISTS idx_scrap_records_machine ON production_scrap_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_scrap_records_source ON production_scrap_records(source_type);
CREATE INDEX IF NOT EXISTS idx_scrap_records_reason ON production_scrap_records(scrap_reason);
CREATE INDEX IF NOT EXISTS idx_scrap_records_date ON production_scrap_records(recorded_at);

COMMENT ON TABLE production_scrap_records IS 'Fire (hurda) kayıtları - teslim edilemeyen/bozulan malzemeler';

-- RLS
ALTER TABLE production_scrap_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scrap_records_select" ON production_scrap_records;
DROP POLICY IF EXISTS "scrap_records_insert" ON production_scrap_records;

CREATE POLICY "scrap_records_select" ON production_scrap_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "scrap_records_insert" ON production_scrap_records FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- ADIM 2: FİRE STOĞU (production_inventory'de item_type='scrap')
-- =====================================================
-- production_inventory'ye scrap tipi eklenmeli
-- Önce constraint'i kontrol et ve güncelle

DO $$
BEGIN
    -- Mevcut constraint'i kaldır
    ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_item_type_check;

    -- Yeni constraint ekle (scrap dahil)
    ALTER TABLE production_inventory
    ADD CONSTRAINT production_inventory_item_type_check
    CHECK (item_type IN ('raw_material', 'finished_product', 'scrap'));

    RAISE NOTICE '✅ production_inventory scrap tipi için güncellendi';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint zaten doğru veya başka bir sorun var';
END $$;

-- =====================================================
-- ADIM 3: FİRE KAYIT TRİGGER
-- =====================================================
-- Fire kaydı eklenir eklenmez:
-- - Kaynak stoğundan azalt (tezgah/üretim/depo)
-- - Fire stoğuna ekle

CREATE OR REPLACE FUNCTION record_production_scrap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    source_name TEXT;
BEGIN
    -- 1. Kaynağa göre stoktan düş
    IF NEW.source_type = 'machine' THEN
        -- Tezgahtan fire
        UPDATE machine_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = NEW.item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tezgahta yeterli stok yok! (Tezgah: %, Ürün: %)',
                (SELECT code FROM machines WHERE id = NEW.machine_id),
                (SELECT code FROM warehouse_items WHERE id = NEW.item_id);
        END IF;

        source_name := 'Tezgah: ' || (SELECT code FROM machines WHERE id = NEW.machine_id);

    ELSIF NEW.source_type = 'production' THEN
        -- Üretim deposundan fire (hammadde veya bitmiş ürün)
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type IN ('raw_material', 'finished_product');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Üretim deposunda yeterli stok yok! (Ürün: %)',
                (SELECT code FROM warehouse_items WHERE id = NEW.item_id);
        END IF;

        source_name := 'Üretim Deposu';

    ELSIF NEW.source_type = 'warehouse' THEN
        -- Ana depodan fire
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ana depoda yeterli stok yok! (Ürün: %)',
                (SELECT code FROM warehouse_items WHERE id = NEW.item_id);
        END IF;

        source_name := 'Ana Depo';
    END IF;

    -- 2. Fire stoğuna ekle
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    ) VALUES (
        NEW.company_id,
        NEW.item_id,
        NEW.quantity,
        'scrap',
        'Fire - Kaynak: ' || source_name || ' - Sebep: ' || NEW.scrap_reason || ' - Kayıt #' || NEW.id
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    RAISE NOTICE '🔥 FİRE: % adet % (Kaynak: %, Sebep: %)',
        NEW.quantity,
        (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
        source_name,
        NEW.scrap_reason;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_scrap ON production_scrap_records;

CREATE TRIGGER trg_record_scrap
    AFTER INSERT ON production_scrap_records
    FOR EACH ROW
    EXECUTE FUNCTION record_production_scrap();

-- =====================================================
-- ADIM 4: ÜRETİM KAYDI TRİGGER'INI GÜNCELLE
-- =====================================================
-- Üretim kaydı yapılırken tezgahtan hammadde otomatik düşsün

CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    required_materials RECORD;
    material_consumed DECIMAL(15,3);
BEGIN
    -- 1. Bitmiş ürünü üretim deposuna ekle
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    ) VALUES (
        NEW.company_id,
        NEW.output_item_id,
        NEW.quantity,
        'finished_product',
        'Üretim kaydı #' || NEW.id || ' - Tezgah: ' || (SELECT code FROM machines WHERE id = NEW.machine_id)
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    -- 2. Tezgahtan hammadde OTOMATIK AZALT
    -- production_material_assignments'tan bu tezgah için atanmış malzemeleri bul
    FOR required_materials IN
        SELECT item_id, quantity
        FROM production_material_assignments
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND assigned_date::date = NEW.production_date::date
    LOOP
        -- Üretilen miktar kadar hammadde tüketildi
        material_consumed := required_materials.quantity * NEW.quantity;

        -- Tezgah envanterinden OTOMATIK AZALT
        UPDATE machine_inventory
        SET current_stock = current_stock - material_consumed,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = required_materials.item_id;

        RAISE NOTICE '📉 TEZGAHTAN OTOMATIK AZALTI: % adet % (Tezgah: %, Üretim: % adet)',
            material_consumed,
            (SELECT code FROM warehouse_items WHERE id = required_materials.item_id),
            (SELECT code FROM machines WHERE id = NEW.machine_id),
            NEW.quantity;
    END LOOP;

    RAISE NOTICE '✅ Üretim kaydı: % adet % üretildi (Tezgah: %, Kayıt #%)',
        NEW.quantity,
        (SELECT code FROM warehouse_items WHERE id = NEW.output_item_id),
        (SELECT code FROM machines WHERE id = NEW.machine_id),
        NEW.id;

    RETURN NEW;
END;
$$;

-- Trigger'ı güncelle
DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

-- =====================================================
-- SONUÇ MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FİRE YÖNETİM SİSTEMİ KURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Yeni Tablo:';
    RAISE NOTICE '   • production_scrap_records - Fire kayıtları';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Fire Stoğu:';
    RAISE NOTICE '   • production_inventory (item_type=''scrap'')';
    RAISE NOTICE '   • Tezgah, üretim, depodan fire çıkarılabilir';
    RAISE NOTICE '';
    RAISE NOTICE '🔥 Fire Sebepleri:';
    RAISE NOTICE '   • damaged (Hasarlı)';
    RAISE NOTICE '   • defective (Kusurlu)';
    RAISE NOTICE '   • expired (Süresi geçmiş)';
    RAISE NOTICE '   • process_error (İşlem hatası)';
    RAISE NOTICE '   • quality_fail (Kalite hatasını)';
    RAISE NOTICE '   • measurement_error (Ölçü hatası)';
    RAISE NOTICE '   • material_fault (Malzeme hatası)';
    RAISE NOTICE '   • other (Diğer)';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Otomatik İşlemler:';
    RAISE NOTICE '   ✅ Üretim kaydı → Tezgahtan hammadde OTOMATIK düşer';
    RAISE NOTICE '   ✅ Fire kaydı → Kaynak stoğundan azalır';
    RAISE NOTICE '   ✅ Fire kaydı → Fire stoğuna eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık fire tam takip ediliyor!';
    RAISE NOTICE '========================================';
END $$;

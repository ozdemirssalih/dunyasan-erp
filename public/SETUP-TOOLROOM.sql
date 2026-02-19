-- ============================================================
-- TAKIMHANE (TOOLROOM) — Tam Kurulum SQL
-- Dünyasan ERP | 2026
-- ============================================================
-- Çalıştırma sırası:
--   1. Bu dosyayı Supabase SQL Editor'da çalıştır
--   2. Mevcut tools tablosuna yeni kolonlar eklenir
--   3. tool_checkouts ve tool_maintenance tabloları oluşturulur
-- ============================================================

-- ── 1. TOOLS — Ana Takım Envanteri ──────────────────────────
CREATE TABLE IF NOT EXISTS tools (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tool_code       VARCHAR(50)  NOT NULL,
    tool_name       VARCHAR(255) NOT NULL,
    tool_type       VARCHAR(100),           -- Kesici takım, matkap, kumpas, mikrometre...
    brand           VARCHAR(100),           -- Marka
    model           VARCHAR(100),           -- Model/Seri
    location        VARCHAR(255),           -- Fiziksel konum (Dolap A / Raf 2 / Çekmece 3)
    quantity        INTEGER      NOT NULL DEFAULT 1,       -- Toplam adet
    min_quantity    INTEGER      NOT NULL DEFAULT 1,       -- Minimum stok seviyesi
    unit_price      DECIMAL(10,2),          -- Birim fiyat (TL)
    status          VARCHAR(50)  NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','checked_out','maintenance','broken','lost')),
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, tool_code)
);

-- Mevcut tabloya eksik kolonları ekle (IF NOT EXISTS ile güvenli)
ALTER TABLE tools ADD COLUMN IF NOT EXISTS brand        VARCHAR(100);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS model        VARCHAR(100);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS quantity     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS unit_price   DECIMAL(10,2);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS location     VARCHAR(255);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS status       VARCHAR(50) NOT NULL DEFAULT 'available';

-- Status CHECK kısıtını sıfırla (eski 'in_use' kaldırılıp 'checked_out' ekleniyor)
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_status_check;
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_status_check1;

-- Eski 'in_use' değerlerini 'checked_out' olarak güncelle
UPDATE tools SET status = 'checked_out' WHERE status = 'in_use';

-- Yeni CHECK kısıtını ekle
ALTER TABLE tools ADD CONSTRAINT tools_status_check
    CHECK (status IN ('available','checked_out','maintenance','broken','lost'));


-- ── 2. TOOL_CHECKOUTS — Zimmet / Teslim-İade Kaydı ──────────
-- Her bir takım çıkışı ve iadesi buraya kaydedilir.
-- returned_at IS NULL → takım hâlâ dışarıda (aktif zimmet)
CREATE TABLE IF NOT EXISTS tool_checkouts (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tool_id             UUID         NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    checked_out_by      VARCHAR(255) NOT NULL,           -- Teslim alan kişi adı
    department          VARCHAR(100),                    -- Departman / Bölüm
    tezgah              VARCHAR(100),                    -- Tezgah adı / numarası (serbest metin)
    checked_out_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expected_return_at  TIMESTAMPTZ,                     -- Beklenen iade tarihi
    returned_at         TIMESTAMPTZ,                     -- İade tarihi (NULL = dışarıda)
    condition_on_return VARCHAR(50)
                        CHECK (condition_on_return IN ('good','worn','damaged')),
    notes               TEXT,
    created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ── 3. TOOL_MAINTENANCE — Bakım / Bileme / Kalibrasyon Geçmişi
CREATE TABLE IF NOT EXISTS tool_maintenance (
    id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tool_id          UUID         NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100) NOT NULL,   -- Bileme, Tamir, Kalibrasyon, Temizlik...
    performed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    performed_by     VARCHAR(255),
    cost             DECIMAL(10,2),           -- Bakım maliyeti (TL)
    notes            TEXT,
    status_after     VARCHAR(50)              -- Bakım sonrası takımın durumu
                        CHECK (status_after IN ('available','maintenance','broken','lost')),
    created_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ── 4. İNDEKSLER ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tools_company          ON tools(company_id);
CREATE INDEX IF NOT EXISTS idx_tools_status           ON tools(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tools_active           ON tools(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tools_low_stock        ON tools(company_id, quantity, min_quantity);

CREATE INDEX IF NOT EXISTS idx_checkouts_company      ON tool_checkouts(company_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_tool         ON tool_checkouts(tool_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_active       ON tool_checkouts(company_id, returned_at)
    WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkouts_person       ON tool_checkouts(company_id, checked_out_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_company    ON tool_maintenance(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tool       ON tool_maintenance(tool_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date       ON tool_maintenance(company_id, performed_at DESC);


-- ── 5. RLS DEVRE DIŞI (uygulama katmanında kontrol edilir) ──
ALTER TABLE tools            DISABLE ROW LEVEL SECURITY;
ALTER TABLE tool_checkouts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tool_maintenance DISABLE ROW LEVEL SECURITY;


-- ── 6. ÖRNEK VERİ (isteğe bağlı, silip çalıştırabilirsin) ──
-- INSERT INTO tools (company_id, tool_code, tool_name, tool_type, brand, location, quantity, min_quantity)
-- VALUES
--   ('<company_id>', 'TK-001', 'Ø10 Parmak Freze', 'Kesici Takım', 'Sandvik', 'Dolap A / Raf 1', 5, 2),
--   ('<company_id>', 'TK-002', 'Dijital Kumpas 150mm', 'Ölçüm Aleti', 'Mitutoyo', 'Dolap B / Raf 3', 3, 1),
--   ('<company_id>', 'TK-003', 'M8 Pafta', 'Diş Açma', 'Dormer', 'Çekmece 2', 2, 1);

-- ============================================================
-- TAMAMLANDI
-- tools, tool_checkouts, tool_maintenance tabloları hazır.
-- ============================================================

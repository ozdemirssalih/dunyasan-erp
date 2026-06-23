-- Station logs tablosuna KK kolonları ekle
ALTER TABLE station_logs ADD COLUMN IF NOT EXISTS qc_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE station_logs ADD COLUMN IF NOT EXISTS qc_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE station_logs ADD COLUMN IF NOT EXISTS qc_approved_at TIMESTAMPTZ;
ALTER TABLE station_logs ADD COLUMN IF NOT EXISTS qc_reject_reason TEXT;
SELECT 'KK kolonları eklendi!' as mesaj;

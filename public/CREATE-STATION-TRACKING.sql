-- ============================================================
-- İSTASYON TAKİP SİSTEMİ (İBS) TABLOLARI
-- ============================================================

CREATE TABLE IF NOT EXISTS station_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,

  action VARCHAR(20) NOT NULL, -- 'start', 'stop'
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  stop_reason TEXT,

  started_by UUID REFERENCES auth.users(id),
  stopped_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE station_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view station_logs" ON station_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert station_logs" ON station_logs FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update station_logs" ON station_logs FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete station_logs" ON station_logs FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_station_logs_company ON station_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_station_logs_machine ON station_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_station_logs_action ON station_logs(action);

SELECT 'Station tracking tables created!' as mesaj;

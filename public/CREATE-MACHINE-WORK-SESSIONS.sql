-- ============================================================
-- İTS v2 — Session bazlı süre takibi + kaliteden onay
-- ============================================================
-- Her makine için birden fazla iş oturumu (session) olabilir.
-- Her session içinde birden fazla start-pause cycle (run) olur.
-- Session accumulated_seconds ile toplam süre biriktirilir.
-- Her run için ayrı kalite onayı bekler.
-- ============================================================

CREATE TABLE IF NOT EXISTS machine_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'running_pending_qc',
  -- 'running_pending_qc' | 'running_approved' | 'paused' | 'ended'
  accumulated_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  started_by UUID REFERENCES auth.users(id),
  ended_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_work_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES machine_work_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  quality_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved'
  quality_approved_by UUID REFERENCES auth.users(id),
  quality_approved_at TIMESTAMPTZ,
  pause_reason TEXT,
  started_by UUID REFERENCES auth.users(id),
  stopped_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mws_company ON machine_work_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_mws_machine ON machine_work_sessions(machine_id);
CREATE INDEX IF NOT EXISTS idx_mws_status ON machine_work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mwr_session ON machine_work_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_mwr_machine ON machine_work_runs(machine_id);
CREATE INDEX IF NOT EXISTS idx_mwr_quality ON machine_work_runs(quality_status, stopped_at);

ALTER TABLE machine_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_work_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_all" ON machine_work_sessions;
CREATE POLICY "sessions_all" ON machine_work_sessions FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "runs_all" ON machine_work_runs;
CREATE POLICY "runs_all" ON machine_work_runs FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

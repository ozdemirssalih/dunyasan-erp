-- Kalite kontrol test sonuçları için PDF doküman tablosu
-- Test raporları, sertifikalar, ölçüm sonuçları vb.

CREATE TABLE IF NOT EXISTS quality_control_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  qc_transfer_id UUID NOT NULL REFERENCES qc_to_warehouse_transfers(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL, -- 'test_report', 'certificate', 'measurement', 'photo', 'other'
  document_title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL, -- Storage path
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- bytes

  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_qc_documents_transfer ON quality_control_documents(qc_transfer_id);
CREATE INDEX IF NOT EXISTS idx_qc_documents_company ON quality_control_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_qc_documents_type ON quality_control_documents(document_type);

-- RLS (Row Level Security) politikaları
ALTER TABLE quality_control_documents ENABLE ROW LEVEL SECURITY;

-- Şirket çalışanları kendi şirketlerinin dokümanlarını görebilir
CREATE POLICY "Users can view their company's QC documents"
  ON quality_control_documents
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerine doküman ekleyebilir
CREATE POLICY "Users can insert QC documents for their company"
  ON quality_control_documents
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerinin dokümanlarını silebilir
CREATE POLICY "Users can delete their company's QC documents"
  ON quality_control_documents
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Kalite kontrol doküman tablosu oluşturuldu!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tablo: quality_control_documents';
    RAISE NOTICE '   - Test raporları, sertifikalar, ölçüm sonuçları';
    RAISE NOTICE '   - Her QC kaydına birden fazla PDF eklenebilir';
    RAISE NOTICE '   - RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Storage bucket kullanılacak: quality-control-docs';
    RAISE NOTICE '   (Aynı bucket employee-records ile paylaşılabilir veya yeni oluşturulabilir)';
END $$;

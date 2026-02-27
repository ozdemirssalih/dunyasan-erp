-- Depo kalite kontrol talepleri için PDF doküman tablosu
-- Depo giriş kontrol sonuçları, test raporları, sertifikalar vb.

CREATE TABLE IF NOT EXISTS warehouse_qc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_qc_request_id UUID NOT NULL REFERENCES warehouse_qc_requests(id) ON DELETE CASCADE,

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
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_docs_request ON warehouse_qc_documents(warehouse_qc_request_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_docs_company ON warehouse_qc_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_docs_type ON warehouse_qc_documents(document_type);

-- RLS (Row Level Security) politikaları
ALTER TABLE warehouse_qc_documents ENABLE ROW LEVEL SECURITY;

-- Şirket çalışanları kendi şirketlerinin dokümanlarını görebilir
CREATE POLICY "Users can view their company's warehouse QC documents"
  ON warehouse_qc_documents
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerine doküman ekleyebilir
CREATE POLICY "Users can insert warehouse QC documents for their company"
  ON warehouse_qc_documents
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerinin dokümanlarını silebilir
CREATE POLICY "Users can delete their company's warehouse QC documents"
  ON warehouse_qc_documents
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Depo kalite kontrol doküman tablosu oluşturuldu!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tablo: warehouse_qc_documents';
    RAISE NOTICE '   - Depo giriş kontrol dokümanları';
    RAISE NOTICE '   - Her QC talebine birden fazla PDF eklenebilir';
    RAISE NOTICE '   - RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Aynı storage bucket kullanılacak: quality-control-docs';
END $$;

-- Personel tutanak kayıtları tablosu oluştur
-- PDF dosyaları, disiplin kayıtları, sertifikalar vb. saklanacak

CREATE TABLE IF NOT EXISTS employee_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  record_type VARCHAR(50) NOT NULL, -- 'tutanak', 'sertifika', 'disiplin', 'diger'
  record_title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL, -- Supabase storage URL
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- bytes cinsinden

  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_employee_records_employee ON employee_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_company ON employee_records(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_type ON employee_records(record_type);

-- RLS (Row Level Security) politikaları
ALTER TABLE employee_records ENABLE ROW LEVEL SECURITY;

-- Şirket çalışanları kendi şirketlerinin kayıtlarını görebilir
CREATE POLICY "Users can view their company's employee records"
  ON employee_records
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerine kayıt ekleyebilir
CREATE POLICY "Users can insert employee records for their company"
  ON employee_records
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Şirket çalışanları kendi şirketlerinin kayıtlarını silebilir
CREATE POLICY "Users can delete their company's employee records"
  ON employee_records
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Personel tutanak kayıtları tablosu oluşturuldu!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tablo: employee_records';
    RAISE NOTICE '   - PDF, sertifika, tutanak dosyalarını saklar';
    RAISE NOTICE '   - Supabase Storage ile entegre çalışır';
    RAISE NOTICE '   - RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Storage bucket oluşturmanız gerekiyor:';
    RAISE NOTICE '   Bucket adı: employee-records';
    RAISE NOTICE '   Public: false (özel)';
END $$;

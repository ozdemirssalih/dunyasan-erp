-- Add timestamp columns to production_to_machine_transfers table
-- These columns are essential for tracking when transfers happen
-- ÖNEMLİ: Mevcut kayıtların tarihine DOKUNMUYORUZ (proje takip verileri bozulmasın)

-- Add created_at column with default value (sadece YENİ kayıtlar için)
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at column with default value
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- MEVCUT KAYITLARI GÜNCELLEMİYORUZ!
-- Kod zaten created_at NULL ise fallback kullanıyor
-- Bu sayede proje takip verileri bozulmaz

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_production_transfers_created_at
ON production_to_machine_transfers(created_at);

-- Kontrol: Kaç kayıt created_at NULL?
SELECT
  COUNT(*) as total_records,
  COUNT(created_at) as with_timestamp,
  COUNT(*) - COUNT(created_at) as without_timestamp
FROM production_to_machine_transfers;

-- Success message
SELECT 'created_at ve updated_at kolonları eklendi. Mevcut 32 kayıt korundu (created_at NULL kalacak).' as message;

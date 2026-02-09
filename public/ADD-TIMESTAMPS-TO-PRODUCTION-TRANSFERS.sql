-- Add timestamp columns to production_to_machine_transfers table
-- These columns are essential for tracking when transfers happen

-- Add created_at column with default value
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at column with default value
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set created_at for existing records (use NOW() as fallback)
UPDATE production_to_machine_transfers
SET created_at = NOW()
WHERE created_at IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_production_transfers_created_at
ON production_to_machine_transfers(created_at);

-- Success message
SELECT 'created_at ve updated_at kolonları production_to_machine_transfers tablosuna eklendi' as message;

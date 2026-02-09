-- Add assigned_by column to production_to_machine_transfers table
-- This column tracks which user assigned materials to machines

-- Add assigned_by column
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_production_transfers_assigned_by
ON production_to_machine_transfers(assigned_by);

-- Success message
SELECT 'assigned_by kolonu production_to_machine_transfers tablosuna eklendi' as message;

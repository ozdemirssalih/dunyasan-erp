-- Fix production_to_machine_transfers table structure
-- Add all missing columns needed for the production system

-- Add project_id column (links to projects)
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add project_part_id column (links to project_parts)
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS project_part_id UUID REFERENCES project_parts(id) ON DELETE SET NULL;

-- Add assigned_by column (tracks who made the assignment)
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id);

-- Add shift column if missing
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS shift VARCHAR(50);

-- Add notes column if missing
ALTER TABLE production_to_machine_transfers
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_production_transfers_project_id
ON production_to_machine_transfers(project_id);

CREATE INDEX IF NOT EXISTS idx_production_transfers_project_part_id
ON production_to_machine_transfers(project_part_id);

CREATE INDEX IF NOT EXISTS idx_production_transfers_assigned_by
ON production_to_machine_transfers(assigned_by);

CREATE INDEX IF NOT EXISTS idx_production_transfers_company_id
ON production_to_machine_transfers(company_id);

CREATE INDEX IF NOT EXISTS idx_production_transfers_machine_id
ON production_to_machine_transfers(machine_id);

-- Success message
SELECT 'production_to_machine_transfers tablosu güncellendi - project_id, project_part_id, assigned_by, shift ve notes kolonları eklendi' as message;

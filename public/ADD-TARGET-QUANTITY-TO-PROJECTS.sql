-- Add target_quantity and unit columns to projects table

-- Add target_quantity column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS target_quantity DECIMAL(10,2) DEFAULT 0;

-- Add unit column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'adet';

-- Success message
SELECT 'target_quantity ve unit kolonları projects tablosuna eklendi' as message;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_url TEXT;
SELECT 'document_url kolonu eklendi!' as mesaj;

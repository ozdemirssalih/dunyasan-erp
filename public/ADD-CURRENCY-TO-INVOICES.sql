-- Faturalara para birimi ve kur alanları ekle
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TRY';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4) DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_tl DECIMAL(15,2);

SELECT 'invoices tablosuna currency, exchange_rate, amount_tl eklendi!' as mesaj;

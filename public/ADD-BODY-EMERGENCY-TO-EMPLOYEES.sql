-- Personel tablosuna beden ve yakın bilgileri ekle
ALTER TABLE employees ADD COLUMN IF NOT EXISTS body_size VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
SELECT 'Beden ve yakın bilgileri eklendi!' as mesaj;

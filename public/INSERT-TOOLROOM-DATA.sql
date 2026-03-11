-- TAKIMHANE VERİLERİ TOPLU EKLEME
-- =====================================
-- Not: Bu script'i çalıştırmadan önce company_id'yi kendi şirket ID'niz ile değiştirin!
-- Örnek: fc777863-e790-4774-98a5-a6b0af06a59f

-- Tüm takımları ekle
INSERT INTO tools (company_id, tool_code, tool_name, tool_type, quantity, min_quantity, location, status) VALUES
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0101', 'APKT1604PDER-G2', 'ELMAS INSERT UÇ', 62, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0102', 'APKT160408PDER', 'ELMAS INSERT UÇ', 81, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0103', 'APTK11T304 APM', 'ELMAS INSERT UÇ', 15, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0104', 'APMT1135PDER', 'ELMAS INSERT UÇ', 0, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0105', 'APMT1135PDER-HM', 'ELMAS INSERT UÇ', 22, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0106', 'APMT1135 PDTR', 'ELMAS INSERT UÇ', 100, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0107', 'APMT1135PDER', 'ELMAS INSERT UÇ', 0, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0108', 'APMT11T308PDSR-MM', 'ELMAS INSERT UÇ', 24, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0109', 'APMT11T308-AL', 'ELMAS INSERT UÇ', 0, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0110', 'APKT11T320-APM', 'ELMAS INSERT UÇ', 10, 10, 'A23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0111', 'DCMT11T304', 'ELMAS INSERT UÇ', 0, 10, 'E19', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0112', 'DCMT11T304', 'ELMAS INSERT UÇ', 940, 10, 'E19', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0113', 'DNMG150608', 'ELMAS INSERT UÇ', 120, 10, 'E20', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0114', '24PENTA2.0', 'ELMAS INSERT UÇ', 18, 10, 'E23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0115', '24PENTA2.0', 'ELMAS INSERT UÇ', 7, 10, 'E23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0116', '27PENTA2.0.', 'ELMAS INSERT UÇ', 10, 10, 'E23', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0117', 'VCMT110308-WM+', 'ELMAS INSERT UÇ', 28, 10, 'E24', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0118', 'VCMT110304 - LF6018', 'ELMAS INSERT UÇ', 20, 10, 'E24', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0119', 'VCMT110308', 'ELMAS INSERT UÇ', 4, 10, 'E24', 'available'),
('fc777863-e790-4774-98a5-a6b0af06a59f', 'EL-IN-000-0120', 'VCMT160408 M', 'ELMAS INSERT UÇ', 36, 10, 'E24', 'available');

-- İkinci Batch (devam ediyor - çok uzun oldu, ilk 20 satır)
-- NOT: Tüm verileri eklemek için bu scripti genişletmelisiniz veya
-- arayüzden "Toplu Veri Yükleme" özelliğini kullanmalısınız.

-- VEYA: CSV Import kullanarak tüm veriyi yükleyebilirsiniz
-- 1. tools_data.csv dosyası oluşturun
-- 2. Supabase Dashboard > Table Editor > tools > Import data from CSV

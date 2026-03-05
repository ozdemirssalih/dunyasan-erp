# Supabase Storage Kurulum Rehberi

## 1. Storage Bucket Oluşturma

### Adım 1: Supabase Dashboard'a gidin
- [supabase.com](https://supabase.com) → Projenizi seçin

### Adım 2: Storage → Buckets
- Sol menüden **Storage** tıklayın
- **Buckets** sekmesine gidin
- **"New bucket"** butonuna tıklayın

### Adım 3: Bucket Ayarları
```
Bucket name: accounting-documents
Public bucket: ❌ KAPALI (OFF) - Private olmalı (güvenlik için!)
File size limit: 5MB (opsiyonel)
Allowed MIME types: application/pdf (opsiyonel)
```

**ÖNEMLİ:** "Public bucket" seçeneğini **❌ KAPALI** bırakın! Muhasebe belgeleri hassas bilgiler içerir ve herkes tarafından erişilmemeli.

**Create bucket** butonuna tıklayın.

---

## 2. Database Kolonları Ekleme

### SQL Editor'ü açın:
- Sol menüden **SQL Editor** tıklayın
- **New query** butonuna tıklayın

### Şu SQL kodunu çalıştırın:

```sql
-- Add document_url columns to accounting tables

ALTER TABLE current_account_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

ALTER TABLE cash_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

COMMENT ON COLUMN current_account_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
COMMENT ON COLUMN cash_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
```

**Run** butonuna tıklayın.

---

## 3. Storage Politikaları (Zorunlu - Güvenlik İçin)

Bucket private olduğu için, kullanıcıların kendi şirketlerinin belgelerine erişebilmesi için RLS politikaları eklemeniz gerekiyor:

```sql
-- Storage Policies for accounting-documents bucket

CREATE POLICY "Users can upload accounting documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can view accounting documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete accounting documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);
```

---

## ✅ Kurulum Tamamlandı!

Artık:
- ✅ Muhasebe formundan PDF belge yükleyebilirsiniz
- ✅ Cari Hesaplar detayında belgeleri görebilirsiniz
- ✅ Kasa Geçmişi'nde belgeleri indirebilirsiniz

## Sorun Giderme

### "Bucket not found" hatası
→ Adım 1'i tekrar kontrol edin. Bucket adı tam olarak `accounting-documents` olmalı.

### "403 Forbidden" hatası veya belge yüklenemiyor
→ Adım 3'teki RLS politikalarını çalıştırdığınızdan emin olun.
→ Kullanıcının profiles tablosunda company_id'si olduğundan emin olun.

### "Column does not exist" hatası
→ Adım 2'deki SQL'i çalıştırın.

### Belgeler indirilemiyor
→ RLS politikalarının doğru çalıştığını kontrol edin.
→ Bucket'ın private (public değil) olduğundan emin olun.

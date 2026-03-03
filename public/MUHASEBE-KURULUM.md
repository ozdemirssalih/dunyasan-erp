# 💰 MUHASEBE MODÜLÜ KURULUM REHBERİ

## 📋 Adım Adım Kurulum

### 1️⃣ Supabase SQL Dosyalarını Çalıştır

Supabase Dashboard → SQL Editor'e git ve sırasıyla şu dosyaları çalıştır:

#### A) Veritabanı Tablolarını Oluştur
```sql
-- Dosya: public/FULL-ACCOUNTING-SYSTEM-FIXED.sql
-- Bu dosyayı Supabase SQL Editor'de çalıştır
```

✅ Başarılı mesajı göreceksin:
```
✅ ✅ ✅ KAPSAMLI MUHASEBE SİSTEMİ BAŞARIYLA OLUŞTURULDU! ✅ ✅ ✅

📋 Oluşturulan Tablolar:
   1. ✅ documents
   2. ✅ document_items
   3. ✅ checks
   4. ✅ promissory_notes
   5. ✅ payments
   6. ✅ collections
   7. ✅ disbursements
```

#### B) Warehouse Items'a Fiyat Kolonları Ekle
```sql
-- Dosya: public/ADD-PRICE-COLUMNS-TO-WAREHOUSE.sql
-- Bu dosyayı Supabase SQL Editor'de çalıştır
```

✅ Başarılı mesajı:
```
✅ Warehouse items tablosuna fiyat kolonları eklendi!
   • sales_price - Satış fiyatı
   • purchase_price - Alış fiyatı
```

#### C) Varsayılan Kategorileri Ekle (İsteğe Bağlı)
```sql
-- Dosya: public/ADD-DEFAULT-ACCOUNTING-CATEGORIES.sql
-- Bu dosyayı Supabase SQL Editor'de çalıştır
```

✅ 23 kategori otomatik eklenecek:
- 7 Gelir kategorisi
- 16 Gider kategorisi

---

### 2️⃣ Uygulamayı Yeniden Başlat

Eğer development server çalışıyorsa:
```bash
# Ctrl+C ile durdur
# Sonra tekrar başlat:
npm run dev
```

---

### 3️⃣ Menüde Yeni Linkleri Kontrol Et

Sol menüde şunları görmelisin:

```
💰 Muhasebe Dashboard      → /dashboard/accounting
   Faturalar               → /dashboard/accounting/invoices
   Çek Yönetimi            → /dashboard/accounting/checks
   Cari Hesaplar           → /dashboard/accounting/current-accounts
   Kasa & Banka            → /dashboard/accounting/payment-accounts
   Muhasebe Kategorileri   → /dashboard/accounting/categories
```

---

## 🎯 Kullanım

### Fatura Kesme

1. **Menü → Faturalar** sayfasına git
2. **"Yeni Fatura"** butonuna tıkla
3. **Satış/Alış** seç
4. **Müşteri/Tedarikçi** seç
5. **Ürün ekle** butonu ile ürünler ekle
6. Her satır için:
   - Miktar gir
   - Birim fiyat (otomatik gelir)
   - İskonto % (isteğe bağlı)
   - KDV % (varsayılan %20)
7. **Ödeme şekli** seç:
   - Nakit/Peşin
   - Çek
   - Senet
   - Kredi Kartı
   - EFT/Havale
   - Açık Hesap (Vadeli)
8. **Kaydet**

✅ Fatura oluşturuldu!
✅ Cari hesap otomatik güncellendi!

---

### Çek Yönetimi

1. **Menü → Çek Yönetimi** sayfasına git
2. **Alınan Çekler** veya **Verilen Çekler** sekmesini seç
3. **"Yeni Çek"** butonuna tıkla
4. Çek bilgilerini gir:
   - Çek numarası
   - Banka adı, Şube
   - Vade tarihi
   - Tutar
5. **Kaydet**

#### Çek İşlemleri:

**Portföydeki Çekler için:**
- 🏦 **Bankaya Ver** - Çeki bankaya yatır
- 💰 **Tahsil Et** - Çeki tahsil et (banka hesabı güncellenir)
- 🔄 **Ciro Et** - Başkasına devret

**Vadesi Geçen Çekler:**
- Kırmızı renkle görünür
- "Vadesi geçti!" uyarısı

---

## 📊 Özellikler

### ✅ Fatura Yönetimi
- Satış/Alış faturası
- Dinamik ürün satırları
- Otomatik KDV hesaplama
- Satır bazlı iskonto
- Ödeme şekilleri
- Vade takibi
- Otomatik cari güncelleme

### ✅ Çek Yönetimi
- Alınan/Verilen çekler
- Portföy takibi
- Ciro işlemleri
- Vade uyarıları
- Tahsilat/Ödeme

### ✅ Cari Hesaplar
- Müşteri/Tedarikçi yönetimi
- Alacak/Borç bakiyesi
- Otomatik güncelleme

### ✅ Kasa/Banka
- Hesap yönetimi
- Transfer işlemleri
- Bakiye takibi

---

## ❌ Sorun Giderme

### "Tablo bulunamadı" hatası
➡️ `FULL-ACCOUNTING-SYSTEM-FIXED.sql` dosyasını çalıştır

### "sales_price kolonu yok" hatası
➡️ `ADD-PRICE-COLUMNS-TO-WAREHOUSE.sql` dosyasını çalıştır

### Menüde linkler görünmüyor
➡️ Permission kontrolü yap, kullanıcı "accounting" modülüne erişebiliyor mu?

### Kategoriler yok
➡️ `ADD-DEFAULT-ACCOUNTING-CATEGORIES.sql` dosyasını çalıştır
➡️ Veya manuel olarak kategori ekle

---

## 🚀 Sonraki Adımlar

Şu özellikleri de ekleyebilirim:

1. **Senet Yönetimi** - Alınan/Verilen senetler
2. **Tahsilat Sayfası** - Müşteriden para tahsil
3. **Ödeme Sayfası** - Tedarikçiye para ödeme
4. **Vade Takibi Dashboard** - Vadesi gelen işlemler
5. **İrsaliye Yönetimi** - Sevk irsaliyesi
6. **Muhasebe Raporları** - Kar/Zarar, Gelir/Gider

İstersen devam edelim! 🎯

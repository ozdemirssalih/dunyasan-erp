# 💰 MUHASEBE MODÜLÜ - KULLANIM KILAVUZU

## 📋 Kurulum Adımları

### 1. Veritabanı Tablolarını Oluştur
Supabase SQL Editor'de sırasıyla şu dosyaları çalıştır:

```sql
-- 1. Ana tabloları oluştur
public/DROP-AND-CREATE-ACCOUNTING.sql

-- 2. Warehouse items'a supplier_id ekle (eğer yoksa)
public/ADD-SUPPLIER-TO-WAREHOUSE-ITEMS.sql
```

### 2. Menü Linkleri
Aşağıdaki sayfalar layout.tsx menüsünde mevcut:
- `/dashboard/accounting` - Ana Dashboard
- `/dashboard/accounting/categories` - Kategori Yönetimi
- `/dashboard/accounting/payment-accounts` - Kasa/Banka Yönetimi
- `/dashboard/accounting/current-accounts` - Cari Hesaplar

## 🎯 Özellikler

### 1. Ana Dashboard (`/dashboard/accounting`)
- ✅ Dönem seçici (Bugün/Hafta/Ay/Yıl)
- 💵 Gelir/Gider özeti
- 💰 Net kar/zarar
- 🏦 Kasa ve Banka bakiyesi
- 📄 Bekleyen faturalar
- 👥 Alacak/Borç toplamı
- 📈 Son 10 işlem listesi
- ➕ Yeni işlem ekleme modal'ı (Gelir/Gider)

**İşlem Ekleme:**
- Gelir/Gider seçimi
- Kategori seçimi
- Kasa/Banka hesabı seçimi
- **Otomatik:** Kasa/Banka bakiyesi güncellenir

### 2. Kategori Yönetimi (`/accounting/categories`)
- 🏷️ Gelir kategorileri (Satış, Hizmet, vb.)
- 🏷️ Gider kategorileri (Kira, Maaş, vb.)
- 🎨 8 farklı renk seçeneği
- ➕ Kategori ekle/düzenle/sil

### 3. Kasa/Banka Yönetimi (`/accounting/payment-accounts`)
- 💵 Kasa hesapları
- 🏦 Banka hesapları (IBAN, Hesap No, Banka Adı)
- 📊 Toplam bakiye istatistikleri
- 🔄 Hesaplar arası transfer
- **Otomatik:** Transfer sonrası bakiyeler güncellenir

**Transfer İşlemi:**
1. Kaynak hesap seç
2. Hedef hesap seç
3. Tutar gir
4. Transfer kaydı oluştur
5. **Otomatik:** Her iki hesap bakiyesi güncellenir

### 4. Cari Hesaplar (`/accounting/current-accounts`)
- 👤 Müşteri hesapları
- 🏢 Tedarikçi hesapları
- 📊 Alacak/Borç bakiyesi
- 📋 Hesap detay modal'ı (hesap hareketleri)
- 🏷️ Vergi dairesi, vergi no, iletişim bilgileri
- 💰 Kredi limiti tanımlama

**Cari Hesap Bakiyesi:**
- **Pozitif (+):** Alacak (Müşteriden alınacak)
- **Negatif (-):** Borç (Tedarikçiye ödenecek)

## 🔄 Otomatik Güncelleme Mantığı

### Gelir İşlemi:
```
Gelir Kaydı → Kasa/Banka Bakiyesi (+)
```

### Gider İşlemi:
```
Gider Kaydı → Kasa/Banka Bakiyesi (-)
```

### Transfer İşlemi:
```
Kaynak Hesap (-) → Hedef Hesap (+)
```

### Fatura İşlemi (Gelecek):
```
Satış Faturası → Müşteri Cari (+) Alacak
Alış Faturası → Tedarikçi Cari (-) Borç

Fatura Ödemesi → Cari Bakiye güncellenir
                → Kasa/Banka bakiyesi güncellenir
```

## 📊 Veri Akışı

```
┌─────────────────────────────────────────────────┐
│ 1. İŞLEM OLUŞTUR                               │
│    - Gelir/Gider işlemi                        │
│    - Fatura (gelecek)                          │
│    - Transfer                                   │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ 2. MUHASEBE KAYDI                              │
│    accounting_transactions tablosu             │
│    invoices tablosu (faturalar için)          │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ 3. OTOMATİK GÜNCELLEMELER                      │
│    ├─ Kasa/Banka bakiyesi (payment_accounts)  │
│    ├─ Cari hesap bakiyesi (current_accounts)  │
│    └─ İstatistikler (dashboard'da gösterilir) │
└─────────────────────────────────────────────────┘
```

## 🎨 Renk Kodları

- **Gelir:** Yeşil (#10B981)
- **Gider:** Kırmızı (#EF4444)
- **Kasa:** Yeşil gradient
- **Banka:** Mavi gradient
- **Müşteri:** Mavi
- **Tedarikçi:** Mor
- **Alacak:** Yeşil
- **Borç:** Kırmızı

## ⚠️ Önemli Notlar

1. **Kategori Oluştur:** İşlem eklemeden önce gelir/gider kategorileri oluşturun
2. **Kasa/Banka Ekle:** İşlem eklemeden önce en az bir kasa veya banka hesabı oluşturun
3. **Cari Hesap Ekle:** Fatura kesmeden önce müşteri/tedarikçi carisi oluşturun
4. **Yedekleme:** Önemli işlemlerden önce Supabase'den yedek alın

## 🚀 Sonraki Özellikler (Planlanan)

- 🧾 **Fatura Yönetimi** - Alış/Satış faturaları + Otomatik cari güncelleme
- 📄 **Fatura Ödeme** - Ödeme alma/yapma + Otomatik bakiye güncelleme
- 📊 **Muhasebe Raporları** - Gelir-gider raporu, Kar-zarar tablosu
- 📈 **Grafikler** - Gelir/gider trend grafikleri
- 📥 **Excel Export** - Tüm veriler excel'e aktarılabilir
- 🔔 **Bildirimler** - Vadesi gelen faturalar için otomatik hatırlatma

## 💡 İpuçları

1. **Dönem Seçimi:** Dashboard'da dönem seçerek istediğiniz zaman aralığındaki verileri görüntüleyin
2. **Hesap Detayları:** Cari hesaplarda "göz" ikonuna tıklayarak hesap hareketlerini görün
3. **Transfer:** Kasadan bankaya veya bankadan kasaya kolayca para transferi yapın
4. **Renk Kodlama:** Kategorilere renk vererek raporlarda görsel ayrım sağlayın

## 📞 Destek

Sorun yaşarsanız:
1. Console'da hata mesajlarını kontrol edin (F12)
2. Supabase tablolarının doğru oluşturulduğundan emin olun
3. Permission guard'ların doğru ayarlandığından emin olun

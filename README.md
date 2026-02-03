# 🚀 DÜNYASAN ERP SİSTEMİ

Modern ve güçlü bir üretim yönetim sistemi. CNC tezgah takibi, stok yönetimi, üretim planlama ve daha fazlası.

## ✨ Özellikler

### 📊 Ana Dashboard
- Gerçek zamanlı üretim istatistikleri
- Aktif tezgah durumu
- Stok uyarıları
- Son siparişler ve ilerleme takibi

### 🏭 Üretim Modülleri

#### Üretim Takip
- Sipariş oluşturma ve yönetimi
- İlerleme takibi
- Durum yönetimi (Beklemede, Devam Ediyor, Tamamlandı, İptal)
- Gerçek zamanlı güncellemeler

#### Tezgah Yönetimi
- CNC tezgah kayıtları
- Verimlilik oranları
- Kapasite takibi
- Bakım durumu yönetimi

#### Stok & Hammadde
- Kategori bazlı envanter yönetimi
  - Hammadde
  - Yarı Mamul
  - Mamul
  - Takım
  - Sarf Malzeme
- Minimum stok seviyesi uyarıları
- Lokasyon takibi
- Birim fiyat hesaplamaları

### 🔐 Güvenlik
- Supabase Auth entegrasyonu
- Row Level Security (RLS)
- Şirket bazlı veri izolasyonu
- Rol tabanlı yetkilendirme

## 🛠️ Teknolojiler

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Charts**: Recharts
- **Date Utils**: date-fns

## 📋 Kurulum

### 1. Gereksinimleri Kontrol Edin

```bash
node -v  # v18 veya üzeri gerekli
npm -v   # veya yarn
```

### 2. Supabase Projesini Oluşturun

1. [Supabase](https://supabase.com) hesabı oluşturun
2. Yeni proje oluşturun
3. SQL Editor'de `dunyasan-erp-setup.sql` dosyasını çalıştırın
4. Project Settings → API bölümünden:
   - Project URL'ini alın
   - Anon/Public Key'i alın

### 3. Projeyi Kurun

```bash
# Klasöre gidin
cd dunyasan-erp-kod

# Bağımlılıkları yükleyin
npm install

# Environment dosyasını oluşturun
cp .env.local.example .env.local
```

### 4. Environment Variables Ayarlayın

`.env.local` dosyasını düzenleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcınızda `http://localhost:3000` adresini açın.

### 6. İlk Kullanıcıyı Oluşturun

1. `/register` sayfasına gidin
2. Email ve şifre ile kayıt olun
3. Email adresinizi doğrulayın
4. `/login` sayfasından giriş yapın

## 📁 Proje Yapısı

```
dunyasan-erp-kod/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Giriş sayfası
│   │   └── register/
│   │       └── page.tsx          # Kayıt sayfası
│   ├── dashboard/
│   │   ├── page.tsx              # Ana dashboard
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── production/
│   │   │   └── page.tsx          # Üretim takip
│   │   ├── machines/
│   │   │   └── page.tsx          # Tezgah yönetimi
│   │   └── inventory/
│   │       └── page.tsx          # Stok yönetimi
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Ana sayfa
│   └── globals.css               # Global stiller
├── lib/
│   └── supabase/
│       └── client.ts             # Supabase client
├── public/
│   └── dunyalogopng.png          # Logo dosyası
├── dunyasan-erp-setup.sql        # Database schema
├── DUNYASAN-ERP-KURULUM.md       # Detaylı kurulum rehberi
├── package.json
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 🎯 Modüller

### Tamamlanan Modüller
- ✅ Authentication (Giriş/Kayıt)
- ✅ Ana Dashboard
- ✅ Üretim Takip
- ✅ Tezgah Yönetimi
- ✅ Stok & Hammadde

### Planlanan Modüller
- ⏳ Üretim Planlama
- ⏳ Depo Yönetimi
- ⏳ Takımhane
- ⏳ Personel Yönetimi
- ⏳ Muhasebe
- ⏳ Faturalar
- ⏳ Cari Hesaplar
- ⏳ Raporlar
- ⏳ Ayarlar

## 🔧 Geliştirme

### Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## 📊 Database Schema

Veritabanı şeması `dunyasan-erp-setup.sql` dosyasında bulunmaktadır:

- **companies**: Şirket bilgileri
- **profiles**: Kullanıcı profilleri ve rolleri
- **production_orders**: Üretim emirleri
- **machines**: CNC tezgah bilgileri
- **inventory**: Stok ve envanter
- **tools**: Takımhane envanteri
- **warehouse_transactions**: Depo hareketleri
- **current_accounts**: Cari hesaplar
- **invoices**: Faturalar
- **production_plans**: Üretim planları
- **cost_records**: Maliyet kayıtları

## 🔐 Güvenlik Politikaları

Row Level Security (RLS) ile her şirket sadece kendi verilerine erişebilir:

```sql
-- Örnek RLS Policy
CREATE POLICY "Users can view own company data" ON production_orders
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );
```

## 🚀 Deployment

### Vercel

```bash
# Vercel CLI yükleyin
npm i -g vercel

# Deploy edin
vercel
```

### Environment Variables

Vercel'de aşağıdaki environment variables'ı ekleyin:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📞 Destek

Sorularınız için:
- 📧 Email: info@dunyasan.com
- 📱 Telefon: +90 (XXX) XXX XX XX

## 📄 Lisans

Bu proje DÜNYASAN Savunma Sistemleri A.Ş. için geliştirilmiştir.

---

**DÜNYASAN SAVUNMA SİSTEMLERİ A.Ş.**
Modern Üretim Yönetim Sistemi

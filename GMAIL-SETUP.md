# Gmail OAuth Kurulum Adımları

CRM'deki "Toplu Mail" özelliği için Gmail OAuth kurulumu gerekir. **Tek seferlik, 5-10 dakika sürer.**

## 1. Google Cloud Console'da Proje Oluştur

1. https://console.cloud.google.com adresine git
2. Üstte **proje seçici** → "Yeni Proje"
3. İsim: `Dunyasan ERP Mail` (veya istediğin)
4. **Oluştur**

## 2. Gmail API'yi Aktif Et

1. Sol menü → **API'ler ve Hizmetler** → **Kütüphane**
2. Ara: `Gmail API`
3. **Gmail API**'ye tıkla → **Etkinleştir**

## 3. OAuth Onay Ekranı Yapılandırma

1. Sol menü → **API'ler ve Hizmetler** → **OAuth onay ekranı**
2. Kullanıcı türü: **Harici** → Oluştur
3. **App information:**
   - App name: `DUNYASAN ERP`
   - User support email: kendi e-postan
   - Developer email: kendi e-postan
4. **Scopes** adımı: "Gmail API → gmail.send" + "userinfo.email" ekle (zaten kodda istiyoruz)
5. **Test users:** kendi gmail/workspace adresini ekle
6. Kaydet ve devam

## 4. OAuth 2.0 Kimlik Bilgileri Oluştur

1. Sol menü → **API'ler ve Hizmetler** → **Kimlik bilgileri**
2. **Kimlik bilgisi oluştur** → **OAuth istemci kimliği**
3. Uygulama türü: **Web uygulaması**
4. İsim: `Dunyasan ERP Web Client`
5. **Yetkili yeniden yönlendirme URI'leri** kısmına EKLE:
   - `https://dunyasan-erp.vercel.app/api/email/oauth/callback` (production)
   - `http://localhost:3000/api/email/oauth/callback` (development)
   - (gerçek Vercel domain'ini kullan)
6. **Oluştur**
7. Açılan pencereden **Client ID** ve **Client Secret**'i kopyala

## 5. Vercel'e Environment Variable Ekle

1. https://vercel.com → proje → **Settings** → **Environment Variables**
2. Şunları ekle:

| Name | Value | Environments |
|------|-------|--------------|
| `GOOGLE_CLIENT_ID` | (4. adımda kopyaladığın Client ID) | Production, Preview, Development |
| `GOOGLE_CLIENT_SECRET` | (4. adımda kopyaladığın Client Secret) | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://dunyasan-erp.vercel.app` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | (zaten varsa atla) | Production, Preview, Development |

3. **Save** ve redeploy

## 6. Lokal Geliştirme İçin (opsiyonel)

`.env.local` dosyasına ekle:

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 7. Kullanım

1. CRM sayfasına git
2. Sağ üst köşede **"Gmail Bağla"** butonuna bas
3. Google hesabını seç → izinleri onayla
4. Geri yönlendirileceksin, "✅ Gmail başarıyla bağlandı" göreceksin
5. Artık **"Toplu Mail"** butonu aktif

## Notlar

- **Test modu:** OAuth onay ekranı "Test modu"ndayken sadece "Test users" listesindeki hesaplar bağlanabilir.
- **Yayına alma:** Üretim için Google'a uygulama doğrulama başvurusu yapman gerekir (Gmail API "kısıtlı" scope kullandığı için). 1-2 hafta sürer. Şirket içi kullanım için "Test modu" + workspace organizasyonu ile sınırsız kullanım da mümkün.
- **Günlük limit:**
  - Ücretsiz Gmail: ~500 mail/gün
  - Google Workspace: ~2.000 mail/gün
- **Spam:** Gmail'den toplu mail göndermek deliverability açısından idealdir (kendi domain'inle SPF/DKIM/DMARC ayarlıysa).
- **Şablon değişkenleri:** `{firma}`, `{yetkili}`, `{ulke}`, `{telefon}`, `{email}` — her mailde otomatik kişiselleştirilir.

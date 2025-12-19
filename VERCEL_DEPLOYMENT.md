# 🚀 Vercel'e Deployment Rehberi

## ⚠️ ÖNEMLİ: Deployment Öncesi Hazırlık

Vercel'e deployment yapmadan önce **mutlaka** şunları tamamlayın:

1. ✅ Supabase database kurulumu ve schema oluşturma
2. ✅ SQLite'tan Supabase'e veri migrasyonu
3. ✅ Backend kodunu Supabase'e adapte etme

**NEDEN?** Çünkü Vercel serverless platform'dur ve şu anki Express server'ınız Vercel'de çalışmaz. Önce backend'i Supabase'e taşımalıyız.

---

## 📋 Deployment Seçenekleri

### Seçenek 1: GitHub ile Otomatik Deployment (ÖNERİLEN) ⭐

En kolay ve önerilen yöntem. Her commit'te otomatik deploy olur.

#### Adımlar:

**1. GitHub Repository Oluşturun/Güncelleyin**

```bash
# Eğer henüz git repository yoksa
git init
git add .
git commit -m "Initial commit - Ready for Vercel deployment"

# GitHub'da yeni repo oluşturun ve push edin
git remote add origin https://github.com/KULLANICI_ADINIZ/based-traders.git
git branch -M main
git push -u origin main
```

**2. Vercel'e Gidin**

- https://vercel.com adresine gidin
- GitHub hesabınızla giriş yapın

**3. Yeni Proje Oluşturun**

- "Add New Project" butonuna tıklayın
- GitHub repository'nizi seçin (`based-traders`)
- "Import" butonuna tıklayın

**4. Proje Ayarlarını Yapın**

Vercel otomatik olarak tespit edecektir:
- **Framework Preset:** Vite ✅
- **Root Directory:** `./` ✅
- **Build Command:** `npm run build` ✅
- **Output Directory:** `dist` ✅

**5. Environment Variables Ekleyin**

"Environment Variables" bölümünde şunları ekleyin:

**Frontend Variables (VITE_ prefix):**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_WALLETCONNECT_PROJECT_ID=fe5cba6a3f99f7da13a7f4d58d9bee81
```

**Backend Variables:**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci... (⚠️ GİZLİ!)
ADMIN_FIDS=326821
CRON_SECRET=random_secret_string_here
```

**Blockchain Variables (İsteğe Bağlı):**
```
ACHIEVEMENT_CONTRACT_ADDRESS=0x...
MINT_WALLET_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

⚠️ **ÖNEMLİ:** Tüm environment variable'ları **Production, Preview ve Development** için ekleyin!

**6. Deploy Edin**

- "Deploy" butonuna tıklayın
- 2-5 dakika bekleyin
- Deployment tamamlandığında URL'inizi göreceksiniz (örn: `https://based-traders.vercel.app`)

---

### Seçenek 2: Vercel CLI ile Manuel Deployment

Komut satırından deploy etmek isterseniz:

**1. Vercel CLI Kurun**

```bash
npm install -g vercel
```

**2. Vercel'e Login Olun**

```bash
vercel login
```

**3. İlk Deployment**

```bash
vercel
```

Sorulara cevap verin:
- Set up and deploy? → **Y**
- Which scope? → Hesabınızı seçin
- Link to existing project? → **N**
- What's your project's name? → **based-traders**
- In which directory is your code? → **./** (Enter)
- Auto-detected settings? → **Y**

**4. Environment Variables Ekleyin**

```bash
# Interaktif olarak eklemek için
vercel env add

# Veya Vercel Dashboard'dan ekleyin
```

**5. Production'a Deploy**

```bash
vercel --prod
```

---

## 🔧 Deployment Sonrası Ayarlar

### 1. Custom Domain Eklemek (İsteğe Bağlı)

Vercel Dashboard → Settings → Domains:
- Domain adınızı ekleyin (örn: `basetraders.vercel.app`)
- DNS kayıtlarını güncelleyin
- SSL sertifikası otomatik oluşturulur

### 2. Vercel Cron Job Eklemek

**NOT:** Şu anda `vercel.json` dosyasında cron job yok. Price update için ekleyelim:

```json
{
  "crons": [{
    "path": "/api/cron/update-prices",
    "schedule": "* * * * *"
  }]
}
```

### 3. Build & Deployment Settings

Vercel Dashboard → Settings → General:
- **Node.js Version:** 18.x veya 20.x
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

---

## 🐛 Yaygın Sorunlar ve Çözümler

### ❌ Build Hatası: "Module not found"

**Çözüm:**
```bash
# Local'de test edin
npm install
npm run build

# Eğer çalışıyorsa, package.json'ı commit edin
git add package.json package-lock.json
git commit -m "Fix dependencies"
git push
```

### ❌ API Endpoint'ler 404 Veriyor

**Sebep:** Backend henüz Supabase'e taşınmadı.

**Çözüm:** Backend migrasyonunu tamamlayın (aşağıda anlatılıyor).

### ❌ Environment Variables Çalışmıyor

**Çözüm:**
- Vercel Dashboard → Settings → Environment Variables
- Her variable'ın **Production, Preview, Development** için eklendiğinden emin olun
- Redeploy edin: Dashboard → Deployments → ... → Redeploy

### ❌ Farcaster Manifest Bulunamıyor

**Çözüm:**
- `public/.well-known/farcaster.json` dosyasının olduğundan emin olun
- Vercel build log'larını kontrol edin

---

## 🎯 ŞU AN YAPMANIZ GEREKENLER

### Durum: Backend Henüz Hazır Değil ⚠️

Şu anki `server/unified.ts` Express server'ı Vercel'de **çalışmaz**.

**İki seçeneğiniz var:**

#### 🅰️ Seçenek A: Önce Backend'i Hazırla (ÖNERİLEN)

1. Database layer'ı Supabase'e geçir
2. Tüm API endpoint'lerini test et
3. Sonra Vercel'e deploy et

✅ **Avantaj:** Deploy ettiğinizde her şey çalışır
❌ **Dezavantaj:** Biraz daha zaman alır

#### 🅱️ Seçenek B: Şimdi Deploy Et, Sonra Düzelt

1. Şimdi sadece frontend'i deploy et
2. API endpoint'ler çalışmaz (404 verir)
3. Backend migrasyonu bittikten sonra tekrar deploy et

✅ **Avantaj:** Hızlıca preview görebilirsiniz
❌ **Dezavantaj:** Uygulama çalışmaz, sadece görsel

---

## 🚦 Önerilen Deployment Sırası

```
1. ✅ Supabase schema oluştur (TAMAMLANDI)
2. ⏳ Supabase credentials ekle (.env)
3. ⏳ npm install çalıştır
4. ⏳ Veri migrasyonunu yap (npm run migrate:supabase)
5. ⏳ Backend'i Supabase'e adapte et
6. ⏳ Local'de test et
7. ⏳ GitHub'a push et
8. ⏳ Vercel'e deploy et
9. ⏳ Production'da test et
```

---

## 📞 Yardım

Herhangi bir sorunla karşılaşırsanız:

1. Vercel build logs'ları kontrol edin
2. Browser console'u kontrol edin
3. Vercel Dashboard → Deployments → Log detaylarına bakın

---

**Hazır mısınız? Hangi seçeneği tercih ediyorsunuz?**

- **A:** Önce backend'i tamamen hazırlayalım, sonra deploy edelim (önerilen)
- **B:** Şimdi deploy edip sonra backend'i düzeltelim

Kararınızı söyleyin, ona göre devam edelim! 🚀

# 🎯 Migration TODO - Supabase + Vercel

## ⚡ Hızlı Başlangıç (5-6 Saat)

---

## 1️⃣ SUPABASE KURULUMU (30 dakika)

### A. Proje Oluştur
```
□ https://supabase.com adresine git
□ "New Project" butonuna tıkla
□ Proje adı: based-traders
□ Database şifresi belirle ve KAYDET! 📝
□ Region seç (en yakın bölge)
□ "Create new project" tıkla
□ 2 dakika bekle (proje hazırlanıyor)
```

### B. Database Schema Çalıştır
```
□ Supabase Dashboard → sol menüden "SQL Editor"
□ "New query" butonuna tıkla
□ supabase-schema.sql dosyasını aç
□ İçeriği tamamen kopyala (Ctrl+A, Ctrl+C)
□ SQL Editor'e yapıştır (Ctrl+V)
□ "Run" butonuna tıkla (sağ alt köşe)
□ "Success" mesajını bekle
```

### C. Tabloları Kontrol Et
```
□ Supabase Dashboard → "Table Editor"
□ Şu tabloların oluştuğunu doğrula:
  □ players (8 kolon)
  □ tokens (9 kolon)
  □ positions (14 kolon)
  □ price_history (4 kolon)
  □ config (3 kolon)
  □ achievements (8 kolon)
```

### D. Realtime'ı Aktifleştir
```
□ Database → Replication (sol menü)
□ "tokens" tablosunu bul
□ Sağındaki toggle'ı aç (yeşil yap)
□ "Save" butonuna tıkla
```

### E. API Credential'ları Kaydet
```
□ Settings → API (sol menü)
□ Şunları kopyala ve güvenli bir yere kaydet:

  Project URL:
  □ https://xxxxx.supabase.co

  API Keys:
  □ anon public: eyJhbGciOi... (kopyala)
  □ service_role: eyJhbGciOi... (kopyala) ⚠️ GİZLİ TUT!
```

---

## 2️⃣ LOKAL KURULUM (30 dakika)

### A. Supabase Client Kur
```bash
npm install @supabase/supabase-js
```

### B. Environment Variables Ayarla
```
□ .env.local dosyası oluştur (proje root'da)
□ Şu bilgileri doldur:

# Supabase (방금 kopyaladığın bilgiler)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...

# Diğer mevcut değerlerini de ekle (.env dosyandan)
ADMIN_FIDS=326821
VITE_WALLETCONNECT_PROJECT_ID=...
# vb.
```

### C. Migration Script'ini Güncelle
```
□ package.json.new dosyasını package.json olarak kaydet
□ npm install çalıştır
```

### D. SQLite Backup Al
```bash
# Mevcut database'in yedeğini al
cp traders.db traders.db.backup
```

---

## 3️⃣ DATA MIGRATION (30 dakika)

### A. Migration Çalıştır
```bash
# Migration script'ini çalıştır
npm run migrate:supabase
```

### B. Sonucu Kontrol Et
```
□ Terminal'de "✅ Migration completed successfully!" mesajını gör
□ Hatalar varsa not al

Terminal çıktısında kontrol et:
  □ X players migrated
  □ X tokens migrated
  □ X positions migrated
  □ X price history records migrated
  □ X config entries migrated
  □ X achievements migrated
```

### C. Supabase'de Doğrula
```
□ Supabase Dashboard → Table Editor
□ Her tabloya tıkla ve verileri kontrol et:

  players:
  □ Kullanıcı sayısı doğru mu?
  □ cash, high_score değerleri var mı?

  tokens:
  □ BATR, BTC, ETH, SOL var mı?
  □ current_price değerleri var mı?

  positions:
  □ Açık pozisyonlar var mı?
  □ Kapalı pozisyonlar var mı?
```

---

## 4️⃣ KOD GÜNCELLEMELERİ (1 saat)

### A. Database Layer Değiştir
```bash
# Eski db.ts'i yedekle
mv server/db.ts server/db.ts.sqlite-backup

# Yeni Supabase client'ı kullan
mv server/supabase-db.ts server/db.ts
```

### B. Price Engine'i Güncelle

**TradingInterface.tsx'i güncelle:**
```typescript
// ESKİ (4. satır)
import { priceEngine } from '../lib/priceEngine'

// YENİ
import { priceEngine } from '../lib/supabaseRealtime'
```

```
□ src/components/TradingInterface.tsx dosyasını aç
□ 4. satırdaki import'u değiştir
□ Kaydet (Ctrl+S)
```

### C. Lokal Test
```bash
# Lokalde çalıştır
npm run dev
```

**Tarayıcıda test et:**
```
□ http://localhost:5173 aç
□ Farcaster ile giriş yap
□ Trading sayfasına git
□ Pozisyon aç/kapa
□ Fiyatların güncellendiğini gör (console'da kontrol et)
```

**Sorun çıkarsa:**
```
□ Browser console'u aç (F12)
□ Hataları oku
□ .env.local'deki credential'ları kontrol et
□ Supabase Dashboard → Logs kontrol et
```

---

## 5️⃣ VERCEL DEPLOYMENT (30 dakika)

### A. Vercel Projesi Oluştur
```
□ https://vercel.com/login adresine git
□ GitHub ile giriş yap
□ "Add New Project" tıkla
□ based-traders repository'sini seç
□ "Import" tıkla
```

### B. Build Settings Kontrol
```
Framework Preset: Vite ✓ (otomatik seçilmeli)
Root Directory: ./ ✓
Build Command: npm run build ✓
Output Directory: dist ✓

□ Ayarlar doğruysa "Deploy" butonunu henüz TIKLAMA!
```

### C. Environment Variables Ekle
```
□ "Environment Variables" sekmesine tıkla

Frontend için (VITE_ prefix):
□ VITE_SUPABASE_URL = https://xxxxx.supabase.co
□ VITE_SUPABASE_ANON_KEY = eyJhbGci...
□ VITE_WALLETCONNECT_PROJECT_ID = ...

Backend için:
□ SUPABASE_URL = https://xxxxx.supabase.co
□ SUPABASE_ANON_KEY = eyJhbGci...
□ SUPABASE_SERVICE_KEY = eyJhbGci... ⚠️
□ ADMIN_FIDS = 326821
□ ACHIEVEMENT_CONTRACT_ADDRESS = 0x...
□ MINT_WALLET_PRIVATE_KEY = 0x... ⚠️
□ BASE_RPC_URL = https://mainnet.base.org
□ BASESCAN_API_KEY = ...
□ CRON_SECRET = (rastgele bir string oluştur)

Her değişken için:
□ Environments: Production ✓, Preview ✓, Development ✓
□ "Add" butonuna tıkla
```

### D. İlk Deploy
```
□ "Deploy" butonuna tıkla
□ Build log'larını izle (2-5 dakika)
□ "Deployment Ready" mesajını bekle
□ Deployment URL'ini kopyala (örn: https://based-traders.vercel.app)
```

---

## 6️⃣ PRICE UPDATER WORKER (1 saat)

### A. Cron Endpoint Oluştur

**api/cron/update-prices.ts dosyasını oluştur:**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron secret kontrolü
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Aktif tokenları al
    const { data: tokens } = await supabase
      .from('tokens')
      .select('*')
      .eq('is_active', true)

    const prices: Record<string, number> = {}

    // Her token için fiyat güncelle
    for (const token of tokens || []) {
      let price = token.current_price

      if (token.is_real_crypto) {
        // Gerçek kripto için Binance/CoinGecko API'den çek
        // (Şimdilik simüle et)
        const volatility = 0.001
        const change = (Math.random() - 0.5) * 2 * volatility
        price = price * (1 + change)
      } else {
        // Oyun tokenları için simüle et
        const volatility = 0.004
        const change = (Math.random() - 0.5) * 2 * volatility
        price = price * (1 + change)
      }

      // Database'de güncelle
      await supabase
        .from('tokens')
        .update({ current_price: price })
        .eq('id', token.id)

      // Price history'ye kaydet
      await supabase
        .from('price_history')
        .insert({
          token_id: token.id,
          price: price,
          timestamp: Date.now()
        })

      prices[token.symbol] = price
    }

    // Realtime'a broadcast et
    const channel = supabase.channel('price_updates')
    await channel.send({
      type: 'broadcast',
      event: 'price_update',
      payload: { prices, timestamp: Date.now() }
    })

    return res.status(200).json({ success: true, prices })
  } catch (error: any) {
    console.error('Price update error:', error)
    return res.status(500).json({ error: error.message })
  }
}
```

### B. vercel.json'a Cron Ekle

**vercel.json dosyasını güncelle (crons kısmını ekle):**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "crons": [{
    "path": "/api/cron/update-prices",
    "schedule": "* * * * *"
  }],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### C. Değişiklikleri Deploy Et
```bash
# Commit ve push
git add .
git commit -m "Add Supabase + Vercel support with price cron"
git push origin main
```

```
□ Vercel otomatik deploy başlatacak
□ Vercel Dashboard → Deployments'ta izle
□ "Deployment Ready" bekle
```

### D. Cron'u Kontrol Et
```
□ Vercel Dashboard → Project → Cron Jobs
□ "update-prices" işini gör
□ "Logs" butonuna tıkla
□ Her dakika çalıştığını doğrula
□ Hata varsa log'ları kontrol et
```

---

## 7️⃣ ÜRETİM TESTİ (1 saat)

### A. Deployment URL'de Test

**URL:** `https://your-project.vercel.app`

**Authentication:**
```
□ Sayfayı aç
□ Farcaster ile giriş yap
□ Profil bilgileri yükleniyor mu?
```

**Trading:**
```
□ Trading sayfasını aç
□ Token seç (BTC, ETH, SOL, BATR)
□ Pozisyon aç (LONG)
  □ Amount gir
  □ Leverage seç
  □ "Open Position" tıkla
  □ Pozisyon açıldı mı?
□ Pozisyonu kapat
  □ "Close Position" tıkla
  □ PnL doğru mu?
```

**Real-time:**
```
□ Browser console aç (F12)
□ Trading sayfasında kal
□ Fiyatların her saniye güncellendiğini gör
□ Position PnL'in değiştiğini gör
□ WebSocket hatası YOK
□ Supabase Realtime bağlantısı VAR
```

**Leaderboard:**
```
□ Leaderboard sayfasını aç
□ Oyuncular listesi yükleniyor mu?
□ Sıralama doğru mu?
```

**Profile:**
```
□ Profile sayfasını aç
□ İstatistikler doğru mu?
□ Achievements görünüyor mu?
```

**Admin (eğer admin isen):**
```
□ Admin Panel aç
□ Token ekle/düzenle/sil
□ Config düzenle
□ Achievement ekle
```

### B. Performance Kontrol
```
□ Google Lighthouse çalıştır
□ Performance score > 70
□ Page load time < 3 saniye
```

### C. Hata Kontrolü
```
□ Vercel Dashboard → Logs
□ Son 1 saatteki log'ları kontrol et
□ Error count = 0
```

---

## 8️⃣ MONITORING (30 dakika)

### A. Vercel Dashboard
```
□ Functions → Execution sayısı
□ Functions → Error rate < %1
□ Cron Jobs → Son çalışma zamanı
□ Logs → Critical error yok
```

### B. Supabase Dashboard
```
□ Database → Size < 50MB (free tier limit: 500MB)
□ API → Request count
□ Realtime → Active connections
□ Logs → Error yok
```

### C. Alertler Kur (Opsiyonel)
```
□ Vercel → Integrations → Slack
□ Supabase → Project Settings → Webhooks
```

---

## 9️⃣ GO LIVE (30 dakika)

### A. Domain Ayarla (Opsiyonel)
```
□ Vercel Dashboard → Settings → Domains
□ "Add Domain" tıkla
□ Domain adını gir (örn: basetraders-hcniclcms-ggbrotrs-projects.vercel.app)
□ DNS kayıtlarını güncelle (Cloudflare'de)
□ SSL sertifikası otomatik oluşsun (2-5 dakika)
```

### B. Cloudflare'den Geçiş

**ÖNCE TEST ET! (A/B Testing):**
```
□ Vercel URL'de herşey çalışıyor
□ 24-48 saat test et
□ Kullanıcılardan feedback al
□ Sorun yoksa DNS güncelle
```

**DNS Güncelleme (Cloudflare):**
```
□ Cloudflare Dashboard → DNS
□ A record'u güncelle:
  - Type: CNAME
  - Name: @
  - Content: cname.vercel-dns.com
  - Proxy: ON (turuncu bulut)
□ Save
□ 10-15 dakika bekle (DNS propagation)
```

### C. Final Kontrol
```
□ Domain'den siteye eriş
□ HTTPS çalışıyor mu? (kilit ikonu)
□ Tüm özellikler çalışıyor mu?
□ Hata yok
```

---

## 🎯 SUCCESS CRITERIA

### Migration başarılı sayılır eğer:

**Data:**
```
✓ Tüm players Supabase'de
✓ Tüm positions migrated
✓ Tüm price history migrated
✓ Hiç veri kaybı yok
```

**Functionality:**
```
✓ Login çalışıyor
✓ Trading çalışıyor
✓ Pozisyon aç/kapa çalışıyor
✓ Fiyatlar real-time güncelleniyor
✓ Leaderboard çalışıyor
✓ Admin panel çalışıyor
✓ Achievement sistem çalışıyor
```

**Performance:**
```
✓ Page load < 3 saniye
✓ API response < 500ms
✓ Realtime latency < 1 saniye
✓ Error rate < %1
```

**Infrastructure:**
```
✓ Vercel deployment working
✓ Supabase database healthy
✓ Cron job running
✓ SSL certificate active
✓ Domain working (eğer set ettiysen)
```

---

## 🚨 ROLLBACK PLANI

### Eğer bir şeyler ters giderse:

**1. Hemen:**
```
□ Cloudflare deployment'ını AÇIK TUT
□ DNS'i değiştirme
□ Kullanıcılar eski sistemi kullanmaya devam etsin
```

**2. Debug:**
```
□ Vercel logs kontrol et
□ Supabase logs kontrol et
□ Browser console kontrol et
□ Hatayı tespit et
```

**3. Fix veya Rollback:**

**Fix (tercih edilir):**
```
□ Hatayı düzelt
□ Git commit & push
□ Vercel otomatik deploy edecek
□ Test et
```

**Rollback (son çare):**
```
□ Database: traders.db.backup kullan
□ Code: git revert <commit>
□ Vercel: Previous deployment'a rollback et
```

---

## 💰 MALIYET

### Supabase (Free Tier):
```
✓ Database: 500 MB (şu an ~10 MB kullanıyorsun)
✓ Bandwidth: 2 GB/month
✓ API Requests: Unlimited
✓ Realtime: 200 concurrent connections
✓ Maliyet: $0/month
```

### Vercel (Hobby Plan):
```
✓ Bandwidth: 100 GB/month
✓ Serverless Functions: Unlimited executions
✓ Cron Jobs: Included
✓ Build time: 6000 minutes/month
✓ Maliyet: $0/month
```

**TOPLAM: $0/month** (free tier limitleri içinde)

---

## ⏱️ TIMELINE

```
Phase 1: Supabase Setup        → 30 min   ✓
Phase 2: Local Setup           → 30 min   ✓
Phase 3: Data Migration        → 30 min   ✓
Phase 4: Code Updates          → 1 hour   ✓
Phase 5: Vercel Deploy         → 30 min   ✓
Phase 6: Price Worker          → 1 hour   ✓
Phase 7: Testing               → 1 hour   ✓
Phase 8: Monitoring            → 30 min   ✓
Phase 9: Go Live               → 30 min   ✓

TOPLAM: ~5-6 SAAT
```

---

## 📞 YARDIM

### Sorun mu yaşıyorsun?

**1. Dokümantasyon:**
```
□ SUPABASE_VERCEL_MIGRATION.md (detaylı guide)
□ MIGRATION_CHECKLIST.md (checklist)
□ README.md (genel bilgi)
```

**2. Logs Kontrol:**
```
□ Vercel → Functions → Logs
□ Supabase → Logs
□ Browser → Console (F12)
```

**3. Common Issues:**

**"SUPABASE_URL is not defined"**
→ .env.local dosyasını kontrol et
→ Vercel'de Environment Variables kontrol et

**"Prices not updating"**
→ Vercel Cron logs kontrol et
→ CRON_SECRET doğru mu kontrol et

**"Cannot connect to database"**
→ SUPABASE_SERVICE_KEY doğru mu?
→ Supabase project çalışıyor mu?

**"Realtime not working"**
→ Database → Replication enabled mi?
→ Browser console'da error var mı?

**4. Kaynaklar:**
```
□ Supabase Docs: https://supabase.com/docs
□ Vercel Docs: https://vercel.com/docs
□ Supabase Discord: https://discord.supabase.com
```

---

## ✅ ŞİMDİ NE YAPACAKSIN?

### Adım adım git:

1. **BUGÜN (2 saat):**
   ```
   □ Supabase projesi oluştur
   □ Schema çalıştır
   □ Credential'ları kaydet
   ```

2. **YARIN (3 saat):**
   ```
   □ Lokal setup
   □ Data migration
   □ Code updates
   □ Lokal test
   ```

3. **SONRAKI GÜN (1 saat):**
   ```
   □ Vercel deploy
   □ Price worker setup
   □ Production test
   ```

**VEYA HEPSİNİ BİR GÜNDE YAPABILIRSIN! (5-6 saat)**

---

## 🚀 BAŞLAMAYA HAZIR MISIN?

İlk adım: https://supabase.com adresine git!

Başarılar! 🎉

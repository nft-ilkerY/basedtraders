# VDS Deployment Guide - Based Traders

## Gereksinimler
- Node.js v18 veya üzeri
- npm veya yarn
- PM2 (process manager - önerilir)

## Deployment Adımları

### 1. Projeyi VDS'e Yükleyin
```bash
# SSH ile VDS'e bağlanın
ssh kullanici@vds-ip-adresi

# Proje dizinini oluşturun
mkdir -p /var/www/based-traders
cd /var/www/based-traders

# Projeyi yükleyin (git kullanarak veya dosya transferi ile)
git clone <repo-url> .
# veya
# scp -r proje-klasoru kullanici@vds-ip:/var/www/based-traders
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Frontend'i Build Edin
```bash
npm run build
```

### 4. Production Environment Dosyası Oluşturun
```bash
# .env.production dosyasını düzenleyin
nano .env.production
```

Içerik:
```
NODE_ENV=production
PORT=3000
```

### 5. PM2 ile Servisi Başlatın (Önerilen)
```bash
# PM2'yi global olarak yükleyin (henüz yüklemediyseniz)
npm install -g pm2

# Servisi başlatın
pm2 start ecosystem.config.js

# PM2'nin sistem başlangıcında otomatik başlamasını sağlayın
pm2 startup
pm2 save
```

### 6. Alternatif: Screen veya Tmux ile Başlatın
```bash
# Screen kullanarak
screen -S based-traders
npm start

# Ctrl+A+D ile screen'den çıkın
```

### 7. Alternatif: Systemd Service Oluşturun
```bash
# Service dosyası oluşturun
sudo nano /etc/systemd/system/based-traders.service
```

İçerik:
```
[Unit]
Description=Based Traders Trading Game
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/based-traders
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Servisi başlatın:
```bash
sudo systemctl daemon-reload
sudo systemctl enable based-traders
sudo systemctl start based-traders
sudo systemctl status based-traders
```

### 8. Firewall Ayarları
```bash
# Port 3000'i açın
sudo ufw allow 3000/tcp

# Firewall durumunu kontrol edin
sudo ufw status
```

### 9. Nginx Reverse Proxy (Opsiyonel ama Önerilen)
Eğer domain kullanacaksanız ve HTTPS eklemek istiyorsanız:

```bash
sudo nano /etc/nginx/sites-available/based-traders
```

İçerik:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Nginx'i etkinleştirin:
```bash
sudo ln -s /etc/nginx/sites-available/based-traders /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Test Etme
```bash
# Local test
curl http://localhost:3000/api/price

# Dışarıdan test (VDS IP adresi ile)
curl http://vds-ip-adresi:3000/api/price
```

## Monitoring
```bash
# PM2 kullanıyorsanız
pm2 status
pm2 logs based-traders
pm2 monit

# Systemd kullanıyorsanız
sudo systemctl status based-traders
sudo journalctl -u based-traders -f
```

## Güncelleme
```bash
# Uygulamayı durdurun
pm2 stop based-traders

# Güncellemeleri çekin
git pull

# Bağımlılıkları güncelleyin
npm install

# Frontend'i yeniden build edin
npm run build

# Uygulamayı başlatın
pm2 restart based-traders
```

## Sorun Giderme

### Port 3000 kullanımda hatası
```bash
# Portu kullanan process'i bulun
sudo lsof -i :3000
# veya
sudo netstat -tulpn | grep 3000

# Process'i sonlandırın
sudo kill -9 <PID>
```

### Database hataları
```bash
# Database dosyasının yazma izinlerini kontrol edin
ls -la traders.db
chmod 664 traders.db
```

### Memory issues
```bash
# PM2 memory limitini artırın
pm2 start ecosystem.config.js --max-memory-restart 2G
```

## Önemli Notlar
- **PORT 3000** VDS firewall'da açık olmalı
- Production modda CORS devre dışı (güvenlik için)
- WebSocket bağlantıları `/ws` endpoint'inden yapılmalı
- Database dosyası (`traders.db`) yedeklenmelidir
- Logları düzenli kontrol edin

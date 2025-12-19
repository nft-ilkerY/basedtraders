# 🔒 Soulbound Achievement NFT - Complete Deployment Guide

## 🎯 What's Different?

Bu achievement NFT'leri **Soulbound (SBT)** - yani:
- ❌ Transfer edilemez
- ❌ Satılamaz
- ❌ Approve edilemez
- ✅ Sadece mint edilir ve sonsuza kadar sahibine aittir
- ✅ True achievement rozetleri gibi

## 📦 Prerequisites

```bash
cd F:\BASEAPPS\2\based-traders

# Install Hardhat & dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts ethers

# Initialize Hardhat
npx hardhat init
# Select "Create a TypeScript project"
```

## ⚙️ Environment Setup

`.env` dosyasına ekle:

```bash
# Deployment wallet (Base'de ETH olmalı)
DEPLOYER_PRIVATE_KEY=0x...

# Mint wallet (backend tarafından kullanılacak)
MINT_WALLET_PRIVATE_KEY=0x...

# Base RPC
BASE_RPC_URL=https://mainnet.base.org

# BaseScan API Key (verification için)
BASESCAN_API_KEY=...

# Contract address (deploy sonrası eklenecek)
ACHIEVEMENT_CONTRACT_ADDRESS=
```

## 🚀 Step 1: Deploy Contract

### Test Network (Base Sepolia) - ÖNCE BU!

```bash
# Base Sepolia'ya deploy
npx hardhat run scripts/deploy.ts --network base-sepolia
```

Output:
```
🚀 Deploying BasedTradersAchievements to Base...

📝 Deploying with account: 0x...
💰 Account balance: 0.05 ETH

⏳ Deploying contract...
✅ Contract deployed to: 0xYourContractAddress
🔗 View on BaseScan: https://sepolia.basescan.org/address/0xYourContractAddress

⏳ Waiting for 5 confirmations...
✅ Confirmed!

📋 Add these to your .env file:
=====================================
ACHIEVEMENT_CONTRACT_ADDRESS=0xYourContractAddress
=====================================
```

### Mainnet (Base)

```bash
# Production deploy
npx hardhat run scripts/deploy.ts --network base
```

## 🔍 Step 2: Verify Contract

```bash
# Verify on BaseScan
npx hardhat verify --network base-sepolia 0xYourContractAddress

# Or for mainnet
npx hardhat verify --network base 0xYourContractAddress
```

## 🎯 Step 3: Setup Achievements on Contract

Contract'a achievement metadata'sını yükle:

```bash
# .env'de ACHIEVEMENT_CONTRACT_ADDRESS olmalı
npx hardhat run scripts/setup-achievements.ts --network base-sepolia

# Or for mainnet
npx hardhat run scripts/setup-achievements.ts --network base
```

Output:
```
🎯 Setting up achievements on contract: 0x...

📝 Using account: 0x...

⏳ Setting up 9 achievements...

📝 Setting achievement 1: First Trade...
✅ Achievement 1 set successfully
📝 Setting achievement 2: Trader...
✅ Achievement 2 set successfully
...

✅ All achievements configured!
🎯 Your contract is ready for minting!
```

## 🔧 Step 4: Update .env

```bash
# .env dosyasına ekle
ACHIEVEMENT_CONTRACT_ADDRESS=0xYourDeployedContractAddress
MINT_WALLET_PRIVATE_KEY=0xYourMintWalletPrivateKey
BASE_RPC_URL=https://mainnet.base.org
```

**ÖNEMLİ:** Mint wallet'ın Base'de ETH'si olmalı (gas için)!

## 🎨 Step 5: Upload Achievement Images

Achievement görselleri için iki seçenek:

### Option A: Self-hosted

```bash
# public/achievements/ klasörüne PNG'leri koy
public/achievements/
  ├── 1.png  (First Trade)
  ├── 2.png  (Trader)
  ├── 3.png  (Pro Trader)
  ├── 4.png  (Master)
  ├── 5.png  (Winner)
  ├── 6.png  (Big Win)
  ├── 7.png  (Profit Maker)
  ├── 8.png  (Diamond Hands)
  └── 9.png  (Sharp Trader)
```

Metadata endpoint zaten hazır: `https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/{id}.png`

### Option B: IPFS

```bash
# Upload to IPFS
# Get IPFS hashes
# Update setup-achievements.ts imageURI fields
```

## 🧪 Step 6: Test Everything

### Test 1: Admin Panel'den Achievement Ekle

1. Admin panel'e gir
2. Achievements tab
3. Yeni achievement ekle
4. Active olarak işaretle

### Test 2: Achievement Kazan

1. Trading yap
2. Achievement kriterini karşıla
3. Profile sayfasında achievement görünmeli

### Test 3: Mint Test

1. Profile sayfasında "Mint as NFT" butonuna tıkla
2. Transaction bekle
3. BaseScan'de kontrol et
4. OpenSea'de görünmeli (birkaç dakika sonra)

## 🔒 Soulbound Features

Contract'ta aşağıdaki işlemler **REVERTes edilir**:

```solidity
// ❌ Transfer - BLOCKED
transferFrom(from, to, tokenId) // Revert!

// ❌ Safe Transfer - BLOCKED
safeTransferFrom(from, to, tokenId) // Revert!

// ❌ Approve - BLOCKED
approve(spender, tokenId) // Revert!

// ❌ Approval For All - BLOCKED
setApprovalForAll(operator, approved) // Revert!

// ✅ Mint - ALLOWED
mint(to, achievementId) // Only by owner
```

## 📊 Contract Functions

### Owner Functions (Admin only)

```typescript
// Set achievement metadata
setAchievement(
  achievementId: uint256,
  name: string,
  description: string,
  imageURI: string,
  rarity: string
)

// Mint achievement to user
mint(
  to: address,
  achievementId: uint256
) returns (uint256 tokenId)
```

### Public View Functions

```typescript
// Check if user has minted achievement
hasMinted(user: address, achievementId: uint256) returns (bool)

// Get user's achievement IDs
getUserAchievements(user: address) returns (uint256[])

// Get achievement metadata
getAchievement(achievementId: uint256) returns (Achievement)

// Get total supply
totalSupply() returns (uint256)
```

## 💰 Gas Estimates (Base Mainnet)

| Operation | Gas | Cost @ 0.001 gwei |
|-----------|-----|-------------------|
| Deploy Contract | ~2,500,000 | ~$0.60 |
| Set Achievement | ~60,000 | ~$0.015 |
| Mint NFT | ~170,000 | ~$0.04 |

## 🔗 Important Links

**Base Mainnet:**
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org
- Chain ID: 8453

**Base Sepolia (Testnet):**
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- Chain ID: 84532
- Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

**Resources:**
- OpenSea (Base): https://opensea.io/assets/base/
- Base Docs: https://docs.base.org
- Hardhat: https://hardhat.org

## 🛠️ Troubleshooting

### "Insufficient funds for gas"
- Mint wallet'ta Base ETH olmalı
- Bridge: https://bridge.base.org

### "Already minted this achievement"
- Her achievement kullanıcı başına sadece 1 kez mintlenebilir
- Database'de zaten var olabilir

### "Achievement not earned yet"
- Backend validation yapıyor
- Kullanıcının gerçekten achievement'ı kazanmış olması gerekiyor

### "Soulbound token - transfers are not allowed"
- Bu normal! Transfer edilemez NFT'ler
- Tasarım gereği böyle

### Contract verification failed
- Compiler version kontrol et: 0.8.20
- Optimizer enabled: true, runs: 200
- Constructor arguments yok

## 🎉 Deployment Checklist

- [ ] Hardhat kuruldu
- [ ] Contract deploy edildi (Base Sepolia)
- [ ] Contract verify edildi
- [ ] Achievement metadata yüklendi
- [ ] .env güncellendi
- [ ] Achievement görselleri eklendi
- [ ] Test mint yapıldı
- [ ] OpenSea'de göründü
- [ ] Mainnet'e deploy edildi ✨

## 🚨 Security Notes

1. **Private Keys:**
   - MINT_WALLET_PRIVATE_KEY'i kimseyle paylaşma
   - .env dosyasını git'e ekleme (.gitignore'da olmalı)

2. **Mint Wallet:**
   - Sadece minting için kullan
   - Minimum ETH tut (gas için)
   - Hot wallet olarak kabul et

3. **Admin FID:**
   - Sadece güvenilir FID'ler admin olmalı
   - ADMIN_FIDS environment variable'da

4. **Rate Limiting:**
   - Backend'de rate limiting ekle
   - Spam minting'i engelle

## 📝 Example Usage

```typescript
// Frontend'den mint
const response = await fetch(`/api/achievements/${achievementId}/mint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fid: userFid,
    walletAddress: userWalletAddress
  })
});

const result = await response.json();
// {
//   success: true,
//   txHash: "0x...",
//   tokenId: 42,
//   explorerUrl: "https://basescan.org/tx/0x..."
// }
```

## 🎯 Next Steps

1. Deploy to Base Sepolia (testnet)
2. Test mint functionality
3. Upload achievement images
4. Deploy to Base Mainnet
5. Announce to community!

---

**Ready to deploy?** Follow the steps above and your Soulbound Achievement NFTs will be live! 🚀

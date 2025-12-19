# 🎯 Based Traders - Achievement NFT System

## 📖 Overview

Bu döküman, Based Traders uygulamasında kullanıcıların kazandıkları achievement'ları Base ağında NFT olarak mintleyebilmeleri için gereken tüm adımları içerir.

## 🎯 Sistem Nasıl Çalışır?

Achievement NFT sistemi, kullanıcıların oyunda kazandıkları başarıları (achievements) Base blockchain ağında kalıcı olarak mintlemelerine olanak tanır. Sistem üç ana bileşenden oluşur:

### **1. Smart Contract (Base Chain)**
- **ERC-721 NFT contract**: Her achievement bir NFT olarak basılır
- **Achievement Metadata**: Her achievement'ın adı, açıklaması, görseli ve nadir derecesi (rarity) contract içinde saklanır
- **Duplicate Prevention**: Aynı kullanıcı aynı achievement'ı sadece bir kez mintleyebilir
- **On-chain Tracking**: Hangi kullanıcının hangi achievement'ı mintlediği blockchain üzerinde kayıtlıdır

### **2. Backend Validation (Node.js + ethers.js)**
- **Achievement Verification**: Kullanıcının gerçekten achievement'ı kazanıp kazanmadığını veritabanından kontrol eder
- **Fraud Prevention**: Kazanılmamış achievement'ların mintlenmesini engeller
- **Automated Minting**: Kullanıcı mint butonuna bastığında backend otomatik olarak smart contract'a mint komutu gönderir
- **Database Sync**: Mintlenen NFT'leri local veritabanında da takip eder

### **3. Frontend Integration (React + Farcaster SDK)**
- **Wallet Detection**: Farcaster embedded wallet'ı otomatik olarak algılar
- **One-Click Mint**: Kullanıcı tek tıkla achievement'ını NFT olarak basabilir
- **Transaction Tracking**: Mint işleminin durumunu gösterir ve BaseScan linkini paylaşır
- **UI Updates**: Mintlenen achievement'lar yeşil tik ile işaretlenir

---

## 📋 Adımlar:

1. **Smart Contract Deploy et** → Base ağında ERC-721 contract'ı yayınla
2. **Backend'e ethers.js ekle** → Contract ile iletişim kuracak kodu yaz
3. **API endpoint oluştur** → `/api/mint-achievement` endpoint'ini kur
4. **Veritabanı tablosu ekle** → `minted_achievements` tablosunu oluştur
5. **Frontend'e Mint butonu ekle** → Profile sayfasındaki her achievement'a "Mint as NFT" butonu ekle
6. **Wallet entegrasyonu** → Farcaster SDK ile kullanıcı wallet adresini al
7. **Test et** → Base Goerli testnet'te dene, sonra mainnet'e geç

---

## 💰 Maliyet:

- **Contract Deploy**: ~$0.50 (bir kerelik)
- **Her Mint**: ~$0.04 (Base L2 olduğu için çok düşük)
- **Gas sponsorlama opsiyonu**: Coinbase Paymaster ile kullanıcılar için ücretsiz yapılabilir

---

## ✨ Özellikler:

- ✅ 9 farklı achievement NFT'si (First Trade, Trader, Pro Trader, Master, Winner, Big Win, Profit Maker, Diamond Hands, Sharp Trader)
- ✅ Duplicate mint prevention (aynı achievement iki kez basılamaz)
- ✅ Automatic wallet detection (Farcaster embedded wallet)
- ✅ On-chain verification (tüm mint'ler blockchain üzerinde doğrulanabilir)
- ✅ OpenSea/Rarible görünür (OpenSea'de otomatik olarak görünecek)
- ✅ Rarity levels (Common, Rare, Epic, Legendary)
- ✅ Low gas costs (Base L2 ağında çok ucuz)

---

## 🏗️ Sistem Mimarisi

```
┌─────────────────┐
│   Frontend      │
│ (React/Farcaster)│
└────────┬────────┘
         │
         │ API Call
         ▼
┌─────────────────┐
│    Backend      │
│  (Node.js/TS)   │
└────────┬────────┘
         │
         │ ethers.js
         ▼
┌─────────────────┐
│  Smart Contract │
│   (Base Chain)  │
└─────────────────┘
```

---

## 📋 Achievement ID Mapping

| ID | Achievement Name | Icon | Requirement |
|----|-----------------|------|-------------|
| 1  | First Trade     | 🎯   | 1+ trade |
| 2  | Trader          | 📊   | 10+ trades |
| 3  | Pro Trader      | 💼   | 50+ trades |
| 4  | Master          | 🏆   | 100+ trades |
| 5  | Winner          | ✅   | 10+ winning trades |
| 6  | Big Win         | 💰   | $500+ single trade profit |
| 7  | Profit Maker    | 🚀   | $2000+ high score |
| 8  | Diamond Hands   | 💎   | $5000+ high score |
| 9  | Sharp Trader    | 🎖️   | 60%+ win rate |

---

## 🔧 Implementation Steps

### Step 1: Smart Contract Development

**File**: `contracts/BasedTradersAchievements.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract BasedTradersAchievements is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Achievement metadata
    struct Achievement {
        string name;
        string description;
        string imageURI;
        uint256 rarity; // 1=Common, 2=Rare, 3=Epic, 4=Legendary
    }

    // Achievement ID -> Metadata
    mapping(uint256 => Achievement) public achievements;

    // User -> Achievement ID -> Has Minted
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    // Token ID -> Achievement ID
    mapping(uint256 => uint256) public tokenToAchievement;

    event AchievementMinted(address indexed user, uint256 indexed achievementId, uint256 tokenId);

    constructor() ERC721("Based Traders Achievement", "BTACH") {}

    /**
     * @dev Set achievement metadata (only owner)
     */
    function setAchievement(
        uint256 achievementId,
        string memory name,
        string memory description,
        string memory imageURI,
        uint256 rarity
    ) external onlyOwner {
        achievements[achievementId] = Achievement(name, description, imageURI, rarity);
    }

    /**
     * @dev Mint achievement NFT to user
     */
    function mint(address to, uint256 achievementId) external onlyOwner returns (uint256) {
        require(achievements[achievementId].rarity > 0, "Achievement not configured");
        require(!hasMinted[to][achievementId], "Already minted this achievement");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(to, newTokenId);

        // Generate metadata URI
        string memory uri = string(abi.encodePacked(
            "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/api/nft-metadata/",
            Strings.toString(achievementId)
        ));
        _setTokenURI(newTokenId, uri);

        hasMinted[to][achievementId] = true;
        tokenToAchievement[newTokenId] = achievementId;

        emit AchievementMinted(to, achievementId, newTokenId);

        return newTokenId;
    }

    /**
     * @dev Check if user has minted specific achievement
     */
    function hasUserMinted(address user, uint256 achievementId) external view returns (bool) {
        return hasMinted[user][achievementId];
    }

    /**
     * @dev Get all achievements owned by user
     */
    function getUserAchievements(address user) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory achievementIds = new uint256[](balance);

        uint256 index = 0;
        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (_exists(i) && ownerOf(i) == user) {
                achievementIds[index] = tokenToAchievement[i];
                index++;
            }
        }

        return achievementIds;
    }
}
```

**Deploy Script**: `scripts/deploy.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const BasedTradersAchievements = await ethers.getContractFactory("BasedTradersAchievements");
  const contract = await BasedTradersAchievements.deploy();
  await contract.deployed();

  console.log("Contract deployed to:", contract.address);

  // Setup achievements
  const achievements = [
    { id: 1, name: "First Trade", desc: "Made your first trade", image: "ipfs://QmFirstTrade", rarity: 1 },
    { id: 2, name: "Trader", desc: "Completed 10 trades", image: "ipfs://QmTrader", rarity: 1 },
    { id: 3, name: "Pro Trader", desc: "Completed 50 trades", image: "ipfs://QmProTrader", rarity: 2 },
    { id: 4, name: "Master", desc: "Completed 100 trades", image: "ipfs://QmMaster", rarity: 3 },
    { id: 5, name: "Winner", desc: "10 winning trades", image: "ipfs://QmWinner", rarity: 2 },
    { id: 6, name: "Big Win", desc: "Won $500+ in one trade", image: "ipfs://QmBigWin", rarity: 2 },
    { id: 7, name: "Profit Maker", desc: "Reached $2000 balance", image: "ipfs://QmProfitMaker", rarity: 2 },
    { id: 8, name: "Diamond Hands", desc: "Reached $5000 balance", image: "ipfs://QmDiamondHands", rarity: 3 },
    { id: 9, name: "Sharp Trader", desc: "60%+ win rate", image: "ipfs://QmSharpTrader", rarity: 3 }
  ];

  for (const ach of achievements) {
    const tx = await contract.setAchievement(ach.id, ach.name, ach.desc, ach.image, ach.rarity);
    await tx.wait();
    console.log(`Achievement ${ach.id} set: ${ach.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

### Step 2: Backend Integration

**File**: `server/nft.ts`

```typescript
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const ACHIEVEMENT_CONTRACT_ADDRESS = process.env.ACHIEVEMENT_CONTRACT_ADDRESS!;
const PRIVATE_KEY = process.env.MINT_WALLET_PRIVATE_KEY!;
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract ABI (only needed functions)
const contractABI = [
  "function mint(address to, uint256 achievementId) external returns (uint256)",
  "function hasMinted(address user, uint256 achievementId) view returns (bool)",
  "function getUserAchievements(address user) view returns (uint256[])"
];

const contract = new ethers.Contract(
  ACHIEVEMENT_CONTRACT_ADDRESS,
  contractABI,
  signer
);

/**
 * Mint achievement NFT for user
 */
export async function mintAchievement(
  userAddress: string,
  achievementId: number
): Promise<{ success: boolean; txHash?: string; error?: string; tokenId?: number }> {
  try {
    // Check if already minted
    const alreadyMinted = await contract.hasMinted(userAddress, achievementId);
    if (alreadyMinted) {
      return { success: false, error: 'Already minted this achievement' };
    }

    console.log(`Minting achievement ${achievementId} for ${userAddress}...`);

    // Mint NFT
    const tx = await contract.mint(userAddress, achievementId);
    console.log('Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);

    // Get token ID from event
    const event = receipt.events?.find((e: any) => e.event === 'AchievementMinted');
    const tokenId = event?.args?.tokenId?.toNumber();

    return {
      success: true,
      txHash: receipt.transactionHash,
      tokenId
    };
  } catch (error: any) {
    console.error('Mint error:', error);
    return {
      success: false,
      error: error.message || 'Mint failed'
    };
  }
}

/**
 * Get user's minted achievements
 */
export async function getUserAchievements(userAddress: string): Promise<number[]> {
  try {
    const achievements = await contract.getUserAchievements(userAddress);
    return achievements.map((id: any) => id.toNumber());
  } catch (error) {
    console.error('Get achievements error:', error);
    return [];
  }
}

/**
 * Check if user has minted specific achievement
 */
export async function hasUserMinted(userAddress: string, achievementId: number): Promise<boolean> {
  try {
    return await contract.hasMinted(userAddress, achievementId);
  } catch (error) {
    console.error('Check minted error:', error);
    return false;
  }
}
```

**Update**: `server/unified.ts`

```typescript
import { mintAchievement, getUserAchievements, hasUserMinted } from './nft.js';

// ... existing code ...

// API: Mint achievement
app.post('/api/mint-achievement', async (req, res) => {
  const { fid, achievementId, walletAddress } = req.body;

  try {
    // Verify user and achievement
    const player = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid) as any;
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get closed positions for validation
    const positions = db.prepare('SELECT * FROM positions WHERE player_fid = ? AND closed_at IS NOT NULL').all(fid) as any[];
    const totalTrades = positions.length;
    const winningTrades = positions.filter(p => p.pnl > 0).length;
    const biggestWin = Math.max(...positions.map(p => p.pnl), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Validate achievement earned
    let earned = false;
    switch (achievementId) {
      case 1: earned = totalTrades >= 1; break;
      case 2: earned = totalTrades >= 10; break;
      case 3: earned = totalTrades >= 50; break;
      case 4: earned = totalTrades >= 100; break;
      case 5: earned = winningTrades >= 10; break;
      case 6: earned = biggestWin >= 500; break;
      case 7: earned = player.high_score >= 2000; break;
      case 8: earned = player.high_score >= 5000; break;
      case 9: earned = winRate >= 60; break;
      default: earned = false;
    }

    if (!earned) {
      return res.status(400).json({ error: 'Achievement not earned yet' });
    }

    // Check if already minted in database
    const existing = db.prepare('SELECT * FROM minted_achievements WHERE fid = ? AND achievement_id = ?').get(fid, achievementId);
    if (existing) {
      return res.status(400).json({ error: 'Achievement already minted' });
    }

    // Mint NFT
    const result = await mintAchievement(walletAddress, achievementId);

    if (result.success) {
      // Save to database
      db.prepare(`
        INSERT INTO minted_achievements (fid, achievement_id, wallet_address, tx_hash, token_id, minted_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(fid, achievementId, walletAddress, result.txHash, result.tokenId, Date.now());

      res.json({
        success: true,
        txHash: result.txHash,
        tokenId: result.tokenId,
        explorerUrl: `https://basescan.org/tx/${result.txHash}`
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Mint API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get user's minted achievements
app.get('/api/minted-achievements/:fid', async (req, res) => {
  const fid = req.params.fid;

  try {
    const minted = db.prepare('SELECT * FROM minted_achievements WHERE fid = ?').all(fid);
    res.json(minted);
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// API: NFT Metadata endpoint
app.get('/api/nft-metadata/:achievementId', (req, res) => {
  const achievementId = parseInt(req.params.achievementId);

  const metadata: Record<number, any> = {
    1: {
      name: "First Trade Achievement",
      description: "Congratulations! You made your first trade on Based Traders.",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/first-trade.png",
      attributes: [
        { trait_type: "Category", value: "Trade Milestone" },
        { trait_type: "Rarity", value: "Common" },
        { trait_type: "Requirement", value: "1 Trade" }
      ]
    },
    2: {
      name: "Trader Achievement",
      description: "You've completed 10 trades! Keep trading!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/trader.png",
      attributes: [
        { trait_type: "Category", value: "Trade Milestone" },
        { trait_type: "Rarity", value: "Common" },
        { trait_type: "Requirement", value: "10 Trades" }
      ]
    },
    3: {
      name: "Pro Trader Achievement",
      description: "50 trades completed! You're becoming a pro!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/pro-trader.png",
      attributes: [
        { trait_type: "Category", value: "Trade Milestone" },
        { trait_type: "Rarity", value: "Rare" },
        { trait_type: "Requirement", value: "50 Trades" }
      ]
    },
    4: {
      name: "Master Achievement",
      description: "100 trades! You're a trading master!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/master.png",
      attributes: [
        { trait_type: "Category", value: "Trade Milestone" },
        { trait_type: "Rarity", value: "Epic" },
        { trait_type: "Requirement", value: "100 Trades" }
      ]
    },
    5: {
      name: "Winner Achievement",
      description: "10 winning trades! You know what you're doing!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/winner.png",
      attributes: [
        { trait_type: "Category", value: "Performance" },
        { trait_type: "Rarity", value: "Rare" },
        { trait_type: "Requirement", value: "10 Wins" }
      ]
    },
    6: {
      name: "Big Win Achievement",
      description: "Won $500+ in a single trade! Impressive!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/big-win.png",
      attributes: [
        { trait_type: "Category", value: "Profit" },
        { trait_type: "Rarity", value: "Rare" },
        { trait_type: "Requirement", value: "$500+ Single Win" }
      ]
    },
    7: {
      name: "Profit Maker Achievement",
      description: "Reached $2000 balance! Great job!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/profit-maker.png",
      attributes: [
        { trait_type: "Category", value: "Balance" },
        { trait_type: "Rarity", value: "Rare" },
        { trait_type: "Requirement", value: "$2000 Balance" }
      ]
    },
    8: {
      name: "Diamond Hands Achievement",
      description: "$5000 balance! You have diamond hands!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/diamond-hands.png",
      attributes: [
        { trait_type: "Category", value: "Balance" },
        { trait_type: "Rarity", value: "Epic" },
        { trait_type: "Requirement", value: "$5000 Balance" }
      ]
    },
    9: {
      name: "Sharp Trader Achievement",
      description: "60%+ win rate! You're sharp!",
      image: "https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/achievements/sharp-trader.png",
      attributes: [
        { trait_type: "Category", value: "Performance" },
        { trait_type: "Rarity", value: "Epic" },
        { trait_type: "Requirement", value: "60%+ Win Rate" }
      ]
    }
  };

  const data = metadata[achievementId];
  if (!data) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  res.json(data);
});
```

---

### Step 3: Database Schema

**File**: `server/schema.sql`

```sql
-- Minted achievements tracking
CREATE TABLE IF NOT EXISTS minted_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  token_id INTEGER,
  minted_at INTEGER NOT NULL,
  UNIQUE(fid, achievement_id)
);

CREATE INDEX idx_minted_fid ON minted_achievements(fid);
CREATE INDEX idx_minted_wallet ON minted_achievements(wallet_address);
```

---

### Step 4: Frontend Implementation

**Update**: `src/components/Profile.tsx`

```typescript
// Add state for minted achievements
const [mintedAchievements, setMintedAchievements] = useState<number[]>([]);
const [minting, setMinting] = useState<number | null>(null);

// Load minted achievements
useEffect(() => {
  if (profile?.fid) {
    fetch(`/api/minted-achievements/${profile.fid}`)
      .then(res => res.json())
      .then(data => {
        const ids = data.map((m: any) => m.achievement_id);
        setMintedAchievements(ids);
      })
      .catch(err => console.error('Load minted error:', err));
  }
}, [profile?.fid]);

// Mint achievement function
const handleMintAchievement = async (achievementId: number) => {
  if (minting) return;

  try {
    setMinting(achievementId);

    // Get wallet address from Farcaster SDK
    const context = await sdk.context;
    const walletAddress = context.user?.wallet?.address;

    if (!walletAddress) {
      alert('Please connect your wallet in Farcaster');
      setMinting(null);
      return;
    }

    // Call mint API
    const response = await fetch('/api/mint-achievement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid: profile.fid,
        achievementId,
        walletAddress
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`Achievement minted successfully!\nView on BaseScan: ${data.explorerUrl}`);
      setMintedAchievements([...mintedAchievements, achievementId]);
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Mint error:', error);
    alert('Failed to mint achievement');
  } finally {
    setMinting(null);
  }
};

// In achievement card rendering, add Mint button
{getAchievements().map((achievement, idx) => {
  const achievementId = getAchievementId(achievement.name);
  const isMinted = mintedAchievements.includes(achievementId);
  const isMinting = minting === achievementId;

  return (
    <div key={idx} className="bg-gradient-to-br from-[#0a0c12] to-[#080911] rounded-2xl p-4 border border-gray-700/50 hover:border-[#0000FF]/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0000FF]/20">
      <div className="text-4xl mb-2">{achievement.icon}</div>
      <div className="text-sm font-bold mb-1">{achievement.name}</div>
      <div className="text-xs text-gray-500 mb-2">{achievement.desc}</div>

      {isMinted ? (
        <div className="text-xs text-green-400 flex items-center gap-1">
          ✓ Minted as NFT
        </div>
      ) : (
        <button
          onClick={() => handleMintAchievement(achievementId)}
          disabled={isMinting}
          className="w-full bg-[#0000FF]/20 hover:bg-[#0000FF]/30 text-[#4444FF] hover:text-[#6666FF] px-2 py-1 rounded text-xs font-semibold transition-all disabled:opacity-50"
        >
          {isMinting ? 'Minting...' : 'Mint as NFT'}
        </button>
      )}
    </div>
  );
})}

// Helper function to map achievement name to ID
const getAchievementId = (name: string): number => {
  const mapping: Record<string, number> = {
    'First Trade': 1,
    'Trader': 2,
    'Pro Trader': 3,
    'Master': 4,
    'Winner': 5,
    'Big Win': 6,
    'Profit Maker': 7,
    'Diamond Hands': 8,
    'Sharp Trader': 9
  };
  return mapping[name] || 0;
};
```

---

## 🚀 Deployment Guide

### 1. Install Dependencies

```bash
# Hardhat for smart contract
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# ethers.js for backend
npm install ethers

# OpenZeppelin contracts
npm install @openzeppelin/contracts
```

### 2. Configure Hardhat

**File**: `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 8453
    },
    baseGoerli: {
      url: "https://goerli.base.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 84531
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY!
    }
  }
};

export default config;
```

### 3. Deploy Contract

```bash
# Test deploy on Base Goerli (testnet)
npx hardhat run scripts/deploy.ts --network baseGoerli

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.ts --network base

# Verify contract
npx hardhat verify --network base <CONTRACT_ADDRESS>
```

### 4. Update Environment Variables

**File**: `.env`

```bash
# Contract
ACHIEVEMENT_CONTRACT_ADDRESS=0x...
MINT_WALLET_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org

# For deployment
DEPLOYER_PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
```

### 5. Update Database

```bash
# Run migration
sqlite3 based-traders.db < server/schema.sql
```

---

## 💰 Gas Optimization & Cost

### Estimated Gas Costs (Base Mainnet):

| Operation | Gas | Cost (@ 0.001 gwei) |
|-----------|-----|---------------------|
| Contract Deploy | ~2M | ~$0.50 |
| Set Achievement | ~50K | ~$0.01 |
| Mint NFT | ~150K | ~$0.04 |

### Optimization Strategies:

1. **Batch Minting**: Allow users to mint multiple achievements at once
2. **Lazy Minting**: Only mint when user explicitly requests
3. **Sponsored Transactions**: Use Coinbase Paymaster for gasless mints
4. **Layer 2**: Already on Base (L2) for low fees

---

## 🎨 NFT Image Assets

Achievement images should be stored on IPFS or Arweave. Recommended size: 1000x1000px.

**Directory structure**:
```
public/achievements/
  ├── first-trade.png
  ├── trader.png
  ├── pro-trader.png
  ├── master.png
  ├── winner.png
  ├── big-win.png
  ├── profit-maker.png
  ├── diamond-hands.png
  └── sharp-trader.png
```

---

## 🧪 Testing

**Test Contract**:

```bash
npx hardhat test
```

**Test API**:

```bash
curl -X POST http://localhost:3000/api/mint-achievement \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 326821,
    "achievementId": 1,
    "walletAddress": "0x..."
  }'
```

---

## 📱 User Flow

1. User earns achievement in game
2. Achievement appears in Profile page
3. User clicks "Mint as NFT" button
4. Farcaster wallet address automatically detected
5. Backend validates achievement
6. Smart contract mints NFT to user's wallet
7. Transaction confirmed on Base
8. NFT visible in OpenSea/Rarible

---

## 🔗 Useful Links

- **Base Mainnet RPC**: https://mainnet.base.org
- **Base Explorer**: https://basescan.org
- **OpenSea (Base)**: https://opensea.io/assets/base/
- **Coinbase Wallet**: https://www.coinbase.com/wallet
- **Farcaster Frames**: https://docs.farcaster.xyz

---

## 🛟 Troubleshooting

### Issue: "Already minted"
**Solution**: Check `hasMinted` mapping in contract or database

### Issue: "Insufficient funds for gas"
**Solution**: Ensure mint wallet has ETH on Base

### Issue: "Achievement not earned"
**Solution**: Verify achievement criteria in backend validation

### Issue: "Wallet not connected"
**Solution**: Ensure Farcaster embedded wallet is enabled

---

## 📝 TODO

- [ ] Deploy contract to Base Mainnet
- [ ] Upload achievement images to IPFS
- [ ] Test mint flow end-to-end
- [ ] Add gasless minting with Paymaster
- [ ] Add NFT gallery view in Profile
- [ ] Add OpenSea integration
- [ ] Add social sharing for minted NFTs

---

## 📄 License

MIT License - Based Traders © 2025

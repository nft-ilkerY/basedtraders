import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = process.env.ACHIEVEMENT_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.MINT_WALLET_PRIVATE_KEY;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Contract ABI (only needed functions)
const contractABI = [
  "function mint(address to, uint256 achievementId) external returns (uint256)",
  "function hasMinted(address user, uint256 achievementId) view returns (bool)",
  "function getUserAchievements(address user) view returns (uint256[])",
  "event AchievementMinted(address indexed user, uint256 indexed achievementId, uint256 tokenId)"
];

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

// Initialize connection
function initializeContract() {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.warn('⚠️  Achievement NFT minting not configured (missing CONTRACT_ADDRESS or PRIVATE_KEY)');
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

    console.log('✅ NFT Minter initialized');
    console.log('📝 Contract:', CONTRACT_ADDRESS);
    console.log('🔗 Network:', RPC_URL);
    return true;
  } catch (error) {
    console.error('❌ Error initializing NFT minter:', error);
    return false;
  }
}

/**
 * Mint achievement NFT for user
 */
export async function mintAchievementNFT(
  userAddress: string,
  achievementId: number
): Promise<{ success: boolean; txHash?: string; tokenId?: number; error?: string }> {
  // Initialize if not already done
  if (!contract) {
    const initialized = initializeContract();
    if (!initialized) {
      return {
        success: false,
        error: 'NFT minting not configured. Please set ACHIEVEMENT_CONTRACT_ADDRESS and MINT_WALLET_PRIVATE_KEY in .env'
      };
    }
  }

  if (!contract || !provider) {
    return {
      success: false,
      error: 'Contract not initialized'
    };
  }

  try {
    // Check if already minted
    console.log(`🔍 Checking if ${userAddress} has minted achievement ${achievementId}...`);
    const alreadyMinted = await contract.hasMinted(userAddress, achievementId);

    if (alreadyMinted) {
      return {
        success: false,
        error: 'Already minted this achievement'
      };
    }

    console.log(`⏳ Minting achievement ${achievementId} for ${userAddress}...`);

    // Estimate gas
    const gasEstimate = await contract.mint.estimateGas(userAddress, achievementId);
    console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

    // Send transaction with 20% buffer
    const tx = await contract.mint(userAddress, achievementId, {
      gasLimit: gasEstimate * 120n / 100n
    });

    console.log(`📤 Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Parse event to get token ID
    let tokenId: number | null = null;
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });

          if (parsedLog && parsedLog.name === 'AchievementMinted') {
            tokenId = Number(parsedLog.args.tokenId);
            console.log(`🎯 Token ID: ${tokenId}`);
            break;
          }
        } catch {
          // Skip logs that don't match our contract
          continue;
        }
      }
    } catch (parseError) {
      console.warn('⚠️  Could not parse token ID from event:', parseError);
    }

    return {
      success: true,
      txHash: receipt.hash,
      tokenId: tokenId || undefined
    };
  } catch (error: any) {
    console.error('❌ Mint error:', error);

    // Parse revert reason if available
    let errorMessage = 'Mint failed';
    if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get user's minted achievement IDs
 */
export async function getUserMintedAchievements(userAddress: string): Promise<number[]> {
  if (!contract) {
    initializeContract();
  }

  if (!contract) {
    return [];
  }

  try {
    const achievements = await contract.getUserAchievements(userAddress);
    return achievements.map((id: bigint) => Number(id));
  } catch (error) {
    console.error('Error getting user achievements:', error);
    return [];
  }
}

/**
 * Check if user has minted specific achievement
 */
export async function hasUserMintedAchievement(
  userAddress: string,
  achievementId: number
): Promise<boolean> {
  if (!contract) {
    initializeContract();
  }

  if (!contract) {
    return false;
  }

  try {
    return await contract.hasMinted(userAddress, achievementId);
  } catch (error) {
    console.error('Error checking if minted:', error);
    return false;
  }
}

// Initialize on module load
initializeContract();

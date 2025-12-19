import { ethers } from "hardhat";

/**
 * Script to setup initial achievement metadata on the contract
 * Run after deployment: npx hardhat run scripts/setup-achievements.ts --network base
 */
async function main() {
  const contractAddress = process.env.ACHIEVEMENT_CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error("❌ ACHIEVEMENT_CONTRACT_ADDRESS not found in .env");
    process.exit(1);
  }

  console.log("🎯 Setting up achievements on contract:", contractAddress, "\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get contract instance
  const contract = await ethers.getContractAt("BasedTradersAchievements", contractAddress);

  // Achievement metadata (update these based on your database achievements)
  const achievements = [
    {
      id: 1,
      name: "First Trade",
      description: "Made your first trade on Based Traders",
      imageURI: "https://basedtraders.fun/achievements/1.png",
      rarity: "Common",
    },
    {
      id: 2,
      name: "Trader",
      description: "Completed 10 trades",
      imageURI: "https://basedtraders.fun/achievements/2.png",
      rarity: "Common",
    },
    {
      id: 3,
      name: "Pro Trader",
      description: "Completed 50 trades",
      imageURI: "https://basedtraders.fun/achievements/3.png",
      rarity: "Rare",
    },
    {
      id: 4,
      name: "Master",
      description: "Completed 100 trades",
      imageURI: "https://basedtraders.fun/achievements/4.png",
      rarity: "Epic",
    },
    {
      id: 5,
      name: "Winner",
      description: "10 winning trades",
      imageURI: "https://basedtraders.fun/achievements/5.png",
      rarity: "Rare",
    },
    {
      id: 6,
      name: "Big Win",
      description: "Won $500+ in a single trade",
      imageURI: "https://basedtraders.fun/achievements/6.png",
      rarity: "Rare",
    },
    {
      id: 7,
      name: "Profit Maker",
      description: "Reached $2000 balance",
      imageURI: "https://basedtraders.fun/achievements/7.png",
      rarity: "Rare",
    },
    {
      id: 8,
      name: "Diamond Hands",
      description: "Reached $5000 balance",
      imageURI: "https://basedtraders.fun/achievements/8.png",
      rarity: "Epic",
    },
    {
      id: 9,
      name: "Sharp Trader",
      description: "60%+ win rate",
      imageURI: "https://basedtraders.fun/achievements/9.png",
      rarity: "Epic",
    },
  ];

  console.log(`\n⏳ Setting up ${achievements.length} achievements...\n`);

  for (const achievement of achievements) {
    try {
      console.log(`📝 Setting achievement ${achievement.id}: ${achievement.name}...`);

      const tx = await contract.setAchievement(
        achievement.id,
        achievement.name,
        achievement.description,
        achievement.imageURI,
        achievement.rarity
      );

      await tx.wait();
      console.log(`✅ Achievement ${achievement.id} set successfully`);
    } catch (error: any) {
      console.error(`❌ Error setting achievement ${achievement.id}:`, error.message);
    }
  }

  console.log("\n✅ All achievements configured!");
  console.log("🎯 Your contract is ready for minting!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

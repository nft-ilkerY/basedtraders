import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying BasedTradersAchievements to Base...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  console.log("⏳ Deploying contract...");
  const BasedTradersAchievements = await ethers.getContractFactory("BasedTradersAchievements");
  const contract = await BasedTradersAchievements.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("✅ Contract deployed to:", address);
  console.log("🔗 View on BaseScan:", `https://basescan.org/address/${address}\n`);

  // Wait for confirmations before verification
  console.log("⏳ Waiting for 5 confirmations...");
  await contract.deploymentTransaction()?.wait(5);
  console.log("✅ Confirmed!\n");

  console.log("📋 Add these to your .env file:");
  console.log("=====================================");
  console.log(`ACHIEVEMENT_CONTRACT_ADDRESS=${address}`);
  console.log("=====================================\n");

  console.log("🔧 Next steps:");
  console.log("1. Add contract address to .env");
  console.log("2. Add MINT_WALLET_PRIVATE_KEY to .env");
  console.log("3. Verify contract:");
  console.log(`   npx hardhat verify --network base ${address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

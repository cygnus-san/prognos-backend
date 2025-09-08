import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addPredictionsToExistingPools() {
  try {
    console.log("🎯 Adding predictions to existing pools...\n");

    // Find pools without meaningful stakes (0 or very low total stake)
    const poolsNeedingPredictions = await prisma.pool.findMany({
      where: {
        totalStake: { lte: 1 }
      },
      include: { predictions: true }
    });

    console.log(`Found ${poolsNeedingPredictions.length} pools needing better predictions`);

    for (const pool of poolsNeedingPredictions) {
      console.log(`\nProcessing pool: ${pool.title.substring(0, 50)}...`);
      
      // Delete existing predictions with 0 stake
      const deletedCount = await prisma.prediction.deleteMany({
        where: {
          poolId: pool.id,
          stakeAmount: { lte: 0 }
        }
      });
      
      if (deletedCount.count > 0) {
        console.log(`  🗑️  Deleted ${deletedCount.count} zero-stake predictions`);
      }

      // Create new meaningful predictions
      const samplePredictions = [
        {
          userWalletAddress: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", // Mock wallet 1
          predictionValue: Math.random() > 0.5 ? "yes" : "no",
          stakeAmount: 5 + Math.random() * 10, // Random stake between 5-15 STX
        },
        {
          userWalletAddress: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE", // Mock wallet 2  
          predictionValue: Math.random() > 0.5 ? "yes" : "no",
          stakeAmount: 8 + Math.random() * 12, // Random stake between 8-20 STX
        },
        {
          userWalletAddress: "SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60", // Mock wallet 3
          predictionValue: Math.random() > 0.5 ? "yes" : "no", 
          stakeAmount: 3 + Math.random() * 7, // Random stake between 3-10 STX
        }
      ];

      let totalPoolStake = 0;
      for (const predData of samplePredictions) {
        await prisma.prediction.create({
          data: {
            poolId: pool.id,
            ...predData,
          },
        });
        totalPoolStake += predData.stakeAmount;
      }

      // Update pool with new total stake
      await prisma.pool.update({
        where: { id: pool.id },
        data: { totalStake: totalPoolStake },
      });

      console.log(`  ✅ Added ${samplePredictions.length} predictions (Total: ${totalPoolStake.toFixed(2)} STX)`);
    }

    console.log("\n🎉 Successfully added predictions to all pools!");

  } catch (error) {
    console.error("❌ Error adding predictions:", error);
  } finally {
    await prisma.$disconnect();
  }
}

addPredictionsToExistingPools();
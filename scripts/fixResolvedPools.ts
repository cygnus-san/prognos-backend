import { PrismaClient } from '@prisma/client';
import { RewardService } from '../src/services/rewardService';

const prisma = new PrismaClient();

async function fixResolvedPools() {
  try {
    console.log("🔧 Fixing resolved pools with missing rewards...\n");

    // Find all resolved pools
    const resolvedPools = await prisma.pool.findMany({
      where: { isResolved: true },
      include: { predictions: true }
    });

    console.log(`Found ${resolvedPools.length} resolved pools`);

    for (const pool of resolvedPools) {
      console.log(`\nProcessing pool: ${pool.title}`);
      
      if (!pool.outcomeValue) {
        console.log(`  ❌ Pool has no outcome value, skipping`);
        continue;
      }

      // Check if any predictions have missing claimable rewards (including NULL values)
      const predictionsWithoutRewards = pool.predictions.filter(
        p => !p.claimableReward || p.claimableReward === 0
      );

      if (predictionsWithoutRewards.length > 0) {
        console.log(`  🔄 Recalculating rewards for ${predictionsWithoutRewards.length} predictions`);
        
        // Manually calculate rewards since pool is already resolved
        for (const prediction of pool.predictions) {
          const numericPrediction = RewardService.parseNumericPrediction(prediction.predictionValue);
          const score = RewardService.calculateScore(numericPrediction, pool.outcomeValue);
          
          let reward: number;
          if (prediction.stakeAmount > 0) {
            // For staked predictions, use proportional rewards (simplified)
            reward = score * prediction.stakeAmount * 1.5; // 1.5x multiplier for staked
          } else {
            // For unstaked predictions, give accuracy-based rewards
            reward = score > 0.5 ? 5 : 1; // 5 STX for good predictions, 1 STX participation
          }
          
          await prisma.prediction.update({
            where: { id: prediction.id },
            data: { claimableReward: reward }
          });
        }
        
        console.log(`  ✅ Rewards recalculated`);
      } else {
        console.log(`  ✅ Pool already has proper rewards`);
      }
    }

    console.log("\n🎉 Finished fixing resolved pools!");

  } catch (error) {
    console.error("❌ Error fixing resolved pools:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixResolvedPools();
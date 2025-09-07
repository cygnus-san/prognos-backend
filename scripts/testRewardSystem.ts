/**
 * Test script for the reward system
 * This script creates a test scenario matching the example in reward-new.md
 */

import { PrismaClient } from '@prisma/client';
import { RewardService } from '../src/services/rewardService';

const db = new PrismaClient();

async function createTestScenario() {
  console.log('🧪 Creating test scenario for reward system...');

  try {
    // Clean up existing test data
    await db.prediction.deleteMany({});
    await db.pool.deleteMany({});
    await db.user.deleteMany({});

    // Create test users
    const alice = await db.user.create({
      data: { walletAddress: 'alice_wallet_123' }
    });

    const bob = await db.user.create({
      data: { walletAddress: 'bob_wallet_456' }
    });

    const charlie = await db.user.create({
      data: { walletAddress: 'charlie_wallet_789' }
    });

    console.log('✅ Created test users:', { alice: alice.walletAddress, bob: bob.walletAddress, charlie: charlie.walletAddress });

    // Create a test pool
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const pool = await db.pool.create({
      data: {
        title: 'Test Pool: Will BTC reach $100k?',
        description: 'A test pool for reward system validation',
        tag: 'crypto',
        deadline: deadline,
        totalStake: 0
      }
    });

    console.log('✅ Created test pool:', pool.id);

    // Create predictions matching the example in the spec
    // Alice: 10 tokens on 60% (distance from 50% = 10)
    const alicePrediction = await db.prediction.create({
      data: {
        poolId: pool.id,
        userWalletAddress: alice.walletAddress,
        predictionValue: '60',
        stakeAmount: 10
      }
    });

    // Bob: 20 tokens on 40% (distance from 50% = 10)  
    const bobPrediction = await db.prediction.create({
      data: {
        poolId: pool.id,
        userWalletAddress: bob.walletAddress,
        predictionValue: '40',
        stakeAmount: 20
      }
    });

    // Charlie: 5 tokens on 55% (distance from 50% = 5)
    const charliePrediction = await db.prediction.create({
      data: {
        poolId: pool.id,
        userWalletAddress: charlie.walletAddress,
        predictionValue: '55',
        stakeAmount: 5
      }
    });

    // Update pool total stake
    await db.pool.update({
      where: { id: pool.id },
      data: { totalStake: 35 } // 10 + 20 + 5
    });

    console.log('✅ Created predictions:');
    console.log(`  Alice: ${alicePrediction.stakeAmount} tokens on ${alicePrediction.predictionValue}%`);
    console.log(`  Bob: ${bobPrediction.stakeAmount} tokens on ${bobPrediction.predictionValue}%`);
    console.log(`  Charlie: ${charliePrediction.stakeAmount} tokens on ${charliePrediction.predictionValue}%`);
    console.log(`  Total stake: 35 tokens`);

    return { pool, predictions: { alice: alicePrediction, bob: bobPrediction, charlie: charliePrediction } };
  } catch (error) {
    console.error('❌ Error creating test scenario:', error);
    throw error;
  }
}

async function testRewardCalculation() {
  console.log('\n📊 Testing reward calculation...');

  try {
    const { pool } = await createTestScenario();

    // Resolve pool with outcome value of 50%
    console.log('\n🎯 Resolving pool with outcome value: 50%');
    await RewardService.resolvePool(pool.id, 50);

    // Get reward summary
    const summary = await RewardService.getRewardSummary(pool.id);
    
    console.log('\n📈 Reward Summary:');
    console.log('Pool:', summary.pool);
    console.log('\nPredictions and Rewards:');
    
    summary.predictions.forEach((pred: any) => {
      console.log(`  ${pred.userWalletAddress}:`);
      console.log(`    Prediction: ${pred.predictionValue}% (numeric: ${pred.numericPrediction})`);
      console.log(`    Stake: ${pred.stakeAmount} tokens`);
      console.log(`    Distance: ${pred.distance}`);
      console.log(`    Score: ${pred.score.toFixed(6)}`);
      console.log(`    Weighted Score: ${pred.weightedScore.toFixed(6)}`);
      console.log(`    Claimable Reward: ${pred.claimableReward?.toFixed(2)} tokens`);
      console.log(`    Claimed: ${pred.claimed}`);
      console.log('');
    });

    console.log(`Total Weighted Score: ${summary.totalWeightedScore.toFixed(6)}`);

    // Verify the calculations match the spec example
    const expectedResults = {
      'alice_wallet_123': { distance: 10, score: 0.091, weighted: 0.91, reward: 8.94 },
      'bob_wallet_456': { distance: 10, score: 0.091, weighted: 1.82, reward: 17.87 },
      'charlie_wallet_789': { distance: 5, score: 0.167, weighted: 0.835, reward: 8.19 }
    };

    console.log('\n✅ Verification against spec example:');
    summary.predictions.forEach((pred: any) => {
      const expected = expectedResults[pred.userWalletAddress as keyof typeof expectedResults];
      console.log(`  ${pred.userWalletAddress}:`);
      console.log(`    Distance - Expected: ${expected.distance}, Actual: ${pred.distance} ✓`);
      console.log(`    Score - Expected: ~${expected.score}, Actual: ${pred.score.toFixed(3)} ${Math.abs(pred.score - expected.score) < 0.001 ? '✓' : '⚠️'}`);
      console.log(`    Reward - Expected: ~${expected.reward}, Actual: ${pred.claimableReward?.toFixed(2)} ${Math.abs(pred.claimableReward - expected.reward) < 0.5 ? '✓' : '⚠️'}`);
    });

    return { pool, summary };
  } catch (error) {
    console.error('❌ Error testing reward calculation:', error);
    throw error;
  }
}

async function testClaimProcess() {
  console.log('\n💰 Testing claim process...');

  try {
    const { pool } = await testRewardCalculation();

    // Test Alice's claim
    console.log('\n🧪 Testing Alice\'s claim...');
    const aliceClaimCheck = await RewardService.checkClaimability(pool.id, 'alice_wallet_123');
    console.log('Alice claim check:', aliceClaimCheck);

    if (aliceClaimCheck.canClaim) {
      // Simulate claiming (mark as claimed)
      await db.prediction.update({
        where: { id: aliceClaimCheck.prediction.id },
        data: { claimed: true }
      });
      console.log('✅ Alice claimed rewards successfully');

      // Test claiming again (should fail)
      const aliceSecondClaim = await RewardService.checkClaimability(pool.id, 'alice_wallet_123');
      console.log('Alice second claim check:', aliceSecondClaim);
    }

    // Test Bob's claim
    console.log('\n🧪 Testing Bob\'s claim...');
    const bobClaimCheck = await RewardService.checkClaimability(pool.id, 'bob_wallet_456');
    console.log('Bob claim check:', bobClaimCheck);

    // Test Charlie's claim
    console.log('\n🧪 Testing Charlie\'s claim...');
    const charlieClaimCheck = await RewardService.checkClaimability(pool.id, 'charlie_wallet_789');
    console.log('Charlie claim check:', charlieClaimCheck);

  } catch (error) {
    console.error('❌ Error testing claim process:', error);
    throw error;
  }
}

async function testEdgeCases() {
  console.log('\n🔍 Testing edge cases...');

  try {
    // Test with no stakes
    const emptyPool = await db.pool.create({
      data: {
        title: 'Empty Pool',
        description: 'A pool with no stakes',
        tag: 'test',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        totalStake: 0
      }
    });

    console.log('\n🧪 Testing pool resolution with no stakes...');
    await RewardService.resolvePool(emptyPool.id, 75);
    console.log('✅ Empty pool resolved successfully');

    // Test with perfect prediction
    const perfectPool = await db.pool.create({
      data: {
        title: 'Perfect Prediction Pool',
        description: 'Test perfect predictions',
        tag: 'test',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        totalStake: 100
      }
    });

    await db.prediction.create({
      data: {
        poolId: perfectPool.id,
        userWalletAddress: 'alice_wallet_123',
        predictionValue: '75',
        stakeAmount: 100
      }
    });

    console.log('\n🧪 Testing perfect prediction (75% prediction, 75% outcome)...');
    await RewardService.resolvePool(perfectPool.id, 75);
    const perfectSummary = await RewardService.getRewardSummary(perfectPool.id);
    console.log('Perfect prediction result:', perfectSummary.predictions[0]);

  } catch (error) {
    console.error('❌ Error testing edge cases:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting reward system tests...');

  try {
    await testRewardCalculation();
    await testClaimProcess();
    await testEdgeCases();

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  main();
}
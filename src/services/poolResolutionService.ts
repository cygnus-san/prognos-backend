import db from '../db';
import { RewardService } from './rewardService';

export class PoolResolutionService {
  private static isRunning = false;
  private static checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start the automatic pool resolution service
   * Checks for expired pools every minute
   */
  static start(): void {
    if (this.isRunning) {
      console.log('🔄 Pool resolution service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting automatic pool resolution service...');
    
    // Check immediately on start
    this.checkAndResolveExpiredPools();
    
    // Then check every minute
    this.checkInterval = setInterval(() => {
      this.checkAndResolveExpiredPools();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Stop the automatic pool resolution service
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('⏸️ Pool resolution service already stopped');
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('⏹️ Pool resolution service stopped');
  }

  /**
   * Check for expired pools and resolve them automatically
   */
  static async checkAndResolveExpiredPools(): Promise<void> {
    try {
      const now = new Date();
      
      // Find all unresolved pools where deadline has passed
      const expiredPools = await db.pool.findMany({
        where: {
          isResolved: false,
          deadline: {
            lt: now
          }
        },
        include: {
          predictions: true
        }
      });

      if (expiredPools.length === 0) {
        console.log('✅ No expired pools to resolve');
        return;
      }

      console.log(`🔍 Found ${expiredPools.length} expired pools to resolve`);

      for (const pool of expiredPools) {
        await this.resolvePoolAutomatically(pool.id, pool.title);
      }

    } catch (error) {
      console.error('❌ Error checking for expired pools:', error);
    }
  }

  /**
   * Automatically resolve a pool with a calculated outcome
   * For testing purposes, we'll use a simple algorithm:
   * - If there are predictions, calculate outcome based on weighted average
   * - If no predictions, randomly resolve to 0 or 100
   */
  static async resolvePoolAutomatically(poolId: string, poolTitle?: string): Promise<void> {
    try {
      console.log(`🎯 Auto-resolving pool: ${poolTitle || poolId}`);

      // Get pool with predictions
      const pool = await db.pool.findUnique({
        where: { id: poolId },
        include: { predictions: true }
      });

      if (!pool) {
        console.error(`❌ Pool ${poolId} not found`);
        return;
      }

      if (pool.isResolved) {
        console.log(`⚠️ Pool ${poolId} already resolved`);
        return;
      }

      let outcomeValue: number;

      // Calculate outcome based on predictions
      if (pool.predictions.length > 0) {
        outcomeValue = this.calculateAutomaticOutcome(pool.predictions);
      } else {
        // No predictions - randomly resolve to 0 or 100
        outcomeValue = Math.random() < 0.5 ? 0 : 100;
      }

      // Resolve the pool using the existing RewardService
      await RewardService.resolvePool(poolId, outcomeValue, false);

      console.log(`✅ Pool resolved automatically: ${poolTitle || poolId} → Outcome: ${outcomeValue}`);

    } catch (error) {
      console.error(`❌ Error auto-resolving pool ${poolId}:`, error);
    }
  }

  /**
   * Calculate automatic outcome based on predictions
   * Uses weighted average of all predictions (including zero-stake votes)
   */
  private static calculateAutomaticOutcome(predictions: any[]): number {
    if (predictions.length === 0) {
      return Math.random() < 0.5 ? 0 : 100;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const prediction of predictions) {
      // Convert prediction to numeric value
      const numericPrediction = RewardService.parseNumericPrediction(prediction.predictionValue);
      
      // Use stake amount as weight, but minimum weight of 1 for all predictions
      const weight = Math.max(prediction.stakeAmount, 1);
      
      weightedSum += numericPrediction * weight;
      totalWeight += weight;
    }

    const outcome = Math.round(weightedSum / totalWeight);
    
    // Ensure outcome is within valid range
    return Math.max(0, Math.min(100, outcome));
  }

  /**
   * Get service status
   */
  static getStatus(): { isRunning: boolean; intervalMs: number | null } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.checkInterval ? 60000 : null
    };
  }

  /**
   * Manually trigger a check for expired pools (for testing)
   */
  static async checkNow(): Promise<void> {
    console.log('🔄 Manual check for expired pools triggered...');
    await this.checkAndResolveExpiredPools();
  }
}
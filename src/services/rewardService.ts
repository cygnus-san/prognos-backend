import db from '../db';

export interface PredictionResult {
  prediction: any;
  score: number;
  weighted: number;
}

export class RewardService {
  /**
   * Calculate distance-based score for a prediction
   * Formula: score = 1 / (distance + 1)
   * @param predictionValue - The user's prediction value
   * @param outcomeValue - The actual outcome value
   * @returns Score between 0 and 1 (1 being perfect prediction)
   */
  static calculateScore(predictionValue: number, outcomeValue: number): number {
    const distance = Math.abs(predictionValue - outcomeValue);
    return 1 / (distance + 1);
  }

  /**
   * Calculate distance-based score with quadratic loss (optional variant)
   * Formula: score = 1 / (distance^2 + 1)
   * @param predictionValue - The user's prediction value
   * @param outcomeValue - The actual outcome value
   * @returns Score between 0 and 1 (1 being perfect prediction)
   */
  static calculateQuadraticScore(predictionValue: number, outcomeValue: number): number {
    const distance = Math.abs(predictionValue - outcomeValue);
    return 1 / (distance * distance + 1);
  }

  /**
   * Convert yes/no predictions to numeric values
   * @param predictionValue - "yes", "no", or numeric string
   * @returns Numeric value (yes=100, no=0, or parsed number)
   */
  static parseNumericPrediction(predictionValue: string): number {
    if (predictionValue.toLowerCase() === 'yes') return 100;
    if (predictionValue.toLowerCase() === 'no') return 0;
    return parseFloat(predictionValue);
  }

  /**
   * Resolve a pool and calculate rewards for all predictions
   * @param poolId - The pool ID to resolve
   * @param outcomeValue - The actual outcome value (0-100)
   * @param useQuadraticScoring - Whether to use quadratic scoring (default: false)
   * @returns Promise<void>
   */
  static async resolvePool(
    poolId: string, 
    outcomeValue: number, 
    useQuadraticScoring: boolean = false
  ): Promise<void> {
    // Validate outcome value
    if (outcomeValue < 0 || outcomeValue > 100) {
      throw new Error('Outcome value must be between 0 and 100');
    }

    // Get pool and all predictions
    const pool = await db.pool.findUnique({
      where: { id: poolId },
      include: { predictions: true }
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    if (pool.isResolved) {
      throw new Error('Pool is already resolved');
    }

    if (pool.predictions.length === 0) {
      // No predictions to resolve, just mark pool as resolved
      await db.pool.update({
        where: { id: poolId },
        data: { 
          outcomeValue, 
          isResolved: true 
        }
      });
      return;
    }

    // Calculate scores and weighted scores
    let totalWeighted = 0;
    const results: PredictionResult[] = [];

    for (const prediction of pool.predictions) {
      if (prediction.stakeAmount <= 0) {
        // Skip predictions without stake
        continue;
      }

      const numericPrediction = this.parseNumericPrediction(prediction.predictionValue);
      const score = useQuadraticScoring 
        ? this.calculateQuadraticScore(numericPrediction, outcomeValue)
        : this.calculateScore(numericPrediction, outcomeValue);
      
      const weighted = score * prediction.stakeAmount;

      totalWeighted += weighted;
      results.push({ prediction, score, weighted });
    }

    // Calculate and store rewards
    if (totalWeighted > 0) {
      for (const result of results) {
        const reward = (result.weighted / totalWeighted) * pool.totalStake;
        
        await db.prediction.update({
          where: { id: result.prediction.id },
          data: { claimableReward: reward }
        });
      }
    }

    // Mark pool as resolved
    await db.pool.update({
      where: { id: poolId },
      data: { 
        outcomeValue, 
        isResolved: true 
      }
    });
  }

  /**
   * Get reward summary for a pool (for testing/debugging)
   * @param poolId - The pool ID
   * @returns Reward summary data
   */
  static async getRewardSummary(poolId: string): Promise<any> {
    const pool = await db.pool.findUnique({
      where: { id: poolId },
      include: { 
        predictions: {
          where: { stakeAmount: { gt: 0 } }, // Only predictions with stake
          include: { user: true }
        }
      }
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    if (!pool.isResolved || pool.outcomeValue === null) {
      return {
        pool: {
          id: pool.id,
          title: pool.title,
          totalStake: pool.totalStake,
          isResolved: false
        },
        message: 'Pool not yet resolved'
      };
    }

    const summary = {
      pool: {
        id: pool.id,
        title: pool.title,
        totalStake: pool.totalStake,
        outcomeValue: pool.outcomeValue,
        isResolved: pool.isResolved
      },
      predictions: pool.predictions.map(p => {
        const numericPrediction = this.parseNumericPrediction(p.predictionValue);
        const distance = Math.abs(numericPrediction - pool.outcomeValue!);
        const score = this.calculateScore(numericPrediction, pool.outcomeValue!);
        
        return {
          userWalletAddress: p.userWalletAddress,
          predictionValue: p.predictionValue,
          numericPrediction,
          stakeAmount: p.stakeAmount,
          distance,
          score,
          weightedScore: score * p.stakeAmount,
          claimableReward: p.claimableReward,
          claimed: p.claimed
        };
      }),
      totalWeightedScore: pool.predictions.reduce((sum, p) => {
        const numericPrediction = this.parseNumericPrediction(p.predictionValue);
        const score = this.calculateScore(numericPrediction, pool.outcomeValue!);
        return sum + (score * p.stakeAmount);
      }, 0)
    };

    return summary;
  }

  /**
   * Check if a user can claim rewards for a pool
   * @param poolId - The pool ID
   * @param walletAddress - The user's wallet address
   * @returns Claim status and reward amount
   */
  static async checkClaimability(poolId: string, walletAddress: string): Promise<{
    canClaim: boolean;
    reason?: string;
    claimableReward?: number;
    prediction?: any;
  }> {
    const prediction = await db.prediction.findFirst({
      where: {
        poolId,
        userWalletAddress: walletAddress
      },
      include: { pool: true }
    });

    if (!prediction) {
      return {
        canClaim: false,
        reason: 'No prediction found for this user and pool'
      };
    }

    if (!prediction.pool.isResolved) {
      return {
        canClaim: false,
        reason: 'Pool is not yet resolved'
      };
    }

    if (prediction.claimed) {
      return {
        canClaim: false,
        reason: 'Rewards already claimed'
      };
    }

    if (prediction.stakeAmount <= 0) {
      return {
        canClaim: false,
        reason: 'No stake amount to claim'
      };
    }

    if (!prediction.claimableReward || prediction.claimableReward <= 0) {
      return {
        canClaim: false,
        reason: 'No rewards available'
      };
    }

    return {
      canClaim: true,
      claimableReward: prediction.claimableReward,
      prediction
    };
  }
}
import { Router, Request, Response } from "express";
import db from "../db";
import { RewardService } from "../services/rewardService";
import { TransactionService } from "../services/transactionService";

const router = Router();

interface VoteBody {
  walletAddress: string;
  predictionValue: "yes" | "no";
}

interface StakeBody {
  walletAddress: string;
  predictionValue: string;
  stakeAmount: number;
  transactionId?: string; // STX transaction ID for verification
}

interface ClaimBody {
  walletAddress: string;
}

interface ResolvePoolBody {
  outcomeValue: number;
  useQuadraticScoring?: boolean;
}

// GET /api/pools - View all pools
router.get("/", async (req: Request, res: Response) => {
  try {
    const pools = await db.pool.findMany({
      include: {
        predictions: true,
        _count: {
          select: { predictions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(pools);
  } catch (error) {
    console.error("Error fetching pools:", error);
    return res.status(500).json({ error: "Failed to fetch pools" });
  }
});

// GET /api/pools/feeds/:walletAddress - Get pools user hasn't voted on yet
router.get("/feeds/:walletAddress", async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Get all pools where user hasn't made any predictions
    const unvotedPools = await db.pool.findMany({
      where: {
        predictions: {
          none: {
            userWalletAddress: walletAddress,
          },
        },
      },
      include: {
        predictions: true,
        _count: {
          select: { predictions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(unvotedPools);
  } catch (error) {
    console.error("Error fetching feed pools:", error);
    return res.status(500).json({ error: "Failed to fetch feed pools" });
  }
});

// GET /api/pools/:id - Get specific pool
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await db.pool.findUnique({
      where: { id },
      include: {
        predictions: true,
        _count: {
          select: { predictions: true },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    return res.json(pool);
  } catch (error) {
    console.error("Error fetching pool:", error);
    return res.status(500).json({ error: "Failed to fetch pool" });
  }
});

// POST /api/pools/:id/vote - User votes on pool (without money)
router.post("/:id/vote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, predictionValue }: VoteBody = req.body;

    if (!walletAddress || !predictionValue) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if pool exists
    const pool = await db.pool.findUnique({ where: { id } });
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    // Check if user already has a prediction for this pool
    const existingPrediction = await db.prediction.findFirst({
      where: {
        poolId: id,
        userWalletAddress: walletAddress,
      },
    });

    if (existingPrediction) {
      // Update existing prediction
      const prediction = await db.prediction.update({
        where: { id: existingPrediction.id },
        data: { predictionValue },
      });
      return res.json(prediction);
    } else {
      // Create user if doesn't exist
      await db.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });

      // Create new prediction
      const prediction = await db.prediction.create({
        data: {
          poolId: id,
          userWalletAddress: walletAddress,
          predictionValue,
          stakeAmount: 0,
        },
      });
      return res.json(prediction);
    }
  } catch (error) {
    console.error("Error creating vote:", error);
    return res.status(500).json({ error: "Failed to create vote" });
  }
});

// POST /api/pools/:id/stake - User stakes on pool with transaction verification
router.post("/:id/stake", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, predictionValue, stakeAmount, transactionId }: StakeBody = req.body;

    if (!walletAddress || !predictionValue || !stakeAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (stakeAmount <= 0) {
      return res.status(400).json({ error: "Stake amount must be positive" });
    }

    // Transaction verification is now required for stakes > 0
    if (stakeAmount > 0 && !transactionId) {
      return res.status(400).json({ error: "Transaction ID required for stakes" });
    }

    // Simple transaction ID validation
    if (transactionId && (typeof transactionId !== 'string' || transactionId.trim().length === 0)) {
      return res.status(400).json({ error: "Invalid transaction ID format" });
    }

    // Check if pool exists
    const pool = await db.pool.findUnique({ where: { id } });
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    // Check if deadline has passed
    if (new Date() > pool.deadline) {
      return res.status(400).json({ error: "Pool deadline has passed" });
    }

    // Check if transaction has already been used
    if (transactionId) {
      const existingTransaction = await db.prediction.findFirst({
        where: { transactionId },
      });

      if (existingTransaction) {
        return res.status(400).json({ error: "Transaction has already been used for another stake" });
      }
    }

    // Verify transaction on-chain
    let transactionVerified = false;
    if (transactionId && stakeAmount > 0) {
      try {
        const verification = await TransactionService.verifyStakeTransaction(
          transactionId,
          walletAddress,
          stakeAmount,
          30 // 30 minutes max age
        );

        if (!verification.isValid) {
          return res.status(400).json({ 
            error: `Transaction verification failed: ${verification.error}`,
            transactionData: verification.transactionData
          });
        }

        transactionVerified = true;
      } catch (error) {
        return res.status(500).json({ 
          error: "Transaction verification failed", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Create user if doesn't exist
    await db.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    // Check if user already has a prediction for this pool
    const existingPrediction = await db.prediction.findFirst({
      where: {
        poolId: id,
        userWalletAddress: walletAddress,
      },
    });

    let prediction;
    if (existingPrediction) {
      // Update existing prediction with stake
      prediction = await db.prediction.update({
        where: { id: existingPrediction.id },
        data: {
          predictionValue,
          stakeAmount: existingPrediction.stakeAmount + stakeAmount,
          transactionId: transactionId || existingPrediction.transactionId,
          transactionVerified: transactionVerified || existingPrediction.transactionVerified,
        },
      });
    } else {
      // Create new prediction with stake
      prediction = await db.prediction.create({
        data: {
          poolId: id,
          userWalletAddress: walletAddress,
          predictionValue,
          stakeAmount,
          transactionId,
          transactionVerified,
        },
      });
    }

    // Update pool total stake
    await db.pool.update({
      where: { id },
      data: { totalStake: { increment: stakeAmount } },
    });

    return res.json({
      ...prediction,
      message: transactionVerified ? "Stake verified and recorded successfully" : "Stake recorded (verification pending)"
    });
  } catch (error) {
    console.error("Error creating stake:", error);
    return res.status(500).json({ error: "Failed to create stake" });
  }
});

// POST /api/pools/:id/resolve - Admin resolves pool with outcome value
router.post("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outcomeValue, useQuadraticScoring = false }: ResolvePoolBody = req.body;

    if (outcomeValue === undefined || outcomeValue === null) {
      return res.status(400).json({ error: "Outcome value is required" });
    }

    if (outcomeValue < 0 || outcomeValue > 100) {
      return res.status(400).json({ error: "Outcome value must be between 0 and 100" });
    }

    // Check if pool exists
    const pool = await db.pool.findUnique({ where: { id } });
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    if (pool.isResolved) {
      return res.status(400).json({ error: "Pool is already resolved" });
    }

    // Check if deadline has passed (optional check for admin)
    if (new Date() < pool.deadline) {
      console.warn(`Warning: Resolving pool ${id} before deadline`);
    }

    await RewardService.resolvePool(id, outcomeValue, useQuadraticScoring);

    const summary = await RewardService.getRewardSummary(id);

    return res.json({
      message: "Pool resolved successfully",
      ...summary
    });
  } catch (error) {
    console.error("Error resolving pool:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to resolve pool" });
  }
});

// GET /api/pools/:id/rewards - Get reward summary for a pool
router.get("/:id/rewards", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const summary = await RewardService.getRewardSummary(id);
    return res.json(summary);
  } catch (error) {
    console.error("Error fetching reward summary:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch reward summary" });
  }
});

// POST /api/pools/:id/claim - Claim rewards (updated)
router.post("/:id/claim", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress }: ClaimBody = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    // Check claimability using reward service
    const claimCheck = await RewardService.checkClaimability(id, walletAddress);

    if (!claimCheck.canClaim) {
      return res.status(400).json({ error: claimCheck.reason });
    }

    // Mark as claimed
    const updatedPrediction = await db.prediction.update({
      where: { id: claimCheck.prediction!.id },
      data: { claimed: true },
    });

    return res.json({
      ...updatedPrediction,
      claimedAmount: claimCheck.claimableReward,
      message: "Rewards claimed successfully",
    });
  } catch (error) {
    console.error("Error claiming reward:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to claim reward" });
  }
});

export default router;

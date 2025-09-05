import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

interface VoteBody {
  walletAddress: string;
  predictionValue: 'yes' | 'no';
}

interface StakeBody {
  walletAddress: string;
  predictionValue: string;
  stakeAmount: number;
}

interface ClaimBody {
  walletAddress: string;
}

// GET /api/pools - View all pools
router.get('/', async (req: Request, res: Response) => {
  try {
    const pools = await db.pool.findMany({
      include: {
        predictions: true,
        _count: {
          select: { predictions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return res.json(pools);
  } catch (error) {
    console.error('Error fetching pools:', error);
    return res.status(500).json({ error: 'Failed to fetch pools' });
  }
});

// GET /api/pools/:id - Get specific pool
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await db.pool.findUnique({
      where: { id },
      include: {
        predictions: true,
        _count: {
          select: { predictions: true }
        }
      }
    });
    
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    return res.json(pool);
  } catch (error) {
    console.error('Error fetching pool:', error);
    return res.status(500).json({ error: 'Failed to fetch pool' });
  }
});

// POST /api/pools/:id/vote - User votes on pool (without money)
router.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, predictionValue }: VoteBody = req.body;
    
    if (!walletAddress || !predictionValue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if pool exists
    const pool = await db.pool.findUnique({ where: { id } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    // Check if user already has a prediction for this pool
    const existingPrediction = await db.prediction.findFirst({
      where: {
        poolId: id,
        userWalletAddress: walletAddress
      }
    });
    
    if (existingPrediction) {
      // Update existing prediction
      const prediction = await db.prediction.update({
        where: { id: existingPrediction.id },
        data: { predictionValue }
      });
      return res.json(prediction);
    } else {
      // Create user if doesn't exist
      await db.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress }
      });
      
      // Create new prediction
      const prediction = await db.prediction.create({
        data: {
          poolId: id,
          userWalletAddress: walletAddress,
          predictionValue,
          stakeAmount: 0
        }
      });
      return res.json(prediction);
    }
  } catch (error) {
    console.error('Error creating vote:', error);
    return res.status(500).json({ error: 'Failed to create vote' });
  }
});

// POST /api/pools/:id/stake - User stakes on pool
router.post('/:id/stake', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, predictionValue, stakeAmount }: StakeBody = req.body;
    
    if (!walletAddress || !predictionValue || !stakeAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (stakeAmount <= 0) {
      return res.status(400).json({ error: 'Stake amount must be positive' });
    }
    
    // Check if pool exists
    const pool = await db.pool.findUnique({ where: { id } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    // Check if deadline has passed
    if (new Date() > pool.deadline) {
      return res.status(400).json({ error: 'Pool deadline has passed' });
    }
    
    // Create user if doesn't exist
    await db.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress }
    });
    
    // Check if user already has a prediction for this pool
    const existingPrediction = await db.prediction.findFirst({
      where: {
        poolId: id,
        userWalletAddress: walletAddress
      }
    });
    
    let prediction;
    if (existingPrediction) {
      // Update existing prediction with stake
      prediction = await db.prediction.update({
        where: { id: existingPrediction.id },
        data: { 
          predictionValue,
          stakeAmount: existingPrediction.stakeAmount + stakeAmount
        }
      });
    } else {
      // Create new prediction with stake
      prediction = await db.prediction.create({
        data: {
          poolId: id,
          userWalletAddress: walletAddress,
          predictionValue,
          stakeAmount
        }
      });
    }
    
    // Update pool total stake
    await db.pool.update({
      where: { id },
      data: { totalStake: { increment: stakeAmount } }
    });
    
    return res.json(prediction);
  } catch (error) {
    console.error('Error creating stake:', error);
    return res.status(500).json({ error: 'Failed to create stake' });
  }
});

// POST /api/pools/:id/claim - Claim rewards (mock)
router.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress }: ClaimBody = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    // Find user's prediction
    const prediction = await db.prediction.findFirst({
      where: {
        poolId: id,
        userWalletAddress: walletAddress
      },
      include: { pool: true }
    });
    
    if (!prediction) {
      return res.status(404).json({ error: 'No prediction found for this user and pool' });
    }
    
    if (prediction.claimed) {
      return res.status(400).json({ error: 'Rewards already claimed' });
    }
    
    if (prediction.stakeAmount === 0) {
      return res.status(400).json({ error: 'No stake to claim' });
    }
    
    // Mock reward calculation
    // In a real app, this would check the actual outcome and calculate rewards
    const mockReward = prediction.stakeAmount * 1.5; // 50% profit for demo
    
    // Mark as claimed
    const updatedPrediction = await db.prediction.update({
      where: { id: prediction.id },
      data: { claimed: true }
    });
    
    return res.json({
      ...updatedPrediction,
      mockReward,
      message: 'Rewards claimed successfully (mock)'
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
    return res.status(500).json({ error: 'Failed to claim reward' });
  }
});

export default router;
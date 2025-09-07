🎯 Prognos — Reward Mechanism Spec

1. Reward Philosophy

Rewards must be proportional to closeness of prediction and stake size.

Users who predict closer to the actual outcome get a higher share of the total pool.

Pool = Σ all stakes (minus optional protocol fee).

2. Reward Lifecycle
   Step 1: Pool Resolution

At deadline, the pool gets an actual outcome value (e.g., crowd opinion = 53%).

Admin (or oracle script) updates pool:

UPDATE Pool SET outcomeValue = 53 WHERE id = poolId;

Step 2: Score Calculation

For each prediction:

distance = |predictionValue - outcomeValue|
score = 1 / (distance + 1)
weightedScore = score × stakeAmount

Step 3: Reward Distribution

Compute total weighted score:

totalWeighted = Σ(weightedScore for all predictions)

Compute reward share for each user:

userReward = (weightedScore / totalWeighted) × pool.totalStake

Store results in Prediction.claimableReward (new column).

Step 4: Claim

When user calls POST /api/pools/:id/claim:

Check if already claimed.

Return their claimableReward.

Mark claimed = true.

3. Database Changes

Add a column to Prediction:

Prediction {
id
poolId
userWalletAddress
predictionValue (int or yes/no mapped to %)
stakeAmount
claimed (boolean)
claimableReward (float) // NEW
}

4. Example (Linear Scoring)

Pool total = 35 tokens

Outcome = 50%

User Stake Prediction Distance Score Weighted Reward
Alice 10 60% 10 0.091 0.91 8.94
Bob 20 40% 10 0.091 1.82 17.87
Charlie 5 55% 5 0.167 0.835 8.19 5. Reward Algorithm (Pseudocode)
async function resolvePool(poolId, outcomeValue) {
const pool = await db.pool.findUnique({ where: { id: poolId } });
const predictions = await db.prediction.findMany({ where: { poolId } });

let totalWeighted = 0;
const results = [];

for (const p of predictions) {
const distance = Math.abs(p.predictionValue - outcomeValue);
const score = 1 / (distance + 1);
const weighted = score \* p.stakeAmount;

    totalWeighted += weighted;
    results.push({ prediction: p, score, weighted });

}

for (const r of results) {
const reward = (r.weighted / totalWeighted) \* pool.totalStake;
await db.prediction.update({
where: { id: r.prediction.id },
data: { claimableReward: reward }
});
}

await db.pool.update({
where: { id: poolId },
data: { outcomeValue }
});
}

6. Variants (Optional Configurations)

Quadratic Loss:

score = 1 / (distance^2 + 1)

Bracket Mode: predictions are ranges, rewards go to closest range.

Winner-Takes-Most: only top X% closest predictions share rewards.

7. Mock Payout Handling

Since MVP uses mock payout:

Claiming just sets claimed = true and returns claimableReward.

No tokens move on-chain (yet).

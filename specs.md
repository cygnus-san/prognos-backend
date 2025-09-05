# Prognos MVP — LLM Specs (Backend & Frontend)

## Backend (Node.js + Express)

**Philosophy**: Keep it simple, functional, no over-engineering. No Redis, no BullMQ, no complex jobs. Identity handled via **Stacks wallet addresses**.

### Tech stack

- Node.js + Express
- SQLite + Prisma ORM (simple, file-based DB)
- Stacks wallet addresses for identity (no BetterAuth)

### Entities (Database tables)

- **User**: { id, walletAddress }
- **Pool**: { id, title, description, tag, deadline, image, totalStake }
- **Prediction**: { id, poolId, userWalletAddress, predictionValue (yes/no or numeric), stakeAmount, claimed }

### User flows

1. **Admin creates a pool**

   - Run via `npm run create-pool` (script).
   - Fields: title, description, tag, deadline, image.
   - `totalStake` starts at 0.
   - Admin script inserts directly into DB (no route).

2. **User votes on pool**

   - Route: `POST /api/pools/:id/vote`
   - Input: walletAddress, yes/no.
   - Saves prediction (without money).

3. **User stakes on pool**

   - Route: `POST /api/pools/:id/stake`
   - Input: walletAddress, predicted outcome (% or yes/no stake), stakeAmount.
   - Adds stake to pool’s totalStake.

4. **View pools**

   - Route: `GET /api/pools`
   - Returns active and ended pools.

5. **Claim rewards (mock)**

   - Route: `POST /api/pools/:id/claim`
   - Input: walletAddress.
   - Backend checks if prediction was correct, calculates reward share, and marks as claimed.
   - Mock payout: just mark as “claimed.”

### Scripts

- **`npm run create-pool`** → Runs `scripts/createPool.js`.
  Example fields passed via CLI args or prompt.

### Notes

- **No auth library**; walletAddress = identity.
- No payout integration, just mocked reward calculation.

---

# Prognos MVP Backend

A simple Node.js + TypeScript backend for prediction pools using Stacks wallet addresses for identity.

## Tech Stack

- **Node.js + Express** - Web server
- **TypeScript** - Type safety
- **SQLite + Prisma** - Database and ORM
- **Stacks Wallet Addresses** - User identity (no auth library)

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Main Express server
│   ├── db.ts             # Database utility
│   └── routes/
│       └── pools.ts      # Pool-related API routes
├── scripts/
│   └── createPool.ts     # Admin script to create pools
├── prisma/
│   └── schema.prisma     # Database schema
└── package.json
```

## Setup & Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up the database:**

   ```bash
   npm run db:push
   npm run db:generate
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

The server will run on http://localhost:3000

## Database Models

### User

- `id` - Unique identifier
- `walletAddress` - Stacks wallet address (unique)

### Pool

- `id` - Unique identifier
- `title` - Pool title
- `description` - Pool description
- `tag` - Category tag
- `deadline` - Deadline for predictions
- `image` - Optional image URL
- `totalStake` - Total amount staked

### Prediction

- `id` - Unique identifier
- `poolId` - Reference to Pool
- `userWalletAddress` - Reference to User
- `predictionValue` - "yes"/"no" or numeric value
- `stakeAmount` - Amount staked
- `claimed` - Whether rewards have been claimed

## API Endpoints

### GET /api/pools

Returns all pools with predictions and counts.

### GET /api/pools/:id

Returns specific pool details.

### POST /api/pools/:id/vote

Vote on a pool without staking money.

**Body:**

```json
{
  "walletAddress": "SP123...ABC",
  "predictionValue": "yes"
}
```

### POST /api/pools/:id/stake

Stake money on a prediction.

**Body:**

```json
{
  "walletAddress": "SP123...ABC",
  "predictionValue": "yes",
  "stakeAmount": 10.5
}
```

### POST /api/pools/:id/claim

Claim rewards (mock implementation).

**Body:**

```json
{
  "walletAddress": "SP123...ABC"
}
```

## Admin Commands

### Create a Pool

**Interactive mode:**

```bash
npm run create-pool
```

**CLI mode:**

```bash
npm run create-pool "Pool Title" "Pool Description" "sports" "2024-12-31" "https://image.url"
```

## Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Run production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run create-pool` - Create a new prediction pool

## Environment Variables

The `.env` file contains:

```
DATABASE_URL="file:./dev.db"
```

## Notes

- No authentication library is used; wallet addresses serve as user identity
- Reward calculation is mocked (always returns 1.5x stake amount)
- SQLite database file (`dev.db`) is created automatically
- Pool deadline enforcement prevents staking after deadline
- Users can update their predictions and stakes before deadline

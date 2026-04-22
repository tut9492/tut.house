# Toast or Fine Booty

A real-time multiplayer NFT card flip game on MegaETH. Players flip cards to find rare Breadio NFTs — winners get real tokens transferred on-chain, and burns destroy tokens permanently.

Built live on stream with 1,000+ viewers.

## How It Works

- Players connect wallets and join rooms
- Each room has a grid of face-down cards
- Flip a card: find a **rare** (NFT transferred to you) or get **toasted** (burned on-chain)
- 30-second rounds with automatic player rotation
- Admin controls for starting, pausing, and managing rooms

## Architecture

```
Frontend (Next.js + Vercel)
    ↕ WebSocket
Game Server (Node.js + Express + SQLite)
    ↕ ethers.js
MegaETH (ERC-721 contract)
```

### Frontend
- Next.js 15 app at `/toast-or-fine-booty`
- Real-time card grid with flip animations
- Live countdown timer, cursor tracking, notification feed
- Admin panel for room management
- Sound effects (8-bit style)

### Game Server
- WebSocket-based multiplayer (up to 10 players per room + lobby queue)
- SQLite (WAL mode) for crash-resilient state
- Serial transaction queue to prevent nonce collisions
- Dual RPC: reads on drpc.org, writes on mainnet
- Room system: holder-only, whitelist, or public rooms
- 30-second round timer with automatic player rotation

### On-Chain
- **Prizes**: `transferFrom(signer, winner, tokenId)` — real NFT transfer
- **Burns**: `burn(tokenId)` — permanent on-chain destruction
- **Contract**: ERC-721 on MegaETH (chain ID 4326)

## Setup

### Prerequisites
- Node.js 18+
- A MegaETH wallet with ERC-721 tokens
- The wallet must be the contract owner (for burns)

### Frontend

```bash
npm install
npm run dev
```

### Game Server

```bash
cd game-server
npm install

# Set environment variable
export BREADIO_PRIVATE_KEY=your_private_key

# Rebuild room data (scans chain for token ownership)
node rebuild-rooms.js [prizesPerBreadioRoom] [prizesPerPublicRoom] [realBurns] [cardsPerRoom]

# Start server
node server-v2.js
# Or with PM2:
pm2 start server-v2.js --name toast-game-v2
```

### Configuration

Edit `server-v2.js` to configure:
- `ROOM_CONFIG` — room names, holder requirements, cooldowns, max players
- `WHITELIST` — wallet addresses for invite-only rooms
- `ADMIN_WALLETS` — wallets that can access the admin panel
- `ROUND_DURATION` — seconds per round (default 30)
- `CONTRACT` — your ERC-721 contract address
- `WRITE_RPC` / `READ_RPC` — MegaETH RPC endpoints

### Room Data

`rebuild-rooms.js` generates `game-data-{room}.json` files:

```json
{
  "prizes": [6087],        // Real token IDs — transferred to winner
  "realBurns": [28, 29],   // Real token IDs — burned on-chain
  "burns": [10001, 10002]  // Fake IDs — game-state only (filler)
}
```

## Admin

### Browser Panel
Click ADMIN button (visible to admin wallets), sign to authenticate, then start/pause/kick per room.

### CLI (from server)
```bash
# Start all rooms (30s timer)
curl -X POST http://localhost:3001/api/game/admin/startall

# Start single room
curl -X POST "http://localhost:3001/api/game/admin/start?room=breadio"

# Pause all
curl -X POST http://localhost:3001/api/game/admin/pauseall

# Status
curl http://localhost:3001/api/game/admin/status
```

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, React
- **Server**: Node.js, Express, WebSocket (ws), better-sqlite3
- **Chain**: ethers.js v6, MegaETH
- **Deploy**: Vercel (frontend), EC2 + PM2 + Caddy (server)

## License

MIT

## Credits

Built by [@Tuteth_](https://x.com/Tuteth_) and Ay the Vizier.

Part of the [Breadio](https://agnt.social) ecosystem on MegaETH.

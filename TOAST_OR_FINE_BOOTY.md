# Toast or Fine Booty — Game Spec

## Concept
SMB3-style card flip game where players flip face-down Breadio NFT cards. Bad cards get burned on-chain (toast). Good cards get transferred to the player's wallet (fine booty). Multiplayer, real-time, all gas sponsored.

## Visual Style
- **SMB3 bonus card game** aesthetic
- Black background, candy stripe border (brown/gold Breadio colors)
- Pixel font (Press Start 2P)
- Cards face-down with Breadio logo on back
- Gold highlight border on hover (like NES selected card)
- Brick pattern header with game title
- Scrollable card grid (1,816 cards)

## Game Rules
- Must own a Breadio NFT to play
- Unlimited flips, FCFS
- 1,816 face-down cards on a shared board
- 136 are prizes (Fine Booty), 1,680 are burns (Toast)
- ~1 in 13 chance per flip
- All cards visible to all players simultaneously
- Once flipped, gone forever (burned or won)
- Game ends when all 136 prizes are found

## Card Flip Outcomes

### Toast (Bad Card — 1,680 cards)
- Card flips to reveal the Breadio NFT art
- Disintegration/fire animation
- 8-bit fire/crackle sound effect
- `burn(tokenId)` called on-chain (gas sponsored)
- Card disappears from board

### Fine Booty (Good Card — 136 cards)
- Card flips to reveal the Breadio NFT art with sparkle/glow
- Star burst animation
- 8-bit win chime / soothing ding
- `transferFrom(breadioWallet, playerWallet, tokenId)` called on-chain (gas sponsored)
- Card shows as "CLAIMED by [username]"
- Player gets NFT in their wallet

## Multiplayer
- Real-time WebSocket connection
- Player cursors visible with usernames
- See other players hovering/clicking in real-time
- Board state synced across all players
- Cap: ~50 concurrent players
- Flip cooldown: 3 seconds per player (prevent spam)

## Architecture

### Frontend (tut.house — Vercel)
- Next.js page at /toast-or-fine-booty (or /game)
- Wallet connect (wagmi/viem or ethers)
- WebSocket client for real-time
- Card grid with flip animations
- Sound effects (Web Audio API)
- Player cursor rendering

### Game Server (AWS EC2)
- Node.js + WebSocket (ws library)
- Board state in memory + SQLite backup
- Signer wallet for burn/transfer txs
- Gate: verify player owns Breadio NFT
- Rate limit: 1 flip per 3 seconds per player
- Broadcast flips to all connected players

### On-Chain
- Contract: 0x015061aa806b5abab9ee453e366e18a713e8ea80
- Chain: MegaETH (4326)
- RPC: https://mainnet.megaeth.com/rpc
- Signer: 0xEdaA4c0e0056eD6A17A755493c283296Fe8202Bb
- burn(uint256 tokenId) — for toast cards
- transferFrom(signer, player, tokenId) — for prize cards
- Requires: setApprovalForAll for signer on prize NFTs

### Data

Prize IDs (136):
```
4979, 4982, 4983, 4991, 4999, 5003, 5022, 5042, 5045, 5064, 5068, 5078,
5136, 5148, 5149, 5154, 5158, 5178, 5189, 5191, 5194, 5195, 5230, 5231,
5241, 5248, 5249, 5260, 5277, 5300, 5338, 5343, 5344, 5383, 5399, 5401,
5410, 5411, 5412, 5431, 5439, 5445, 5453, 5466, 5485, 5489, 5501, 5509,
5529, 5533, 5555, 5565, 5595, 5607, 5634, 5638, 5655, 5669, 5723, 5738,
5740, 5783, 5790, 5819, 5855, 5856, 5873, 5880, 5975, 5980, 6005, 6038,
6054, 6055, 6087, 6115, 6117, 6122, 6130, 6160, 6163, 6178, 6201, 6228,
6241, 6251, 6253, 6256, 6258, 6261, 6283, 6289, 6291, 6298, 6302, 6318,
6323, 6325, 6329, 6345, 6346, 6377, 6378, 6382, 6383, 6400, 6452, 6457,
6461, 6502, 6520, 6529, 6532, 6538, 6571, 6620, 6653, 6657, 6681, 6708,
6719, 6720, 6721, 6744, 6832, 6835, 6842, 6845, 6877, 6882, 6905, 6929,
6930, 6935, 6955, 6965
```

Burn IDs: everything in breadio-burn-plan.json "to_burn" array (1,816 cards)

## Sounds
- Card flip: short click/snap
- Toast (burn): fire crackle, 8-bit explosion
- Fine Booty (win): chime/ding, coin collect sound
- Hover: subtle tick

## Animations
- Card hover: gold border glow, slight lift
- Card flip: 3D CSS transform (like real card flip)
- Toast: card crumbles/disintegrates into ash particles, fire overlay
- Fine Booty: sparkle burst, card glows gold, stays revealed
- Player cursor: small pixel arrow with username label

## Flow
1. Player visits tut.house/toast-or-fine-booty
2. Connects wallet
3. Backend checks: owns Breadio NFT? No → "You need a Breadio to play"
4. Player enters username
5. Joins the game board
6. Sees grid of face-down cards + other player cursors
7. Clicks a card → 3 second cooldown starts
8. Server processes: burn or prize?
9. All players see the result animation
10. Repeat until all 136 prizes found

## Environment Variables (Game Server)
```
BREADIO_SIGNER_KEY=0x...          # Breadio wallet private key
BREADIO_CONTRACT=0x015061aa806b5abab9ee453e366e18a713e8ea80
MEGAETH_RPC=https://mainnet.megaeth.com/rpc
GAME_PORT=3001
```

## Status
- Spec: COMPLETE
- Frontend: NOT STARTED
- Game Server: NOT STARTED
- Prize NFTs transferred to Breadio wallet: NOT YET
- setApprovalForAll configured: NOT YET

/**
 * Toast or Fine Booty — Game Server
 *
 * SMB3-style card flip game. Players flip Breadio NFT cards.
 * Bad cards get burned on-chain. Good cards get transferred to the player.
 * Real-time multiplayer via WebSocket.
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = process.env.GAME_PORT || 3001;
const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://mainnet.megaeth.com/rpc';
const SIGNER_KEY = process.env.BREADIO_PRIVATE_KEY;
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
const adminTokens = new Set(); // active admin session tokens

if (!SIGNER_KEY) {
  console.error('BREADIO_PRIVATE_KEY not set');
  process.exit(1);
}

// ─── Blockchain Setup ───────────────────────────────────────────────────────

// HTTP provider with keep-alive for persistent connections
const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const httpProvider = new ethers.JsonRpcProvider(RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
  batchMaxCount: 1,
});
// Patch fetch options to use keep-alive agent
const origFetch = httpProvider._getConnection?.bind(httpProvider);

const wallet = new ethers.Wallet(SIGNER_KEY, httpProvider);
const ABI = [
  'function burn(uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const contract = new ethers.Contract(CONTRACT, ABI, wallet);
// Read-only contract for verify/tokenURI calls
const readContract = new ethers.Contract(CONTRACT, ABI, httpProvider);

// Warm up RPC connection on startup
async function warmUpRpc() {
  try {
    await httpProvider.getNetwork();
    console.log('RPC connection warmed up');
  } catch {}
}

// Send raw signed tx using MegaETH's sync method for instant receipt
async function sendRawSync(signedTx) {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendRawTransactionSync',
        params: [signedTx],
        id: Date.now(),
      }),
      agent: keepAliveAgent,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result; // full receipt
  } catch (err) {
    // Fallback to normal send
    return null;
  }
}

// ─── Parallel Nonce Manager (no queue bottleneck) ──────────────────────────
let currentNonce = null;

async function initNonce() {
  currentNonce = await httpProvider.getTransactionCount(wallet.address, 'pending');
  console.log(`Initial nonce: ${currentNonce}`);
}

function getNextNonce() {
  const nonce = currentNonce;
  currentNonce++;
  return nonce;
}

// Periodically sync nonce in case of drift
setInterval(async () => {
  try {
    const chainNonce = await httpProvider.getTransactionCount(wallet.address, 'pending');
    if (chainNonce > currentNonce) {
      currentNonce = chainNonce;
    }
  } catch {}
}, 10000);

console.log(`Signer wallet: ${wallet.address}`);

// ─── Database ───────────────────────────────────────────────────────────────

const db = new Database(path.join(__dirname, 'game.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    token_id INTEGER PRIMARY KEY,
    is_prize INTEGER DEFAULT 0,
    status TEXT DEFAULT 'face_down',
    flipped_by TEXT,
    flipped_at TEXT,
    tx_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS players (
    address TEXT PRIMARY KEY,
    username TEXT,
    wins INTEGER DEFAULT 0,
    burns INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS flips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER,
    player_address TEXT,
    result TEXT,
    tx_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Game State ─────────────────────────────────────────────────────────────

let gameState = {
  cards: {},       // tokenId -> { status, isPrize, flippedBy }
  players: {},     // address -> { username, cursor, lastFlip, isHolder }
  lobby: [],       // [{address, username, isHolder, ws}] — waiting to play
  totalCards: 0,
  totalPrizes: 0,
  prizesFound: 0,
  cardsBurned: 0,
  paused: true,
  round: 1,
  maxPrizes: 25,
  maxActivePlayers: 15,
};

// Load prize list
const PRIZE_IDS = new Set();

function loadGameData() {
  const dataFile = path.join(__dirname, 'game-data.json');
  if (!fs.existsSync(dataFile)) {
    console.error('game-data.json not found! Run setup first.');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  data.prizes.forEach(id => PRIZE_IDS.add(id));
  const allCards = [...data.prizes, ...data.burns];

  // Initialize DB if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
  if (count === 0) {
    console.log('Initializing game board...');
    const insert = db.prepare('INSERT OR IGNORE INTO cards (token_id, is_prize) VALUES (?, ?)');
    const tx = db.transaction(() => {
      for (const id of allCards) {
        insert.run(id, PRIZE_IDS.has(id) ? 1 : 0);
      }
    });
    tx();
    console.log(`Loaded ${allCards.length} cards (${data.prizes.length} prizes, ${data.burns.length} burns)`);
  }

  // Load into memory
  const rows = db.prepare('SELECT * FROM cards').all();
  for (const row of rows) {
    gameState.cards[row.token_id] = {
      status: row.status,
      isPrize: row.is_prize === 1,
      flippedBy: row.flipped_by,
    };
  }

  gameState.totalCards = rows.length;
  gameState.totalPrizes = rows.filter(r => r.is_prize).length;
  gameState.prizesFound = rows.filter(r => r.is_prize && r.status !== 'face_down').length;
  gameState.cardsBurned = rows.filter(r => !r.is_prize && r.status !== 'face_down').length;
}

// ─── Express Server ─────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Game state endpoint
app.get('/api/game/state', (req, res) => {
  const cards = {};
  for (const [id, card] of Object.entries(gameState.cards)) {
    cards[id] = {
      status: card.status,
      // Don't reveal if it's a prize until flipped!
      isPrize: card.status !== 'face_down' ? card.isPrize : undefined,
      flippedBy: card.flippedBy,
    };
  }
  res.json({
    cards,
    totalCards: gameState.totalCards,
    totalPrizes: gameState.totalPrizes,
    prizesFound: gameState.prizesFound,
    cardsBurned: gameState.cardsBurned,
    cardsRemaining: gameState.totalCards - gameState.prizesFound - gameState.cardsBurned,
    players: Object.entries(gameState.players).map(([addr, p]) => ({
      address: addr.slice(0, 6) + '...' + addr.slice(-4),
      username: p.username,
    })),
  });
});

// Verify ownership of Breadio NFT
app.post('/api/game/verify', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });

  try {
    const balance = await readContract.balanceOf(address);
    const owns = Number(balance) > 0;
    res.json({ owns, balance: Number(balance) });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Caches
const imageCache = {};
const verifyCache = {};

// Get NFT image from on-chain tokenURI (with cache)
app.get('/api/game/nft/:tokenId', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId)) return res.status(400).json({ error: 'Invalid token ID' });

  // Return cached image if available
  if (imageCache[tokenId]) return res.json(imageCache[tokenId]);

  try {
    const uri = await readContract.tokenURI(tokenId);
    const b64Idx = uri.indexOf('base64,');
    if (b64Idx >= 0) {
      const json = JSON.parse(Buffer.from(uri.slice(b64Idx + 7), 'base64').toString());
      const result = { image: json.image || '', name: json.name || `#${tokenId}` };
      imageCache[tokenId] = result;
      res.json(result);
    } else {
      res.json({ image: '', name: `#${tokenId}` });
    }
  } catch (err) {
    // Don't spam logs — just return empty
    res.json({ image: '', name: `#${tokenId}` });
  }
});

// ─── Admin Endpoints ─────────────────────────────────────────────────────

function requireAdmin(req, res) {
  const auth = req.headers.authorization;
  const token = auth?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    res.status(403).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// Admin auth — verify wallet signature
app.post('/api/game/admin/auth', (req, res) => {
  const { address, message, signature } = req.body;
  if (!address || !message || !signature) return res.status(400).json({ error: 'Missing fields' });

  try {
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== address.toLowerCase() || !ADMIN_WALLETS.includes(recovered)) {
      return res.status(403).json({ error: 'Not an admin wallet' });
    }

    // Generate a session token
    const token = ethers.hexlify(ethers.randomBytes(32));
    adminTokens.add(token);

    // Expire after 24 hours
    setTimeout(() => adminTokens.delete(token), 24 * 60 * 60 * 1000);

    console.log(`[ADMIN] Authenticated: ${address.slice(0, 10)}...`);
    res.json({
      token,
      status: {
        paused: gameState.paused,
        round: gameState.round,
        maxPrizes: gameState.maxPrizes,
        prizesFound: gameState.prizesFound,
        cardsBurned: gameState.cardsBurned,
        cardsRemaining: gameState.totalCards - gameState.prizesFound - gameState.cardsBurned,
        playersOnline: Object.keys(gameState.players).length,
      },
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid signature' });
  }
});

// Start the game
app.post('/api/game/admin/start', (req, res) => {
  if (!requireAdmin(req, res)) return;
  gameState.paused = false;
  broadcast({ type: 'game_resumed', message: 'GAME ON! START FLIPPING!' });
  console.log(`[ADMIN] Game STARTED (Round ${gameState.round}, max ${gameState.maxPrizes} prizes)`);
  res.json({ status: 'started', round: gameState.round, maxPrizes: gameState.maxPrizes });
});

// Pause the game
app.post('/api/game/admin/pause', (req, res) => {
  if (!requireAdmin(req, res)) return;
  gameState.paused = true;
  broadcast({ type: 'game_paused', message: 'GAME PAUSED BY ADMIN' });
  console.log(`[ADMIN] Game PAUSED`);
  res.json({ status: 'paused' });
});

// Set round config
app.post('/api/game/admin/round', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { round, maxPrizes } = req.body;
  if (round) gameState.round = round;
  if (maxPrizes) gameState.maxPrizes = maxPrizes;
  console.log(`[ADMIN] Round set to ${gameState.round}, max prizes: ${gameState.maxPrizes}`);
  res.json({ round: gameState.round, maxPrizes: gameState.maxPrizes, prizesFound: gameState.prizesFound });
});

// Reset the game board (clear all flips, fresh start)
app.post('/api/game/admin/reset', (req, res) => {
  if (!requireAdmin(req, res)) return;
  gameState.paused = true;
  db.exec('DELETE FROM cards');
  db.exec('DELETE FROM flips');
  db.exec('DELETE FROM players');
  // Reload from game-data.json
  gameState.cards = {};
  gameState.prizesFound = 0;
  gameState.cardsBurned = 0;
  loadGameData();
  broadcast({ type: 'game_reset', message: 'BOARD RESET! NEW ROUND INCOMING...' });
  console.log(`[ADMIN] Game RESET — board reloaded`);
  res.json({ status: 'reset', totalCards: gameState.totalCards, totalPrizes: gameState.totalPrizes });
});

// Game status
app.get('/api/game/admin/status', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    paused: gameState.paused,
    round: gameState.round,
    maxPrizes: gameState.maxPrizes,
    prizesFound: gameState.prizesFound,
    cardsBurned: gameState.cardsBurned,
    cardsRemaining: gameState.totalCards - gameState.prizesFound - gameState.cardsBurned,
    playersOnline: Object.keys(gameState.players).length,
    lobbyCount: gameState.lobby.length,
    activePlayers: Object.entries(gameState.players).map(([addr, p]) => ({
      address: addr,
      short: addr.slice(0, 6) + '...' + addr.slice(-4),
      username: p.username,
      isHolder: p.isHolder,
    })),
    lobbyPlayers: gameState.lobby.map((l, i) => ({
      address: l.address,
      short: l.address.slice(0, 6) + '...' + l.address.slice(-4),
      username: l.username,
      position: i + 1,
    })),
  });
});

// Kick a player
app.post('/api/game/admin/kick', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });

  const addr = address.toLowerCase();
  const player = gameState.players[addr];
  if (player) {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({ type: 'kicked', message: 'YOU HAVE BEEN REMOVED BY ADMIN' }));
      player.ws.close();
    }
    delete gameState.players[addr];
    broadcast({ type: 'player_left', username: player.username, playerCount: Object.keys(gameState.players).length });
    console.log(`[ADMIN] Kicked ${player.username}`);
    promoteFromLobby();
    res.json({ status: 'kicked', username: player.username });
  } else {
    // Check lobby
    const idx = gameState.lobby.findIndex(l => l.address === addr);
    if (idx >= 0) {
      const removed = gameState.lobby.splice(idx, 1)[0];
      if (removed.ws && removed.ws.readyState === 1) {
        removed.ws.send(JSON.stringify({ type: 'kicked', message: 'YOU HAVE BEEN REMOVED BY ADMIN' }));
        removed.ws.close();
      }
      console.log(`[ADMIN] Removed ${removed.username} from lobby`);
      res.json({ status: 'removed from lobby', username: removed.username });
    } else {
      res.status(404).json({ error: 'Player not found' });
    }
  }
});

// Promote specific address from lobby to active
app.post('/api/game/admin/promote', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });

  const addr = address.toLowerCase();
  const idx = gameState.lobby.findIndex(l => l.address === addr);
  if (idx < 0) return res.status(404).json({ error: 'Not in lobby' });

  const player = gameState.lobby.splice(idx, 1)[0];
  gameState.players[player.address] = {
    username: player.username,
    cursor: { x: 0, y: 0 },
    lastFlip: 0,
    isHolder: player.isHolder,
    ws: player.ws,
  };
  db.prepare('INSERT OR REPLACE INTO players (address, username) VALUES (?, ?)').run(player.address, player.username);

  if (player.ws && player.ws.readyState === 1) {
    player.ws.send(JSON.stringify({ type: 'promoted', message: 'YOUR TURN! START FLIPPING!' }));
  }
  broadcast({ type: 'player_joined', username: player.username, playerCount: Object.keys(gameState.players).length });
  broadcastCounts();
  console.log(`[ADMIN] Promoted ${player.username} from lobby`);
  res.json({ status: 'promoted', username: player.username });
});

// Leaderboard
app.get('/api/game/leaderboard', (req, res) => {
  const leaders = db.prepare('SELECT address, username, wins, burns FROM players ORDER BY wins DESC LIMIT 20').all();
  res.json(leaders.map(l => ({
    ...l,
    address: l.address.slice(0, 6) + '...' + l.address.slice(-4),
  })));
});

// ─── WebSocket Server ───────────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === 1) {
      client.send(msg);
    }
  });
}

function broadcastCounts() {
  broadcast({
    type: 'counts',
    players: Object.keys(gameState.players).length,
    lobby: gameState.lobby.length,
    spectators: wss.clients.size - Object.keys(gameState.players).length,
  });
}

// Promote next lobby player to active
function promoteFromLobby() {
  while (gameState.lobby.length > 0 && Object.keys(gameState.players).length < gameState.maxActivePlayers) {
    const next = gameState.lobby.shift();
    if (next.ws.readyState !== 1) continue; // skip disconnected

    gameState.players[next.address] = {
      username: next.username,
      cursor: { x: 0, y: 0 },
      lastFlip: 0,
      isHolder: next.isHolder,
      ws: next.ws,
    };
    db.prepare('INSERT OR REPLACE INTO players (address, username) VALUES (?, ?)').run(next.address, next.username);

    next.ws.send(JSON.stringify({ type: 'promoted', message: 'YOUR TURN! START FLIPPING!' }));
    broadcast({ type: 'player_joined', username: next.username, playerCount: Object.keys(gameState.players).length, lobbyCount: gameState.lobby.length });
    console.log(`[PROMOTED] ${next.username} from lobby`);

    // Notify remaining lobby of new positions
    gameState.lobby.forEach((l, i) => {
      if (l.ws.readyState === 1) {
        l.ws.send(JSON.stringify({ type: 'lobby_update', position: i + 1, lobbySize: gameState.lobby.length }));
      }
    });
  }
  broadcastCounts();
}

wss.on('connection', (ws) => {
  let playerAddress = null;
  let playerUsername = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        playerAddress = msg.address?.toLowerCase();
        playerUsername = msg.username || playerAddress?.slice(0, 8);

        if (!playerAddress) return;

        // Check ownership (cached for 5 min)
        const cacheKey = `bal_${playerAddress}`;
        let isHolder = verifyCache[cacheKey];
        if (isHolder === undefined) {
          try {
            const balance = await readContract.balanceOf(playerAddress);
            isHolder = Number(balance) > 0;
            verifyCache[cacheKey] = isHolder;
            setTimeout(() => delete verifyCache[cacheKey], 5 * 60 * 1000);
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Could not verify wallet' }));
            return;
          }
        }

        // Holders only
        if (!isHolder && !ADMIN_WALLETS.includes(playerAddress)) {
          ws.send(JSON.stringify({ type: 'error', message: 'YOU NEED BREADIO TO PLAY' }));
          return;
        }

        // Build board state (sent to everyone)
        const boardState = {};
        for (const [id, card] of Object.entries(gameState.cards)) {
          boardState[id] = {
            status: card.status,
            isPrize: card.status !== 'face_down' ? card.isPrize : undefined,
            flippedBy: card.flippedBy,
          };
        }
        const boardMsg = {
          type: 'board',
          cards: boardState,
          stats: {
            totalCards: gameState.totalCards,
            totalPrizes: gameState.maxPrizes,
            prizesFound: gameState.prizesFound,
            cardsBurned: gameState.cardsBurned,
            round: gameState.round,
          },
        };

        // Already an active player — just update WS
        if (gameState.players[playerAddress]) {
          gameState.players[playerAddress].ws = ws;
          ws.send(JSON.stringify({ ...boardMsg, role: 'player' }));
          console.log(`[REJOIN] ${playerUsername}`);
          break;
        }

        const isAdmin = ADMIN_WALLETS.includes(playerAddress);
        const activeCount = Object.keys(gameState.players).length;

        // Try to join as active player
        if (activeCount < gameState.maxActivePlayers || isAdmin) {
          gameState.players[playerAddress] = {
            username: playerUsername,
            cursor: { x: 0, y: 0 },
            lastFlip: 0,
            isHolder,
            ws,
          };
          db.prepare('INSERT OR REPLACE INTO players (address, username) VALUES (?, ?)').run(playerAddress, playerUsername);
          ws.send(JSON.stringify({ ...boardMsg, role: 'player' }));

          broadcast({
            type: 'player_joined',
            username: playerUsername,
            playerCount: Object.keys(gameState.players).length,
            lobbyCount: gameState.lobby.length,
          }, ws);

          console.log(`[JOIN] ${playerUsername} (${isHolder ? 'holder' : 'non-holder'})`);
        } else {
          // Check if already in lobby
          const inLobby = gameState.lobby.find(l => l.address === playerAddress);
          if (!inLobby) {
            gameState.lobby.push({ address: playerAddress, username: playerUsername, isHolder, ws });
            console.log(`[LOBBY] ${playerUsername} — position ${gameState.lobby.length}`);
          } else {
            inLobby.ws = ws;
          }

          const pos = gameState.lobby.findIndex(l => l.address === playerAddress) + 1;
          ws.send(JSON.stringify({ ...boardMsg, role: 'spectator', lobbyPosition: pos, lobbySize: gameState.lobby.length }));
        }

        // Send spectator/lobby counts to everyone
        broadcastCounts();
        break;
      }

      case 'cursor': {
        if (!playerAddress || !gameState.players[playerAddress]) return;
        const p = gameState.players[playerAddress];
        const cursorNow = Date.now();
        if (p.lastCursor && cursorNow - p.lastCursor < 100) return; // throttle to 10/sec
        p.lastCursor = cursorNow;
        p.cursor = { x: msg.x, y: msg.y };
        broadcast({
          type: 'cursor',
          address: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
          username: playerUsername,
          x: msg.x,
          y: msg.y,
        }, ws);
        break;
      }

      case 'flip': {
        if (!playerAddress || !gameState.players[playerAddress]) return;

        // Check if game is paused
        if (gameState.paused) {
          ws.send(JSON.stringify({ type: 'error', message: 'GAME IS PAUSED' }));
          return;
        }

        // Check if round prize cap reached
        if (gameState.prizesFound >= gameState.maxPrizes) {
          ws.send(JSON.stringify({ type: 'error', message: 'ROUND OVER! ALL PRIZES FOUND' }));
          return;
        }

        const tokenId = msg.tokenId;
        const card = gameState.cards[tokenId];

        // Validate
        if (!card) {
          ws.send(JSON.stringify({ type: 'error', message: 'Card not found' }));
          return;
        }
        if (card.status !== 'face_down') {
          ws.send(JSON.stringify({ type: 'error', message: 'Already flipped' }));
          return;
        }

        // Tiered win cap — holders: 2, non-holders: 1, admins: unlimited
        const player = gameState.players[playerAddress];
        if (!ADMIN_WALLETS.includes(playerAddress)) {
          const maxWins = player.isHolder ? 2 : 1;
          const playerRow = db.prepare('SELECT wins FROM players WHERE address = ?').get(playerAddress);
          if (playerRow && playerRow.wins >= maxWins) {
            ws.send(JSON.stringify({ type: 'error', message: player.isHolder
              ? `YOU WON ${maxWins} ALREADY! LET OTHERS PLAY`
              : `NON-HOLDERS GET 1 WIN. GET BREAD FOR MORE!` }));
            return;
          }
        }

        // Tiered cooldown — holders: 5s, non-holders: 30s, admins: 5s
        const playerCooldown = player.isHolder || ADMIN_WALLETS.includes(playerAddress) ? 5000 : 30000;
        const now = Date.now();
        const lastFlip = player.lastFlip || 0;
        if (now - lastFlip < playerCooldown) {
          const wait = Math.ceil((playerCooldown - (now - lastFlip)) / 1000);
          ws.send(JSON.stringify({ type: 'error', message: `Wait ${wait}s` }));
          return;
        }
        gameState.players[playerAddress].lastFlip = now;

        // Mark as flipping (prevent double-flips)
        card.status = 'flipping';

        // Broadcast flip start to everyone
        broadcast({
          type: 'flip_start',
          tokenId,
          player: playerUsername,
          playerAddress: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
        });

        // Determine result and update game state IMMEDIATELY (no await)
        const result = card.isPrize ? 'prize' : 'burn';
        const nonce = getNextNonce();

        card.status = result;
        card.flippedBy = playerUsername;

        if (card.isPrize) {
          gameState.prizesFound++;
          db.prepare('UPDATE players SET wins = wins + 1 WHERE address = ?').run(playerAddress);
        } else {
          gameState.cardsBurned++;
          db.prepare('UPDATE players SET burns = burns + 1 WHERE address = ?').run(playerAddress);
        }

        // Broadcast result to everyone INSTANTLY — before chain tx
        broadcast({
          type: 'flip_result',
          tokenId,
          result,
          player: playerUsername,
          playerAddress: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
          txHash: null,
          stats: {
            prizesFound: gameState.prizesFound,
            cardsBurned: gameState.cardsBurned,
            cardsRemaining: gameState.totalCards - gameState.prizesFound - gameState.cardsBurned,
            totalPrizes: gameState.maxPrizes,
            round: gameState.round,
          },
        });

        // Check if round over
        if (gameState.prizesFound >= gameState.maxPrizes) {
          gameState.paused = true;
          broadcast({ type: 'round_over', message: `ROUND ${gameState.round} COMPLETE! ${gameState.maxPrizes} PRIZES FOUND!`, round: gameState.round });
          console.log(`[ROUND] Round ${gameState.round} complete — ${gameState.maxPrizes} prizes found`);
        }

        // Fire on-chain tx in background — sign locally, send via sync RPC
        (async () => {
          try {
            // Build and sign the tx locally
            let txData;
            const iface = new ethers.Interface(ABI);
            if (result === 'prize') {
              console.log(`[PRIZE] #${tokenId} → ${playerUsername} (nonce: ${nonce})`);
              txData = iface.encodeFunctionData('transferFrom', [wallet.address, playerAddress, tokenId]);
            } else {
              console.log(`[BURN] #${tokenId} 🔥 (nonce: ${nonce})`);
              txData = iface.encodeFunctionData('burn', [tokenId]);
            }

            const txReq = {
              to: CONTRACT,
              data: txData,
              gasLimit: 200000,
              nonce,
              chainId: 4326,
              maxFeePerGas: ethers.parseUnits('0.001', 'gwei'),
              maxPriorityFeePerGas: 0,
              type: 2,
            };
            const signedTx = await wallet.signTransaction(txReq);

            // Try MegaETH sync method first (instant receipt)
            const receipt = await sendRawSync(signedTx);
            if (receipt && receipt.transactionHash) {
              const txHash = receipt.transactionHash;
              db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ?').run(txHash, tokenId);
              db.prepare('INSERT INTO flips (token_id, player_address, result, tx_hash) VALUES (?, ?, ?, ?)')
                .run(tokenId, playerAddress, result, txHash);
              console.log(`[${result.toUpperCase()}] ✅ #${tokenId} confirmed instantly: ${txHash}`);
            } else {
              // Fallback: send via ethers (normal async)
              const txResponse = await httpProvider.broadcastTransaction(signedTx);
              db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ?').run(txResponse.hash, tokenId);
              db.prepare('INSERT INTO flips (token_id, player_address, result, tx_hash) VALUES (?, ?, ?, ?)')
                .run(tokenId, playerAddress, result, txResponse.hash);
              console.log(`[${result.toUpperCase()}] 📤 #${tokenId} sent: ${txResponse.hash}`);
            }
          } catch (err) {
            console.error(`[ERROR] Flip #${tokenId} tx failed:`, err.message.slice(0, 100));
            // Card already shows as flipped — log the failure but don't revert UI
          }
        })();

        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerAddress) {
      if (gameState.players[playerAddress]) {
        delete gameState.players[playerAddress];
        broadcast({
          type: 'player_left',
          username: playerUsername,
          playerCount: Object.keys(gameState.players).length,
        });
        console.log(`[LEAVE] ${playerUsername}`);
        // Promote next from lobby
        promoteFromLobby();
      }
      // Remove from lobby if there
      gameState.lobby = gameState.lobby.filter(l => l.address !== playerAddress);
      broadcastCounts();
    }
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

loadGameData();
initNonce();
warmUpRpc();

server.listen(PORT, () => {
  console.log(`\n🍞 TOAST OR FINE BOOTY`);
  console.log(`========================`);
  console.log(`Server: http://0.0.0.0:${PORT}`);
  console.log(`WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`Cards: ${gameState.totalCards} (${gameState.totalPrizes} prizes)`);
  console.log(`Signer: ${wallet.address}`);
  console.log(`Contract: ${CONTRACT}`);
  console.log(`========================\n`);
});

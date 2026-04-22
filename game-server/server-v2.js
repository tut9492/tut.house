/**
 * Toast or Fine Booty — Game Server v2
 *
 * Multi-room architecture:
 * - Breadio Room: holders only, 5s cooldown, 2 wins max
 * - Public Room: anyone, 30s cooldown, 1 win max
 *
 * Fixes from v1:
 * - Separate RPCs for reads vs writes
 * - Localhost admin (no auth needed from 127.0.0.1)
 * - DB-first state (survives restarts)
 * - Tx queue with backpressure (max 3 concurrent)
 * - 30 min verify cache
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
const WRITE_RPC = 'https://mainnet.megaeth.com/rpc';
const READ_RPC = 'https://megaeth.drpc.org';
const SIGNER_KEY = process.env.BREADIO_PRIVATE_KEY;
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
const adminTokens = new Set();

if (!SIGNER_KEY) { console.error('BREADIO_PRIVATE_KEY not set'); process.exit(1); }

// ─── Blockchain Setup ───────────────────────────────────────────────────────

const writeProvider = new ethers.JsonRpcProvider(WRITE_RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
});
const readProvider = new ethers.JsonRpcProvider(READ_RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
});
const wallet = new ethers.Wallet(SIGNER_KEY, writeProvider);
const ABI = [
  'function burn(uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];
const contract = new ethers.Contract(CONTRACT, ABI, wallet);
const readContract = new ethers.Contract(CONTRACT, ABI, readProvider);

console.log('Signer wallet:', wallet.address);

// ─── Nonce Manager ──────────────────────────────────────────────────────────

let currentNonce = null;

async function initNonce() {
  currentNonce = await writeProvider.getTransactionCount(wallet.address, 'pending');
  console.log('Initial nonce:', currentNonce);
}

function getNextNonce() {
  const n = currentNonce;
  currentNonce++;
  return n;
}

setInterval(async () => {
  try {
    const cn = await writeProvider.getTransactionCount(wallet.address, 'pending');
    if (cn > currentNonce) currentNonce = cn;
  } catch {}
}, 10000);

// ─── Tx Queue with backpressure ─────────────────────────────────────────────

const MAX_CONCURRENT_TX = 1; // serial to prevent nonce collisions
let activeTxCount = 0;
const txQueue = [];

function enqueueTx(fn) {
  return new Promise((resolve, reject) => {
    txQueue.push({ fn, resolve, reject });
    drainTxQueue();
  });
}

async function drainTxQueue() {
  while (txQueue.length > 0 && activeTxCount < MAX_CONCURRENT_TX) {
    const { fn, resolve, reject } = txQueue.shift();
    activeTxCount++;
    fn().then(resolve).catch(reject).finally(() => {
      activeTxCount--;
      drainTxQueue();
    });
  }
}

// ─── Database ───────────────────────────────────────────────────────────────

const db = new Database(path.join(__dirname, 'game.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    token_id INTEGER PRIMARY KEY,
    room TEXT NOT NULL,
    is_prize INTEGER DEFAULT 0,
    is_real_burn INTEGER DEFAULT 0,
    status TEXT DEFAULT 'face_down',
    flipped_by TEXT,
    flipped_by_username TEXT,
    flipped_at TEXT,
    tx_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS players (
    address TEXT NOT NULL,
    room TEXT NOT NULL,
    username TEXT,
    wins INTEGER DEFAULT 0,
    burns INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (address, room)
  );
  CREATE TABLE IF NOT EXISTS flips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER,
    room TEXT,
    player_address TEXT,
    player_username TEXT,
    result TEXT,
    tx_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Whitelist ──────────────────────────────────────────────────────────────
const WHITELIST = new Set(
  (process.env.WHITELIST_WALLETS || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
);

// ─── Room System ────────────────────────────────────────────────────────────

const ROOM_CONFIG = {
  breadio: {
    name: 'BREADIO ROOM 1',
    requiresHolding: true,
    cooldown: 5000,
    maxWins: 2,
    maxPlayers: 10,
    maxPrizes: 5,

  },
  breadio2: {
    name: 'BREADIO ROOM 2',
    requiresHolding: true,
    cooldown: 5000,
    maxWins: 2,
    maxPlayers: 10,
    maxPrizes: 5,

  },
  breadio3: {
    name: 'BREADIO ROOM 3',
    requiresHolding: true,
    cooldown: 5000,
    maxWins: 2,
    maxPlayers: 10,
    maxPrizes: 5,

  },
  test: {
    name: 'BREADIO ROOM 4',
    requiresHolding: true,
    cooldown: 5000,
    maxWins: 2,
    maxPlayers: 10,
    maxPrizes: 5,

  },
  vip: {
    name: 'SPECIAL ROOM — WL ONLY',
    requiresHolding: false,
    requiresWhitelist: true,
    cooldown: 5000,
    maxWins: 2,
    maxPlayers: 10,
    maxPrizes: 5,

  },
};

// Per-room game state
const rooms = {};

function initRoom(roomId) {
  const config = ROOM_CONFIG[roomId];
  rooms[roomId] = {
    id: roomId,
    config,
    cards: {},
    players: {},
    lobby: [],
    totalCards: 0,
    prizesFound: 0,
    cardsBurned: 0,
    paused: true,
    round: 1,
  };
}

function loadRoomData(roomId) {
  const dataFile = path.join(__dirname, `game-data-${roomId}.json`);
  if (!fs.existsSync(dataFile)) {
    console.log(`[${roomId}] No game-data file, skipping`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const room = rooms[roomId];
  const prizeSet = new Set(data.prizes);
  const realBurnSet = new Set(data.realBurns || []);
  const allCards = [...data.prizes, ...(data.realBurns || []), ...data.burns];

  // Init DB for this room if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM cards WHERE room = ?').get(roomId).c;
  if (count === 0) {
    console.log(`[${roomId}] Initializing board...`);
    const insert = db.prepare('INSERT OR IGNORE INTO cards (token_id, room, is_prize, is_real_burn) VALUES (?, ?, ?, ?)');
    const tx = db.transaction(() => {
      for (const id of allCards) {
        insert.run(id, roomId, prizeSet.has(id) ? 1 : 0, realBurnSet.has(id) ? 1 : 0);
      }
    });
    tx();
    console.log(`[${roomId}] Loaded ${allCards.length} cards (${data.prizes.length} prizes, ${(data.realBurns || []).length} real burns)`);
  }

  // Override maxPrizes from actual game data
  room.config.maxPrizes = data.prizes.length;

  // Load into memory
  const rows = db.prepare('SELECT * FROM cards WHERE room = ?').all(roomId);
  for (const row of rows) {
    room.cards[row.token_id] = {
      status: row.status,
      isPrize: row.is_prize === 1,
      isRealBurn: row.is_real_burn === 1,
      flippedBy: row.flipped_by_username || row.flipped_by,
    };
  }
  room.totalCards = rows.length;
  room.prizesFound = rows.filter(r => r.is_prize && r.status !== 'face_down').length;
  room.cardsBurned = rows.filter(r => !r.is_prize && r.status !== 'face_down').length;
}

// Init all rooms
Object.keys(ROOM_CONFIG).forEach(id => {
  initRoom(id);
  loadRoomData(id);
});

// ─── Caches ─────────────────────────────────────────────────────────────────

const imageCache = {};
const verifyCache = {};

async function checkHolder(address) {
  const key = address.toLowerCase();
  if (verifyCache[key] !== undefined) return verifyCache[key];
  try {
    const balance = await readContract.balanceOf(address);
    const holds = Number(balance) > 0;
    verifyCache[key] = holds;
    setTimeout(() => delete verifyCache[key], 30 * 60 * 1000); // 30 min cache
    return holds;
  } catch {
    return null; // unknown
  }
}

// ─── Express Server ─────────────────────────────────────────────────────────

const app = express();
app.use(cors({
  origin: ['https://tuthouse.vercel.app', 'https://tut.house', 'https://www.tut.house', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Room list
app.get('/api/game/rooms', (req, res) => {
  const roomList = Object.entries(rooms).map(([id, room]) => ({
    id,
    name: room.config.name,
    requiresHolding: room.config.requiresHolding,
    requiresWhitelist: room.config.requiresWhitelist || false,
    players: Object.keys(room.players).length,
    maxPlayers: room.config.maxPlayers,
    lobby: room.lobby.length,
    paused: room.paused,
    prizesFound: room.prizesFound,
    maxPrizes: room.config.maxPrizes,
    cardsBurned: room.cardsBurned,
    cardsRemaining: room.totalCards - room.prizesFound - room.cardsBurned,
  }));
  res.json(roomList);
});

// Verify wallet
app.post('/api/game/verify', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  const holds = await checkHolder(address);
  if (holds === null) return res.status(500).json({ error: 'Verification failed' });
  res.json({ owns: holds });
});

// NFT image (cached)
app.get('/api/game/nft/:tokenId', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId)) return res.status(400).json({ error: 'Invalid token ID' });
  if (imageCache[tokenId]) return res.json(imageCache[tokenId]);
  try {
    const uri = await readContract.tokenURI(tokenId);
    const b64Idx = uri.indexOf('base64,');
    if (b64Idx >= 0) {
      const json = JSON.parse(Buffer.from(uri.slice(b64Idx + 7), 'base64').toString());
      const result = { image: json.image || '', name: json.name || '#' + tokenId };
      imageCache[tokenId] = result;
      res.json(result);
    } else {
      res.json({ image: '', name: '#' + tokenId });
    }
  } catch { res.json({ image: '', name: '#' + tokenId }); }
});

// ─── Admin (localhost bypass + token auth) ────────────────────────────────

function isLocalhost(req) {
  const ip = req.ip || req.connection.remoteAddress;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function requireAdmin(req, res) {
  if (isLocalhost(req)) return true;
  const auth = req.headers.authorization;
  const token = auth?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    res.status(403).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.post('/api/game/admin/auth', (req, res) => {
  const { address, message, signature } = req.body;
  if (!address || !message || !signature) return res.status(400).json({ error: 'Missing fields' });
  try {
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== address.toLowerCase() || !ADMIN_WALLETS.includes(recovered)) {
      return res.status(403).json({ error: 'Not an admin wallet' });
    }
    const token = ethers.hexlify(ethers.randomBytes(32));
    adminTokens.add(token);
    setTimeout(() => adminTokens.delete(token), 24 * 60 * 60 * 1000);
    console.log('[ADMIN] Authenticated:', address.slice(0, 10));
    res.json({ token });
  } catch { res.status(400).json({ error: 'Invalid signature' }); }
});

// Round timer config
const ROUND_DURATION = 30; // seconds
const roundTimers = {};
const countdownIntervals = {};

function startCountdown(roomId) {
  let remaining = ROUND_DURATION;
  broadcastToRoom(roomId, { type: 'timer', seconds: remaining });

  countdownIntervals[roomId] = setInterval(() => {
    remaining--;
    broadcastToRoom(roomId, { type: 'timer', seconds: remaining });
    if (remaining <= 0) {
      clearInterval(countdownIntervals[roomId]);
      delete countdownIntervals[roomId];
      endRound(roomId);
    }
  }, 1000);
}

function stopCountdown(roomId) {
  if (countdownIntervals[roomId]) { clearInterval(countdownIntervals[roomId]); delete countdownIntervals[roomId]; }
  if (roundTimers[roomId]) { clearTimeout(roundTimers[roomId]); delete roundTimers[roomId]; }
}

function endRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.paused = true;
  stopCountdown(roomId);

  // Broadcast GAME OVER
  broadcastToRoom(roomId, { type: 'game_over', message: 'GAME OVER!' });

  // Kick all active players — sent to GAME OVER, must re-join from rooms
  const kicked = [];
  for (const [addr, p] of Object.entries(room.players)) {
    if (p.ws?.readyState === 1) {
      p.ws.send(JSON.stringify({ type: 'game_over', message: 'GAME OVER!' }));
    }
    kicked.push(p.username);
    delete room.players[addr];
  }

  // Promote lobby players into the now-empty slots
  promoteFromLobby(roomId);

  console.log(`[${roomId}] GAME OVER — kicked: ${kicked.join(', ')}, lobby promoted: ${Object.keys(room.players).length}`);
}

// Admin actions take a room parameter
app.post('/api/game/admin/start', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const roomId = req.body?.room || req.query?.room || 'breadio';
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  room.paused = false;
  stopCountdown(roomId);
  startCountdown(roomId);

  broadcastToRoom(roomId, { type: 'game_resumed', message: 'GAME ON! 30 SECONDS — GO!' });
  console.log(`[ADMIN] ${roomId} STARTED (${ROUND_DURATION}s timer)`);
  res.json({ status: 'started', room: roomId, timer: ROUND_DURATION });
});

app.post('/api/game/admin/pause', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const roomId = req.body?.room || req.query?.room || 'breadio';
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  room.paused = true;
  stopCountdown(roomId);
  broadcastToRoom(roomId, { type: 'game_paused', message: 'GAME PAUSED' });
  console.log(`[ADMIN] ${roomId} PAUSED`);
  res.json({ status: 'paused', room: roomId });
});

// Start/pause all rooms
app.post('/api/game/admin/startall', (req, res) => {
  if (!requireAdmin(req, res)) return;
  Object.entries(rooms).forEach(([id, room]) => {
    room.paused = false;
    stopCountdown(id);
    startCountdown(id);
    broadcastToRoom(id, { type: 'game_resumed', message: 'GAME ON! 30 SECONDS — GO!' });
  });
  console.log(`[ADMIN] ALL ROOMS STARTED (${ROUND_DURATION}s timers)`);
  res.json({ status: 'all started', timer: ROUND_DURATION });
});

app.post('/api/game/admin/pauseall', (req, res) => {
  if (!requireAdmin(req, res)) return;
  Object.entries(rooms).forEach(([id, room]) => {
    room.paused = true;
    stopCountdown(id);
    broadcastToRoom(id, { type: 'game_paused', message: 'GAME PAUSED' });
  });
  console.log('[ADMIN] ALL ROOMS PAUSED');
  res.json({ status: 'all paused' });
});

app.get('/api/game/admin/status', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = Object.entries(rooms).map(([id, room]) => ({
    room: id,
    paused: room.paused,
    players: Object.keys(room.players).length,
    lobby: room.lobby.length,
    prizesFound: room.prizesFound,
    maxPrizes: room.config.maxPrizes,
    cardsBurned: room.cardsBurned,
    cardsRemaining: room.totalCards - room.prizesFound - room.cardsBurned,
    activePlayers: Object.entries(room.players).map(([addr, p]) => ({
      address: addr, short: addr.slice(0, 6) + '...' + addr.slice(-4),
      username: p.username, isHolder: p.isHolder,
    })),
    lobbyPlayers: room.lobby.map(l => ({
      address: l.address, short: l.address.slice(0, 6) + '...' + l.address.slice(-4),
      username: l.username,
    })),
  }));
  res.json(status);
});

app.post('/api/game/admin/kick', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { address, room: roomId } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  const rId = roomId || 'breadio';
  const room = rooms[rId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const addr = address.toLowerCase();
  const player = room.players[addr];
  if (player) {
    if (player.ws?.readyState === 1) {
      player.ws.send(JSON.stringify({ type: 'kicked', message: 'REMOVED BY ADMIN' }));
      player.ws.close();
    }
    delete room.players[addr];
    broadcastToRoom(rId, { type: 'player_left', username: player.username });
    promoteFromLobby(rId);
    res.json({ status: 'kicked', username: player.username });
  } else {
    res.status(404).json({ error: 'Player not found in room' });
  }
});

// Leaderboard
app.get('/api/game/leaderboard', (req, res) => {
  const roomId = req.query.room || 'breadio';
  const leaders = db.prepare('SELECT address, username, wins, burns FROM players WHERE room = ? ORDER BY wins DESC LIMIT 20').all(roomId);
  res.json(leaders.map(l => ({
    ...l, address: l.address.slice(0, 6) + '...' + l.address.slice(-4),
  })));
});

// ─── WebSocket Server ───────────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcastToRoom(roomId, data, exclude) {
  const room = rooms[roomId];
  if (!room) return;
  const msg = JSON.stringify(data);
  // Send to active players
  Object.values(room.players).forEach(p => {
    if (p.ws !== exclude && p.ws?.readyState === 1) p.ws.send(msg);
  });
  // Send to lobby/spectators
  room.lobby.forEach(l => {
    if (l.ws !== exclude && l.ws?.readyState === 1) l.ws.send(msg);
  });
}

function broadcastRoomCounts(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  broadcastToRoom(roomId, {
    type: 'counts',
    players: Object.keys(room.players).length,
    lobby: room.lobby.length,
  });
}

function promoteFromLobby(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  while (room.lobby.length > 0 && Object.keys(room.players).length < room.config.maxPlayers) {
    const next = room.lobby.shift();
    if (next.ws?.readyState !== 1) continue;
    room.players[next.address] = {
      username: next.username, cursor: { x: 0, y: 0 },
      lastFlip: 0, isHolder: next.isHolder, ws: next.ws,
    };
    db.prepare('INSERT OR REPLACE INTO players (address, room, username) VALUES (?, ?, ?)').run(next.address, roomId, next.username);
    next.ws.send(JSON.stringify({ type: 'promoted', message: 'YOUR TURN! START FLIPPING!' }));
    broadcastToRoom(roomId, { type: 'player_joined', username: next.username });
    console.log(`[${roomId}] PROMOTED ${next.username}`);
    room.lobby.forEach((l, i) => {
      if (l.ws?.readyState === 1) l.ws.send(JSON.stringify({ type: 'lobby_update', position: i + 1 }));
    });
  }
  broadcastRoomCounts(roomId);
}

function buildBoardMsg(roomId) {
  const room = rooms[roomId];
  const boardState = {};
  for (const [id, card] of Object.entries(room.cards)) {
    boardState[id] = {
      status: card.status,
      isPrize: card.status !== 'face_down' ? card.isPrize : undefined,
      flippedBy: card.flippedBy,
    };
  }
  return {
    type: 'board',
    room: roomId,
    roomName: room.config.name,
    cards: boardState,
    stats: {
      totalCards: room.totalCards,
      totalPrizes: room.config.maxPrizes,
      prizesFound: room.prizesFound,
      cardsBurned: room.cardsBurned,
      round: room.round,
    },
  };
}

wss.on('connection', (ws) => {
  let playerAddress = null;
  let playerUsername = null;
  let playerRoom = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        playerAddress = msg.address?.toLowerCase();
        playerUsername = msg.username || playerAddress?.slice(0, 8);

        if (!playerAddress) return;

        // Check holder status
        const isHolder = await checkHolder(playerAddress);
        if (isHolder === null) { ws.send(JSON.stringify({ type: 'error', message: 'Could not verify wallet' })); return; }
        const isAdmin = ADMIN_WALLETS.includes(playerAddress);

        // Use room from client, validate access
        const roomId = msg.room || 'breadio';
        if (!rooms[roomId]) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }

        // Check holder requirement
        if (rooms[roomId].config.requiresHolding && !isHolder && !isAdmin) {
          ws.send(JSON.stringify({ type: 'error', message: 'YOU NEED BREADIO FOR THIS ROOM' })); return;
        }

        // Check whitelist requirement
        if (rooms[roomId].config.requiresWhitelist && !WHITELIST.has(playerAddress.toLowerCase()) && !isAdmin) {
          ws.send(JSON.stringify({ type: 'error', message: 'INVITE ONLY' })); return;
        }

        playerRoom = roomId;
        const room = rooms[roomId];

        const boardMsg = buildBoardMsg(roomId);

        // Already active?
        if (room.players[playerAddress]) {
          room.players[playerAddress].ws = ws;
          ws.send(JSON.stringify({ ...boardMsg, role: 'player' }));
          console.log(`[${roomId}] REJOIN ${playerUsername}`);
          break;
        }

        const activeCount = Object.keys(room.players).length;

        if (activeCount < room.config.maxPlayers || isAdmin) {
          room.players[playerAddress] = {
            username: playerUsername, cursor: { x: 0, y: 0 },
            lastFlip: 0, isHolder, ws,
          };
          db.prepare('INSERT OR REPLACE INTO players (address, room, username) VALUES (?, ?, ?)').run(playerAddress, roomId, playerUsername);
          ws.send(JSON.stringify({ ...boardMsg, role: 'player' }));
          broadcastToRoom(roomId, { type: 'player_joined', username: playerUsername }, ws);
          console.log(`[${roomId}] JOIN ${playerUsername} (${isHolder ? 'holder' : 'non-holder'})`);
        } else {
          const inLobby = room.lobby.find(l => l.address === playerAddress);
          if (!inLobby) {
            room.lobby.push({ address: playerAddress, username: playerUsername, isHolder, ws });
            console.log(`[${roomId}] LOBBY ${playerUsername} — #${room.lobby.length}`);
          } else { inLobby.ws = ws; }
          const pos = room.lobby.findIndex(l => l.address === playerAddress) + 1;
          ws.send(JSON.stringify({ ...boardMsg, role: 'spectator', lobbyPosition: pos }));
        }
        broadcastRoomCounts(roomId);
        break;
      }

      case 'cursor': {
        if (!playerAddress || !playerRoom) return;
        const room = rooms[playerRoom];
        if (!room?.players[playerAddress]) return;
        const p = room.players[playerAddress];
        const now = Date.now();
        if (p.lastCursor && now - p.lastCursor < 100) return;
        p.lastCursor = now;
        p.cursor = { x: msg.x, y: msg.y };
        broadcastToRoom(playerRoom, {
          type: 'cursor',
          address: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
          username: playerUsername, x: msg.x, y: msg.y,
        }, ws);
        break;
      }

      case 'flip': {
        if (!playerAddress || !playerRoom) return;
        const room = rooms[playerRoom];
        if (!room?.players[playerAddress]) return;

        if (room.paused) { ws.send(JSON.stringify({ type: 'error', message: 'GAME IS PAUSED' })); return; }
        if (room.prizesFound >= room.config.maxPrizes) { ws.send(JSON.stringify({ type: 'error', message: 'ROUND OVER!' })); return; }

        const tokenId = msg.tokenId;
        const card = room.cards[tokenId];
        if (!card) { ws.send(JSON.stringify({ type: 'error', message: 'Card not found' })); return; }
        if (card.status !== 'face_down') { ws.send(JSON.stringify({ type: 'error', message: 'Already flipped' })); return; }

        // Win cap
        const player = room.players[playerAddress];
        if (!ADMIN_WALLETS.includes(playerAddress)) {
          const maxWins = room.config.maxWins;
          const row = db.prepare('SELECT wins FROM players WHERE address = ? AND room = ?').get(playerAddress, playerRoom);
          if (row && row.wins >= maxWins) {
            ws.send(JSON.stringify({ type: 'error', message: `YOU WON ${maxWins} ALREADY!` })); return;
          }
        }

        // Cooldown
        const cooldown = ADMIN_WALLETS.includes(playerAddress) ? 5000 : room.config.cooldown;
        const now = Date.now();
        if (now - (player.lastFlip || 0) < cooldown) {
          const wait = Math.ceil((cooldown - (now - player.lastFlip)) / 1000);
          ws.send(JSON.stringify({ type: 'error', message: `Wait ${wait}s` })); return;
        }
        player.lastFlip = now;
        card.status = 'flipping';

        // Broadcast flip start
        broadcastToRoom(playerRoom, {
          type: 'flip_start', tokenId, player: playerUsername,
          playerAddress: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
        });

        // Determine result, update DB immediately
        const result = card.isPrize ? 'prize' : 'burn';

        card.status = result;
        card.flippedBy = playerUsername;

        // DB updates (survive restarts)
        db.prepare('UPDATE cards SET status = ?, flipped_by = ?, flipped_by_username = ?, flipped_at = datetime(?) WHERE token_id = ? AND room = ?')
          .run(result, playerAddress, playerUsername, 'now', tokenId, playerRoom);

        if (card.isPrize) {
          room.prizesFound++;
          db.prepare('UPDATE players SET wins = wins + 1 WHERE address = ? AND room = ?').run(playerAddress, playerRoom);
        } else {
          room.cardsBurned++;
          db.prepare('UPDATE players SET burns = burns + 1 WHERE address = ? AND room = ?').run(playerAddress, playerRoom);
        }

        // Auto-kick if player hit win cap (after a prize)
        if (card.isPrize && !ADMIN_WALLETS.includes(playerAddress)) {
          const updatedRow = db.prepare('SELECT wins FROM players WHERE address = ? AND room = ?').get(playerAddress, playerRoom);
          if (updatedRow && updatedRow.wins >= room.config.maxWins) {
            // Delay kick slightly so the player sees their win animation
            setTimeout(() => {
              const p = room.players[playerAddress];
              if (p?.ws?.readyState === 1) {
                p.ws.send(JSON.stringify({ type: 'maxed_out', message: `YOU WON ${room.config.maxWins}! NICE BOOTY! MAKING ROOM FOR OTHERS...` }));
              }
              delete room.players[playerAddress];
              broadcastToRoom(playerRoom, { type: 'player_left', username: playerUsername });
              console.log(`[${playerRoom}] AUTO-KICK ${playerUsername} (hit ${room.config.maxWins} wins)`);
              promoteFromLobby(playerRoom);
            }, 3000);
          }
        }

        // Broadcast result instantly
        broadcastToRoom(playerRoom, {
          type: 'flip_result', tokenId, result, player: playerUsername,
          playerAddress: playerAddress.slice(0, 6) + '...' + playerAddress.slice(-4),
          stats: {
            prizesFound: room.prizesFound, cardsBurned: room.cardsBurned,
            cardsRemaining: room.totalCards - room.prizesFound - room.cardsBurned,
            totalPrizes: room.config.maxPrizes, round: room.round,
          },
        });

        // Round over?
        if (room.prizesFound >= room.config.maxPrizes) {
          room.paused = true;
          broadcastToRoom(playerRoom, { type: 'round_over', message: `ROUND ${room.round} COMPLETE!` });
          console.log(`[${playerRoom}] ROUND ${room.round} COMPLETE`);
        }

        // On-chain: ONLY for prizes. Burns are game-state only (no chain tx).
        if (result === 'prize') {
          const capturedAddress = playerAddress;
          const capturedRoom = playerRoom;
          const capturedUsername = playerUsername;
          enqueueTx(async () => {
            try {
              const nonce = getNextNonce();
              const iface = new ethers.Interface(ABI);
              const txData = iface.encodeFunctionData('transferFrom', [wallet.address, capturedAddress, tokenId]);
              console.log(`[${capturedRoom}] PRIZE #${tokenId} → ${capturedUsername} (nonce: ${nonce})`);

              const txReq = {
                to: CONTRACT, data: txData, gasLimit: 200000, nonce,
                chainId: 4326, maxFeePerGas: ethers.parseUnits('0.001', 'gwei'),
                maxPriorityFeePerGas: 0, type: 2,
              };
              const signedTx = await wallet.signTransaction(txReq);

              // Try sync first
              try {
                const syncRes = await fetch(WRITE_RPC, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_sendRawTransactionSync', params: [signedTx], id: Date.now() }),
                });
                const syncData = await syncRes.json();
                if (syncData.result?.transactionHash) {
                  db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ? AND room = ?').run(syncData.result.transactionHash, tokenId, capturedRoom);
                  db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result, tx_hash) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(tokenId, capturedRoom, capturedAddress, capturedUsername, result, syncData.result.transactionHash);
                  console.log(`[${capturedRoom}] ✅ #${tokenId} confirmed: ${syncData.result.transactionHash}`);
                  return;
                }
              } catch {}

              // Fallback
              const txResponse = await writeProvider.broadcastTransaction(signedTx);
              db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ? AND room = ?').run(txResponse.hash, tokenId, capturedRoom);
              db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result, tx_hash) VALUES (?, ?, ?, ?, ?, ?)')
                .run(tokenId, capturedRoom, capturedAddress, capturedUsername, result, txResponse.hash);
              console.log(`[${capturedRoom}] 📤 #${tokenId} sent: ${txResponse.hash}`);
            } catch (err) {
              console.error(`[${capturedRoom}] ERROR prize #${tokenId}: ${err.message.slice(0, 80)}`);
              db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result) VALUES (?, ?, ?, ?, ?)')
                .run(tokenId, capturedRoom, capturedAddress, capturedUsername, result);
            }
          });
        } else if (card.isRealBurn) {
          // Real burn: fire on-chain burn tx async
          const capturedRoom = playerRoom;
          const capturedAddress = playerAddress;
          const capturedUsername = playerUsername;
          enqueueTx(async () => {
            try {
              const iface = new ethers.Interface(ABI);
              const txData = iface.encodeFunctionData('burn', [tokenId]);
              const nonceBurn = getNextNonce();
              console.log(`[${capturedRoom}] 🔥 BURN #${tokenId} on-chain (nonce: ${nonceBurn})`);

              const txReq = {
                to: CONTRACT, data: txData, gasLimit: 200000, nonce: nonceBurn,
                chainId: 4326, maxFeePerGas: ethers.parseUnits('0.001', 'gwei'),
                maxPriorityFeePerGas: 0, type: 2,
              };
              const signedTx = await wallet.signTransaction(txReq);

              try {
                const syncRes = await fetch(WRITE_RPC, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_sendRawTransactionSync', params: [signedTx], id: Date.now() }),
                });
                const syncData = await syncRes.json();
                if (syncData.result?.transactionHash) {
                  db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ? AND room = ?').run(syncData.result.transactionHash, tokenId, capturedRoom);
                  db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result, tx_hash) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(tokenId, capturedRoom, capturedAddress, capturedUsername, 'burn', syncData.result.transactionHash);
                  console.log(`[${capturedRoom}] 🔥 #${tokenId} burned: ${syncData.result.transactionHash}`);
                  return;
                }
              } catch {}

              const txResponse = await writeProvider.broadcastTransaction(signedTx);
              db.prepare('UPDATE cards SET tx_hash = ? WHERE token_id = ? AND room = ?').run(txResponse.hash, tokenId, capturedRoom);
              db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result, tx_hash) VALUES (?, ?, ?, ?, ?, ?)')
                .run(tokenId, capturedRoom, capturedAddress, capturedUsername, 'burn', txResponse.hash);
              console.log(`[${capturedRoom}] 🔥 #${tokenId} sent: ${txResponse.hash}`);
            } catch (err) {
              console.error(`[${capturedRoom}] ERROR burn #${tokenId}: ${err.message.slice(0, 80)}`);
              db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result) VALUES (?, ?, ?, ?, ?)')
                .run(tokenId, capturedRoom, capturedAddress, capturedUsername, 'burn');
            }
          });
        } else {
          // Fake burns: game-state only, just log to DB
          db.prepare('INSERT INTO flips (token_id, room, player_address, player_username, result) VALUES (?, ?, ?, ?, ?)')
            .run(tokenId, playerRoom, playerAddress, playerUsername, result);
          console.log(`[${playerRoom}] BURN #${tokenId} (game-state only)`);
        }

        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerAddress && playerRoom) {
      const room = rooms[playerRoom];
      if (room?.players[playerAddress]) {
        delete room.players[playerAddress];
        broadcastToRoom(playerRoom, { type: 'player_left', username: playerUsername });
        console.log(`[${playerRoom}] LEAVE ${playerUsername}`);
        promoteFromLobby(playerRoom);
      }
      if (room) {
        room.lobby = room.lobby.filter(l => l.address !== playerAddress);
        broadcastRoomCounts(playerRoom);
      }
    }
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

initNonce();

server.listen(PORT, () => {
  console.log('\n🍞 TOAST OR FINE BOOTY v2');
  console.log('========================');
  console.log('Server: http://0.0.0.0:' + PORT);
  Object.entries(rooms).forEach(([id, room]) => {
    console.log(`Room: ${id} — ${room.totalCards} cards (${room.config.maxPrizes} prizes max)`);
  });
  console.log('Signer:', wallet.address);
  console.log('Write RPC:', WRITE_RPC);
  console.log('Read RPC:', READ_RPC);
  console.log('========================\n');
});

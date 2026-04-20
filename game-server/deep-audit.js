const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'game.db'));

console.log("=== FULL FLIPS TABLE (ALL SESSIONS) ===");
const allFlips = db.prepare("SELECT * FROM flips ORDER BY id").all();
console.log("Total flip records: " + allFlips.length);

console.log("\n=== ALL PRIZE FLIPS ===");
const prizeFlips = allFlips.filter(function(f) { return f.result === 'prize'; });
console.log("Prize flips: " + prizeFlips.length);
prizeFlips.forEach(function(f) {
  console.log("  id:" + f.id + " #" + f.token_id + " -> " + f.player_address + " | tx:" + (f.tx_hash || "NONE") + " | " + f.created_at);
});

console.log("\n=== ALL BURN FLIPS ===");
var burnFlips = allFlips.filter(function(f) { return f.result === 'burn'; });
console.log("Burn flips: " + burnFlips.length);
var withTx = burnFlips.filter(function(f) { return f.tx_hash; });
var noTx = burnFlips.filter(function(f) { return !f.tx_hash; });
console.log("  With tx hash: " + withTx.length);
console.log("  Without tx hash: " + noTx.length);

console.log("\n=== PLAYERS TABLE (current session) ===");
var players = db.prepare("SELECT * FROM players ORDER BY wins DESC, burns DESC").all();
players.forEach(function(p) {
  console.log(p.username + " | " + p.address + " | wins:" + p.wins + " burns:" + p.burns + " | joined:" + p.joined_at);
});

console.log("\n=== UNIQUE WINNERS (from flips table across all sessions) ===");
var winnerMap = {};
prizeFlips.forEach(function(f) {
  if (!winnerMap[f.player_address]) {
    winnerMap[f.player_address] = { address: f.player_address, wins: 0, tokens: [], txs: [] };
  }
  winnerMap[f.player_address].wins++;
  winnerMap[f.player_address].tokens.push(f.token_id);
  winnerMap[f.player_address].txs.push(f.tx_hash || "NONE");
});

// Also add wins from players table that might not be in flips
players.forEach(function(p) {
  if (p.wins > 0 && !winnerMap[p.address]) {
    winnerMap[p.address] = { address: p.address, wins: p.wins, tokens: [], txs: [], fromPlayerTable: true };
  } else if (p.wins > 0 && winnerMap[p.address]) {
    // Player table might have more wins than flips table
    if (p.wins > winnerMap[p.address].wins) {
      winnerMap[p.address].playerTableWins = p.wins;
      winnerMap[p.address].username = p.username;
    }
  }
  if (p.wins > 0 && winnerMap[p.address]) {
    winnerMap[p.address].username = winnerMap[p.address].username || p.username;
  }
});

var allWinners = Object.values(winnerMap);
allWinners.sort(function(a, b) { return b.wins - a.wins; });

var totalWinsToSend = 0;
allWinners.forEach(function(w) {
  var winsToUse = w.playerTableWins || w.wins;
  totalWinsToSend += winsToUse;
  console.log((w.username || "unknown") + " | " + w.address + " | wins:" + winsToUse + " | tokens:" + w.tokens.join(",") + " | txs:" + w.txs.join(",") + (w.fromPlayerTable ? " (PLAYER TABLE ONLY)" : ""));
});
console.log("\nTotal wins to fulfill: " + totalWinsToSend);

console.log("\n=== CARDS TABLE STATUS ===");
var faceDown = db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'face_down'").get();
var burned = db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'burn'").get();
var prized = db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'prize'").get();
var flipping = db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'flipping'").get();
var total = db.prepare("SELECT COUNT(*) as c FROM cards").get();
console.log("Total cards: " + total.c);
console.log("Face down: " + faceDown.c);
console.log("Burned: " + burned.c);
console.log("Prize: " + prized.c);
console.log("Flipping: " + flipping.c);

console.log("\n=== SQLITE TABLES ===");
var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(function(t) {
  var count = db.prepare("SELECT COUNT(*) as c FROM " + t.name).get();
  console.log(t.name + ": " + count.c + " rows");
});

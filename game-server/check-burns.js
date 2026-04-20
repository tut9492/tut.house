const Database = require('better-sqlite3');
const db = new Database(__dirname + '/game.db');

console.log("=== BURN STATS FROM FLIPS TABLE ===");
const burnFlips = db.prepare("SELECT COUNT(*) as c FROM flips WHERE result = 'burn'").get();
console.log("Burn flip records (with tx hash): " + burnFlips.c);

const allFlips = db.prepare("SELECT COUNT(*) as c FROM flips").get();
console.log("Total flip records: " + allFlips.c);

console.log("\n=== TOTAL BURNS BY PLAYERS ===");
const players = db.prepare("SELECT * FROM players ORDER BY burns DESC").all();
var totalBurns = 0;
players.forEach(function(p) {
  if (p.burns > 0) {
    totalBurns += p.burns;
    console.log(p.username + " — " + p.burns + " burns");
  }
});
console.log("\nTotal burns across all players: " + totalBurns);
console.log("Total players: " + players.length);

console.log("\n=== BURN FLIPS WITH TX HASHES ===");
const confirmedBurns = db.prepare("SELECT COUNT(*) as c FROM flips WHERE result = 'burn' AND tx_hash IS NOT NULL").get();
console.log("Burns with tx hash: " + confirmedBurns.c);
const unconfirmedBurns = db.prepare("SELECT COUNT(*) as c FROM flips WHERE result = 'burn' AND tx_hash IS NULL").get();
console.log("Burns without tx hash: " + unconfirmedBurns.c);

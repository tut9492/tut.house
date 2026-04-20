const Database = require('better-sqlite3');
const db = new Database(__dirname + '/game.db');

console.log("=== PRIZE WINNERS ===");
const prizes = db.prepare("SELECT * FROM cards WHERE is_prize = 1 AND status != 'face_down'").all();
prizes.forEach(function(p) {
  console.log("#" + p.token_id + " -> " + p.flipped_by + " | tx: " + p.tx_hash);
});
console.log("Total prizes claimed: " + prizes.length);

console.log("\n=== BURN STATS ===");
const burns = db.prepare("SELECT COUNT(*) as c FROM cards WHERE is_prize = 0 AND status != 'face_down'").get();
console.log("Total burns in DB: " + burns.c);

console.log("\n=== PRIZE FLIPS LOG ===");
const flips = db.prepare("SELECT * FROM flips WHERE result = 'prize' ORDER BY id").all();
console.log("Prize flip records: " + flips.length);
flips.forEach(function(f) {
  console.log("  #" + f.token_id + " -> " + f.player_address + " | tx: " + f.tx_hash);
});

console.log("\n=== PLAYERS WITH WINS ===");
const players = db.prepare("SELECT * FROM players WHERE wins > 0 ORDER BY wins DESC").all();
players.forEach(function(p) {
  console.log(p.username + " (" + p.address + ") wins:" + p.wins + " burns:" + p.burns);
});

console.log("\n=== FACE DOWN REMAINING ===");
const remaining = db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'face_down'").get();
console.log("Cards still face down: " + remaining.c);

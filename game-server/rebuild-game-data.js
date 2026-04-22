/**
 * Rebuild game-data.json — scans on-chain for live tokens
 * and generates a fresh board with specified prize/burn counts.
 *
 * Usage: node rebuild-game-data.js [totalCards] [prizeCount]
 * Default: 1500 total, 25 prizes
 */

const { ethers } = require('ethers');

const CONTRACT = process.env.CONTRACT_ADDRESS || '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = process.env.WRITE_RPC || 'https://mainnet.megaeth.com/rpc';
const SIGNER = (process.env.SIGNER_ADDRESS || '').toLowerCase();
const TREASURY = (process.env.TREASURY_ADDRESS || '').toLowerCase();

if (!SIGNER || !TREASURY) { console.error('Set SIGNER_ADDRESS and TREASURY_ADDRESS env vars'); process.exit(1); }

const TOTAL_CARDS = parseInt(process.argv[2]) || 1500;
const PRIZE_COUNT = parseInt(process.argv[3]) || 25;
const BURN_COUNT = TOTAL_CARDS - PRIZE_COUNT;

const provider = new ethers.JsonRpcProvider(RPC);
const contract = new ethers.Contract(CONTRACT, [
  'function ownerOf(uint256 tokenId) view returns (address)',
], provider);

async function scan() {
  console.log(`Scanning tokens 4500-6969 for live tokens...`);
  console.log(`Target: ${TOTAL_CARDS} cards (${PRIZE_COUNT} prizes, ${BURN_COUNT} burns)\n`);

  const signerTokens = [];
  const treasuryTokens = [];
  const BATCH = 100;

  for (let start = 4500; start <= 6969; start += BATCH) {
    const end = Math.min(start + BATCH - 1, 6969);
    const calls = [];

    for (let id = start; id <= end; id++) {
      const hex = '0x' + id.toString(16).padStart(64, '0');
      calls.push({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: CONTRACT, data: '0x6352211e' + hex.slice(2) }, 'latest'],
        id: id,
      });
    }

    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calls),
      });
      const results = await res.json();

      for (const r of results) {
        if (r.result && !r.error && r.result.length >= 42) {
          const owner = ('0x' + r.result.slice(-40)).toLowerCase();
          if (owner === SIGNER) signerTokens.push(r.id);
          else if (owner === TREASURY) treasuryTokens.push(r.id);
        }
      }
    } catch (err) {
      console.error(`Batch error at ${start}:`, err.message);
      // Slow fallback for this batch
      for (let id = start; id <= end; id++) {
        try {
          const owner = (await contract.ownerOf(id)).toLowerCase();
          if (owner === SIGNER) signerTokens.push(id);
          else if (owner === TREASURY) treasuryTokens.push(id);
        } catch {}
      }
    }

    process.stdout.write(`\r  Scanned ${end}/6969 — signer: ${signerTokens.length}, treasury: ${treasuryTokens.length}`);
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  console.log(`\n\nResults:`);
  console.log(`  Signer tokens: ${signerTokens.length}`);
  console.log(`  Treasury tokens: ${treasuryTokens.length}`);
  console.log(`  Total available: ${signerTokens.length + treasuryTokens.length}`);

  if (signerTokens.length < PRIZE_COUNT) {
    console.error(`\n❌ Not enough signer tokens for ${PRIZE_COUNT} prizes (only ${signerTokens.length})`);
    process.exit(1);
  }
  if (treasuryTokens.length < BURN_COUNT) {
    console.error(`\n❌ Not enough treasury tokens for ${BURN_COUNT} burns (only ${treasuryTokens.length})`);
    process.exit(1);
  }

  // Shuffle and pick
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const prizes = shuffle([...signerTokens]).slice(0, PRIZE_COUNT).sort((a, b) => a - b);
  const burns = shuffle([...treasuryTokens]).slice(0, BURN_COUNT).sort((a, b) => a - b);

  const gameData = { prizes, burns };
  const fs = require('fs');
  const path = require('path');
  const outFile = path.join(__dirname, 'game-data.json');

  fs.writeFileSync(outFile, JSON.stringify(gameData, null, 2));

  console.log(`\n✅ Generated ${outFile}`);
  console.log(`   ${prizes.length} prizes: ${prizes.slice(0, 5).join(', ')}...`);
  console.log(`   ${burns.length} burns`);
  console.log(`   ${prizes.length + burns.length} total cards`);
  console.log(`\nOdds: 1 in ${Math.round(TOTAL_CARDS / PRIZE_COUNT)}`);
  console.log(`\nNext: reset the game DB and restart the server`);
}

scan().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

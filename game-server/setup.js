/**
 * Setup script — scans BOTH wallets across ALL token IDs.
 * Breadio wallet = prizes. Main wallet (burn-eligible) = burns.
 *
 * Run once before starting the game server.
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const fs = require('fs');

const CONTRACT = process.env.CONTRACT_ADDRESS || '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = process.env.WRITE_RPC || 'https://mainnet.megaeth.com/rpc';
const BREADIO_WALLET = (process.env.SIGNER_ADDRESS || '').toLowerCase();
const MAIN_WALLET = (process.env.TREASURY_ADDRESS || '').toLowerCase();

if (!BREADIO_WALLET || !MAIN_WALLET) { console.error('Set SIGNER_ADDRESS and TREASURY_ADDRESS env vars'); process.exit(1); }
const TOTAL_SUPPLY = 6969;

// IDs to exclude from the game entirely (rare saves staying in main wallet)
const EXCLUDE_FROM_BURN = new Set([
  // Skelly 1/1s
  5009, 5023, 5283, 5366, 5375, 5451, 5470, 5797, 5918, 5942, 5948, 5951,
  6001, 6259, 6375, 6583, 6613, 6723, 6807, 6878,
  // Ziplocks
  5671, 5972, 6554, 6568,
  // Rare Bread Types
  5288, 6009, 6058, 6188, 6424, 6669,
  // Large Loaf
  6906,
  // Toasters
  6916, 6780, 6775,
  // Paper Bag
  5106,
]);

async function scanBatch(contract, start, end) {
  const results = { prizes: [], burns: [] };
  const calls = [];

  for (let id = start; id <= end; id++) {
    calls.push(contract.ownerOf(id).then(owner => ({ id, owner: owner.toLowerCase() })).catch(() => null));
  }

  const responses = await Promise.all(calls);
  for (const r of responses) {
    if (!r) continue;
    if (r.owner === BREADIO_WALLET) {
      results.prizes.push(r.id);
    } else if (r.owner === MAIN_WALLET && !EXCLUDE_FROM_BURN.has(r.id)) {
      results.burns.push(r.id);
    }
  }
  return results;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, [
    'function ownerOf(uint256) view returns (address)',
    'function balanceOf(address) view returns (uint256)',
  ], provider);

  const breadioBalance = await contract.balanceOf(BREADIO_WALLET);
  const mainBalance = await contract.balanceOf(MAIN_WALLET);
  console.log(`Breadio wallet: ${breadioBalance} NFTs (prizes)`);
  console.log(`Main wallet: ${mainBalance} NFTs`);

  const allPrizes = [];
  const allBurns = [];

  console.log(`\nScanning all ${TOTAL_SUPPLY} tokens in batches of 50...`);

  const BATCH = 50;
  for (let start = 1; start <= TOTAL_SUPPLY; start += BATCH) {
    const end = Math.min(start + BATCH - 1, TOTAL_SUPPLY);
    const results = await scanBatch(contract, start, end);
    allPrizes.push(...results.prizes);
    allBurns.push(...results.burns);

    if (start % 500 === 1 || end === TOTAL_SUPPLY) {
      console.log(`  ${end}/${TOTAL_SUPPLY} — prizes: ${allPrizes.length}, burns: ${allBurns.length}`);
    }
  }

  // If we didn't find all prizes, retry missing ones
  const target = Number(breadioBalance);
  if (allPrizes.length < target) {
    console.log(`\nFound ${allPrizes.length}/${target} prizes. Retrying...`);
    const found = new Set(allPrizes);
    for (let id = 1; id <= TOTAL_SUPPLY; id++) {
      if (found.has(id)) continue;
      try {
        const owner = await contract.ownerOf(id);
        if (owner.toLowerCase() === BREADIO_WALLET) {
          allPrizes.push(id);
          found.add(id);
          if (allPrizes.length >= target) break;
        }
      } catch {}
    }
    console.log(`After retry: ${allPrizes.length} prizes`);
  }

  console.log(`\nResults:`);
  console.log(`  Prizes (Breadio wallet): ${allPrizes.length}`);
  console.log(`  Burns (Main wallet, game-eligible): ${allBurns.length}`);
  console.log(`  Excluded (rare saves): ${EXCLUDE_FROM_BURN.size}`);
  console.log(`  Total game cards: ${allPrizes.length + allBurns.length}`);

  // Shuffle
  const allCards = [...allPrizes, ...allBurns];
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }

  const gameData = {
    prizes: allPrizes.sort((a, b) => a - b),
    burns: allBurns.sort((a, b) => a - b),
    shuffledOrder: allCards,
    totalCards: allCards.length,
    totalPrizes: allPrizes.length,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync('game-data.json', JSON.stringify(gameData, null, 2));
  console.log(`\n✅ game-data.json created`);
  console.log(`   ${allPrizes.length} prizes + ${allBurns.length} burns = ${allCards.length} total cards`);
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});

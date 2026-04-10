/**
 * Setup script — verifies which NFTs are in Breadio's wallet
 * and creates game-data.json with the actual prize/burn split.
 *
 * Run once before starting the game server.
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const fs = require('fs');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://mainnet.megaeth.com/rpc';
const BREADIO_WALLET = '0xEdaA4c0e0056eD6A17A755493c283296Fe8202Bb'.toLowerCase();

// These are the IDs selected as prizes
const INTENDED_PRIZES = [
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
  6930, 6935, 6955, 6965,
];

// IDs to keep (NOT in game at all — rare saves)
const KEEP_IDS = new Set([
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

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, [
    'function ownerOf(uint256) view returns (address)',
    'function balanceOf(address) view returns (uint256)',
  ], provider);

  // Check Breadio wallet balance
  const balance = await contract.balanceOf(BREADIO_WALLET);
  console.log(`Breadio wallet holds ${balance} NFTs`);

  // Scan all IDs from 4872 to 6969 to find what Breadio owns
  console.log('\nScanning Breadio wallet for owned NFTs...');
  const owned = [];

  for (let id = 4872; id <= 6969; id++) {
    try {
      const owner = await contract.ownerOf(id);
      if (owner.toLowerCase() === BREADIO_WALLET) {
        owned.push(id);
      }
    } catch {}

    if (id % 200 === 0) {
      console.log(`  ${id}/6969 checked, ${owned.length} found`);
    }
  }

  console.log(`\nBreadio owns ${owned.length} NFTs in range 4872-6969`);

  // Split into prizes and burns
  const prizeSet = new Set(INTENDED_PRIZES);
  const prizes = owned.filter(id => prizeSet.has(id));
  const burns = owned.filter(id => !prizeSet.has(id) && !KEEP_IDS.has(id));
  const kept = owned.filter(id => KEEP_IDS.has(id));

  console.log(`\nPrizes (in wallet + in prize list): ${prizes.length}`);
  console.log(`Burns (in wallet, not prize, not kept): ${burns.length}`);
  console.log(`Kept (rare saves, excluded from game): ${kept.length}`);
  console.log(`Total game cards: ${prizes.length + burns.length}`);

  // Missing prizes (in list but not in wallet)
  const missing = INTENDED_PRIZES.filter(id => !owned.includes(id));
  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} intended prizes NOT in Breadio wallet:`);
    console.log(`   ${missing.join(', ')}`);
  }

  // Shuffle card order (so prizes aren't clustered)
  const allCards = [...prizes, ...burns];
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }

  const gameData = {
    prizes: prizes,
    burns: burns,
    shuffledOrder: allCards,
    totalCards: allCards.length,
    totalPrizes: prizes.length,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync('game-data.json', JSON.stringify(gameData, null, 2));
  console.log('\n✅ game-data.json created');
  console.log(`   ${prizes.length} prizes + ${burns.length} burns = ${allCards.length} total cards`);
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});

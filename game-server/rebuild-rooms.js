/**
 * Rebuild game data for multi-room setup.
 * Prizes = real token IDs from signer wallet (transferred on-chain)
 * Real burns = treasury token IDs (burned on-chain by signer)
 * Fake burns = fake IDs (game-state only, no chain tx)
 *
 * Usage: node rebuild-rooms.js [breadioPrizes] [publicPrizes] [realBurns] [cardsPerRoom]
 * Default: 5 prizes per room, 5 burns per room, 150 cards per room
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT = process.env.CONTRACT_ADDRESS || '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = process.env.WRITE_RPC || 'https://mainnet.megaeth.com/rpc';
const SIGNER_ADDR = process.env.SIGNER_ADDRESS;
const TREASURY_ADDR = process.env.TREASURY_ADDRESS;

if (!SIGNER_ADDR || !TREASURY_ADDR) { console.error('Set SIGNER_ADDRESS and TREASURY_ADDRESS env vars'); process.exit(1); }

const BREADIO_PRIZES = parseInt(process.argv[2]) || 5;
const PUBLIC_PRIZES = parseInt(process.argv[3]) || 5;
const TOTAL_REAL_BURNS = parseInt(process.argv[4]) || 0;
const CARDS_PER_ROOM = parseInt(process.argv[5]) || 150;

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: ethers.Network.from(4326) });

async function getHoldings(address) {
  var iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)']);
  var transferTopic = iface.getEvent('Transfer').topicHash;
  var padded = ethers.zeroPadValue(address, 32);

  var logsTo = await provider.getLogs({
    address: CONTRACT, topics: [transferTopic, null, padded],
    fromBlock: 0, toBlock: 'latest'
  });
  var logsFrom = await provider.getLogs({
    address: CONTRACT, topics: [transferTopic, padded, null],
    fromBlock: 0, toBlock: 'latest'
  });

  var holdings = {};
  logsTo.forEach(function(log) { holdings[parseInt(log.topics[3], 16)] = true; });
  logsFrom.forEach(function(log) { delete holdings[parseInt(log.topics[3], 16)]; });
  return Object.keys(holdings).map(Number).sort(function(a, b) { return a - b; });
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

async function scan() {
  var totalPrizes = BREADIO_PRIZES * 2 + PUBLIC_PRIZES * 2;

  console.log('Finding tokens via Transfer events...\n');

  // Get signer tokens (prizes)
  var signerTokens = await getHoldings(SIGNER_ADDR);
  console.log('Signer holdings: ' + signerTokens.length + ' tokens');
  console.log(signerTokens.join(', ') + '\n');

  if (signerTokens.length < totalPrizes) {
    console.error('Not enough signer tokens! Need ' + totalPrizes + ', have ' + signerTokens.length);
    process.exit(1);
  }

  // Get treasury tokens (real burns)
  var treasuryTokens = [];
  if (TOTAL_REAL_BURNS > 0) {
    treasuryTokens = await getHoldings(TREASURY_ADDR);
    console.log('Treasury holdings: ' + treasuryTokens.length + ' tokens');
    if (treasuryTokens.length < TOTAL_REAL_BURNS) {
      console.error('Not enough treasury tokens! Need ' + TOTAL_REAL_BURNS + ', have ' + treasuryTokens.length);
      process.exit(1);
    }
  }

  shuffle(signerTokens);
  shuffle(treasuryTokens);

  // Pick the burn tokens
  var burnTokens = treasuryTokens.slice(0, TOTAL_REAL_BURNS);
  console.log('Real burns: ' + burnTokens.length + ' tokens\n');

  // Distribute burns evenly: 12/12/12/11
  var burnsPerRoom = Math.floor(TOTAL_REAL_BURNS / 4);
  var burnRemainder = TOTAL_REAL_BURNS % 4;
  var burnDistribution = [burnsPerRoom, burnsPerRoom, burnsPerRoom, burnsPerRoom];
  for (var r = 0; r < burnRemainder; r++) burnDistribution[r]++;

  // Generate fake burn IDs (10000+ range)
  var burnId = 10001;
  function makeFakeBurns(count) {
    var burns = [];
    for (var i = 0; i < count; i++) { burns.push(burnId++); }
    return burns;
  }

  var prizeIdx = 0;
  var burnIdx = 0;
  var roomConfigs = [
    { name: 'breadio', prizes: BREADIO_PRIZES },
    { name: 'breadio2', prizes: BREADIO_PRIZES },
    { name: 'public', prizes: PUBLIC_PRIZES },
    { name: 'public2', prizes: PUBLIC_PRIZES },
  ];

  roomConfigs.forEach(function(rc, i) {
    var prizes = signerTokens.slice(prizeIdx, prizeIdx + rc.prizes).sort(function(a, b) { return a - b; });
    prizeIdx += rc.prizes;

    var realBurns = burnTokens.slice(burnIdx, burnIdx + burnDistribution[i]).sort(function(a, b) { return a - b; });
    burnIdx += burnDistribution[i];

    var fakeBurnCount = CARDS_PER_ROOM - rc.prizes - burnDistribution[i];
    var fakeBurns = makeFakeBurns(fakeBurnCount);

    var data = { prizes: prizes, realBurns: realBurns, burns: fakeBurns };
    var file = path.join(__dirname, 'game-data-' + rc.name + '.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));

    console.log('=== ' + rc.name.toUpperCase() + ' ===');
    console.log('Prizes: ' + prizes.length + ' — ' + prizes.join(', '));
    console.log('Real burns: ' + realBurns.length + ' — ' + realBurns.join(', '));
    console.log('Filler: ' + fakeBurns.length);
    console.log('Total: ' + (prizes.length + realBurns.length + fakeBurns.length));
    console.log('Prize odds: 1 in ' + Math.round(CARDS_PER_ROOM / rc.prizes));
    console.log('');
  });

  console.log('Remaining signer tokens: ' + (signerTokens.length - prizeIdx));
  console.log('Remaining treasury tokens: ' + (treasuryTokens.length - burnIdx));
}

scan().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

/**
 * Rebuild game data for multi-room setup.
 * Prizes = real token IDs from signer wallet (transferred on-chain)
 * Burns = fake IDs (game-state only, no chain tx)
 *
 * Usage: node rebuild-rooms.js [breadioPrizes] [publicPrizes] [cardsPerRoom]
 * Default: 5 prizes per room, 150 cards per room
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://megaeth.drpc.org';
const SIGNER = '0xEdaA4c0e0056eD6A17A755493c283296Fe8202Bb'.toLowerCase();

const BREADIO_PRIZES = parseInt(process.argv[2]) || 5;
const PUBLIC_PRIZES = parseInt(process.argv[3]) || 5;
const CARDS_PER_ROOM = parseInt(process.argv[4]) || 150;

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: ethers.Network.from(4326) });
const contract = new ethers.Contract(CONTRACT, ['function ownerOf(uint256) view returns (address)'], provider);

async function scan() {
  var totalPrizes = BREADIO_PRIZES * 2 + PUBLIC_PRIZES * 2; // 4 rooms
  console.log('Scanning for signer tokens (prizes)...');
  console.log('Need ' + totalPrizes + ' prize tokens from signer\n');

  var signerTokens = [];
  var BATCH = 20;

  for (var start = 1; start <= 6969; start += BATCH) {
    if (signerTokens.length >= totalPrizes) break;
    var batch = [];
    for (var i = start; i < start + BATCH && i <= 6969; i++) batch.push(i);

    var results = await Promise.allSettled(
      batch.map(function(id) {
        return contract.ownerOf(id).then(function(owner) {
          return { id: id, owner: owner.toLowerCase() };
        });
      })
    );

    results.forEach(function(r) {
      if (r.status === 'fulfilled' && r.value.owner === SIGNER) {
        signerTokens.push(r.value.id);
      }
    });

    if (start % 100 < BATCH) {
      console.log('  Scanned ' + Math.min(start + BATCH - 1, 6969) + '/6969 — found: ' + signerTokens.length + '/' + totalPrizes);
    }
  }

  console.log('\nFound ' + signerTokens.length + ' signer tokens');

  if (signerTokens.length < totalPrizes) {
    console.error('Not enough signer tokens! Need ' + totalPrizes + ', have ' + signerTokens.length);
    process.exit(1);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  shuffle(signerTokens);

  // Generate fake burn IDs (10000+ range, won't conflict with real tokens)
  var burnId = 10001;
  function makeBurns(count) {
    var burns = [];
    for (var i = 0; i < count; i++) { burns.push(burnId++); }
    return burns;
  }

  var idx = 0;
  var roomConfigs = [
    { name: 'breadio', prizes: BREADIO_PRIZES },
    { name: 'breadio2', prizes: BREADIO_PRIZES },
    { name: 'public', prizes: PUBLIC_PRIZES },
    { name: 'public2', prizes: PUBLIC_PRIZES },
  ];

  roomConfigs.forEach(function(rc) {
    var prizes = signerTokens.slice(idx, idx + rc.prizes).sort(function(a,b){return a-b;});
    idx += rc.prizes;
    var burns = makeBurns(CARDS_PER_ROOM - rc.prizes);
    var data = { prizes: prizes, burns: burns };
    var file = path.join(__dirname, 'game-data-' + rc.name + '.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('\n=== ' + rc.name.toUpperCase() + ' ===');
    console.log('Prizes: ' + prizes.length + ' — ' + prizes.join(', '));
    console.log('Burns: ' + burns.length + ' (fake IDs, game-state only)');
    console.log('Total: ' + (prizes.length + burns.length));
    console.log('Odds: 1 in ' + Math.round(CARDS_PER_ROOM / rc.prizes));
  });

  console.log('\nRemaining signer tokens: ' + (signerTokens.length - idx));
}

scan().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

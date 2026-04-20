/**
 * Rebuild game data for multi-room setup.
 * Scans chain, splits tokens between breadio and public rooms.
 *
 * Usage: node rebuild-rooms.js [breadioPrizes] [publicPrizes] [breadioTotal] [publicTotal]
 * Default: 15 breadio prizes, 10 public prizes, 300 cards each
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://mainnet.megaeth.com/rpc';
const SIGNER = '0xEdaA4c0e0056eD6A17A755493c283296Fe8202Bb'.toLowerCase();
const TREASURY = '0x75775181080b3684cc3be770ba070d1ecc1ec50d'.toLowerCase();

const BREADIO_PRIZES = parseInt(process.argv[2]) || 15;
const PUBLIC_PRIZES = parseInt(process.argv[3]) || 10;
const BREADIO_TOTAL = parseInt(process.argv[4]) || 300;
const PUBLIC_TOTAL = parseInt(process.argv[5]) || 300;

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: ethers.Network.from(4326) });
const contract = new ethers.Contract(CONTRACT, ['function ownerOf(uint256) view returns (address)'], provider);

async function scan() {
  console.log('Scanning tokens 4500-6969...');
  console.log('Breadio room: ' + BREADIO_TOTAL + ' cards, ' + BREADIO_PRIZES + ' prizes');
  console.log('Public room: ' + PUBLIC_TOTAL + ' cards, ' + PUBLIC_PRIZES + ' prizes\n');

  var signerTokens = [];
  var treasuryTokens = [];

  for (var id = 1; id <= 6969; id++) {
    try {
      var owner = (await contract.ownerOf(id)).toLowerCase();
      if (owner === SIGNER) signerTokens.push(id);
      else if (owner === TREASURY) treasuryTokens.push(id);
    } catch {}
    if (id % 100 === 0) process.stdout.write('\r  Scanned ' + id + '/6969 — signer: ' + signerTokens.length + ', treasury: ' + treasuryTokens.length);
    if (id % 10 === 0) await new Promise(function(r) { setTimeout(r, 50); });
  }

  console.log('\n\nSigner: ' + signerTokens.length);
  console.log('Treasury: ' + treasuryTokens.length);

  var totalPrizes = BREADIO_PRIZES + PUBLIC_PRIZES;
  var totalBurns = (BREADIO_TOTAL - BREADIO_PRIZES) + (PUBLIC_TOTAL - PUBLIC_PRIZES);

  if (signerTokens.length < totalPrizes) {
    console.error('Not enough signer tokens for prizes! Need ' + totalPrizes + ', have ' + signerTokens.length);
    process.exit(1);
  }
  if (treasuryTokens.length < totalBurns) {
    console.error('Not enough treasury tokens for burns! Need ' + totalBurns + ', have ' + treasuryTokens.length);
    process.exit(1);
  }

  // Shuffle
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  shuffle(signerTokens);
  shuffle(treasuryTokens);

  // Split prizes
  var breadioPrizes = signerTokens.slice(0, BREADIO_PRIZES).sort(function(a,b){return a-b;});
  var publicPrizes = signerTokens.slice(BREADIO_PRIZES, BREADIO_PRIZES + PUBLIC_PRIZES).sort(function(a,b){return a-b;});

  // Split burns
  var breadioBurns = treasuryTokens.slice(0, BREADIO_TOTAL - BREADIO_PRIZES).sort(function(a,b){return a-b;});
  var publicBurns = treasuryTokens.slice(BREADIO_TOTAL - BREADIO_PRIZES, BREADIO_TOTAL - BREADIO_PRIZES + PUBLIC_TOTAL - PUBLIC_PRIZES).sort(function(a,b){return a-b;});

  // Write files
  var breadioData = { prizes: breadioPrizes, burns: breadioBurns };
  var publicData = { prizes: publicPrizes, burns: publicBurns };

  fs.writeFileSync(path.join(__dirname, 'game-data-breadio.json'), JSON.stringify(breadioData, null, 2));
  fs.writeFileSync(path.join(__dirname, 'game-data-public.json'), JSON.stringify(publicData, null, 2));

  console.log('\n=== BREADIO ROOM ===');
  console.log('Prizes: ' + breadioPrizes.length + ' — ' + breadioPrizes.slice(0,5).join(', ') + '...');
  console.log('Burns: ' + breadioBurns.length);
  console.log('Total: ' + (breadioPrizes.length + breadioBurns.length));
  console.log('Odds: 1 in ' + Math.round(BREADIO_TOTAL / BREADIO_PRIZES));

  console.log('\n=== PUBLIC ROOM ===');
  console.log('Prizes: ' + publicPrizes.length + ' — ' + publicPrizes.slice(0,5).join(', ') + '...');
  console.log('Burns: ' + publicBurns.length);
  console.log('Total: ' + (publicPrizes.length + publicBurns.length));
  console.log('Odds: 1 in ' + Math.round(PUBLIC_TOTAL / PUBLIC_PRIZES));

  console.log('\nRemaining unassigned:');
  console.log('  Signer: ' + (signerTokens.length - totalPrizes));
  console.log('  Treasury: ' + (treasuryTokens.length - totalBurns));
}

scan().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

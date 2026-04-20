/**
 * Send prizes to winners from today's game.
 * Reads winner list from DB, picks prize tokens from signer wallet,
 * transfers one per win to each winner's address.
 *
 * Usage: node send-prizes.js [--dry-run]
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://megaeth.drpc.org';
const SIGNER_KEY = process.env.BREADIO_PRIVATE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SIGNER_KEY) { console.error('BREADIO_PRIVATE_KEY not set'); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
});
const wallet = new ethers.Wallet(SIGNER_KEY, provider);
const contract = new ethers.Contract(CONTRACT, [
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
], wallet);

const db = new Database(path.join(__dirname, 'game.db'));

async function main() {
  console.log('Signer:', wallet.address);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');

  // Get winners from DB
  const winners = db.prepare('SELECT * FROM players WHERE wins > 0 ORDER BY wins DESC').all();
  console.log('\n=== WINNERS ===');
  var totalWins = 0;
  winners.forEach(function(w) {
    console.log(w.username + ' (' + w.address + ') — ' + w.wins + ' wins');
    totalWins += w.wins;
  });
  console.log('Total prizes to send: ' + totalWins);

  // Check how many tokens signer has
  const balance = await contract.balanceOf(wallet.address);
  console.log('Signer balance: ' + balance.toString());

  if (Number(balance) < totalWins) {
    console.error('NOT ENOUGH TOKENS! Need ' + totalWins + ', have ' + balance.toString());
    process.exit(1);
  }

  // Find token IDs owned by signer (scan the prize range)
  console.log('\nScanning for signer tokens...');
  const signerTokens = [];
  const BATCH = 50;
  for (var start = 4500; start <= 6969; start += BATCH) {
    var end = Math.min(start + BATCH - 1, 6969);
    var calls = [];
    for (var id = start; id <= end; id++) {
      var hex = '0x' + id.toString(16).padStart(64, '0');
      calls.push({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: CONTRACT, data: '0x6352211e' + hex.slice(2) }, 'latest'],
        id: id,
      });
    }
    try {
      var res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calls),
      });
      var results = await res.json();
      for (var r of results) {
        if (r.result && !r.error && r.result.length >= 42) {
          var owner = ('0x' + r.result.slice(-40)).toLowerCase();
          if (owner === wallet.address.toLowerCase()) {
            signerTokens.push(r.id);
          }
        }
      }
    } catch (err) {
      console.error('Scan error at ' + start);
    }
    await new Promise(function(r) { setTimeout(r, 200); });
  }
  console.log('Found ' + signerTokens.length + ' tokens in signer wallet');

  if (signerTokens.length < totalWins) {
    console.error('NOT ENOUGH SIGNER TOKENS! Need ' + totalWins + ', found ' + signerTokens.length);
    process.exit(1);
  }

  // Assign tokens to winners
  var tokenIndex = 0;
  var assignments = [];
  for (var w of winners) {
    for (var i = 0; i < w.wins; i++) {
      assignments.push({
        to: w.address,
        username: w.username,
        tokenId: signerTokens[tokenIndex],
      });
      tokenIndex++;
    }
  }

  console.log('\n=== ASSIGNMENTS ===');
  assignments.forEach(function(a) {
    console.log('#' + a.tokenId + ' -> ' + a.username + ' (' + a.to + ')');
  });

  if (DRY_RUN) {
    console.log('\nDRY RUN — no transactions sent.');
    return;
  }

  // Send prizes
  console.log('\n=== SENDING PRIZES ===');
  var nonce = await provider.getTransactionCount(wallet.address, 'pending');
  console.log('Starting nonce: ' + nonce);

  for (var j = 0; j < assignments.length; j++) {
    var a = assignments[j];
    try {
      console.log('[' + (j+1) + '/' + assignments.length + '] #' + a.tokenId + ' -> ' + a.username + '...');
      var tx = await contract.transferFrom(wallet.address, a.to, a.tokenId, { gasLimit: 200000, nonce: nonce });
      console.log('  tx: ' + tx.hash);
      await tx.wait();
      console.log('  confirmed!');
      nonce++;
      await new Promise(function(r) { setTimeout(r, 500); });
    } catch (err) {
      console.error('  FAILED: ' + err.message.slice(0, 100));
      // Try to continue with next
      nonce = await provider.getTransactionCount(wallet.address, 'pending');
    }
  }

  console.log('\nDONE!');
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

/**
 * Send prizes to verified winners from the stream.
 * Skips addresses that already received tokens on-chain.
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://mainnet.megaeth.com/rpc';
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

// Add winners here: { username, address, count }
const WINNERS = [
  // { username: 'player1', address: '0x...', count: 1 },
];

async function main() {
  console.log('Signer:', wallet.address);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');

  var totalToSend = 0;
  WINNERS.forEach(function(w) { totalToSend += w.count; });
  console.log('Total prizes to send: ' + totalToSend);

  // Find signer tokens (individual calls to avoid batch issues)
  console.log('\nScanning for signer tokens...');
  var signerTokens = [];
  var signerAddr = wallet.address.toLowerCase();
  for (var id = 4500; id <= 6969; id++) {
    try {
      var owner = (await contract.ownerOf(id)).toLowerCase();
      if (owner === signerAddr) {
        signerTokens.push(id);
      }
    } catch (e) {
      // token burned or doesn't exist
    }
    if (id % 100 === 0) process.stdout.write('\r  Scanned ' + id + '/6969 — found: ' + signerTokens.length);
    if (id % 10 === 0) await new Promise(function(r) { setTimeout(r, 50); });
  }
  console.log('\nFound ' + signerTokens.length + ' tokens in signer');

  // Assign tokens
  var tokenIndex = 0;
  var assignments = [];
  for (var w of WINNERS) {
    for (var i = 0; i < w.count; i++) {
      assignments.push({ to: w.address, username: w.username, tokenId: signerTokens[tokenIndex] });
      tokenIndex++;
    }
  }

  console.log('\n=== ASSIGNMENTS ===');
  assignments.forEach(function(a) { console.log('#' + a.tokenId + ' -> ' + a.username + ' (' + a.to + ')'); });

  if (DRY_RUN) { console.log('\nDRY RUN — nothing sent.'); return; }

  // Send
  console.log('\n=== SENDING ===');
  var nonce = await provider.getTransactionCount(wallet.address, 'pending');
  var sent = 0;
  var failed = 0;

  for (var j = 0; j < assignments.length; j++) {
    var a = assignments[j];
    try {
      console.log('[' + (j+1) + '/' + assignments.length + '] #' + a.tokenId + ' -> ' + a.username);
      var tx = await contract.transferFrom(wallet.address, a.to, a.tokenId, { gasLimit: 200000, nonce: nonce });
      console.log('  tx: ' + tx.hash);
      await tx.wait();
      console.log('  CONFIRMED');
      sent++;
      nonce++;
      await new Promise(function(r) { setTimeout(r, 1000); });
    } catch (err) {
      console.error('  FAILED: ' + err.message.slice(0, 100));
      failed++;
      nonce = await provider.getTransactionCount(wallet.address, 'pending');
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
  }

  console.log('\n=== DONE ===');
  console.log('Sent: ' + sent + '/' + assignments.length);
  console.log('Failed: ' + failed);
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

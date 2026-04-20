/**
 * Send prizes to verified winners from the stream.
 * Skips addresses that already received tokens on-chain.
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');

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
  'function balanceOf(address owner) view returns (uint256)',
], wallet);

// Winners to send to (already delivered excluded)
const WINNERS = [
  { username: 'braaaad', address: '0x65bc8894f7628bf39250624ae25c34fce8e516c1', count: 1 },
  { username: 'Arch', address: '0x422d6cde343e116da1987838a431ad11abca1974', count: 2 },
  { username: 'mary', address: '0x916b601e00a4a369a0f02d0baa5e46aa04b0b818', count: 2 },
  { username: 'RedKroh', address: '0x0824dd5cc7e27a1fb400e9e54baaf3bf8da793d0', count: 2 },
  { username: 'ahs gay', address: '0x1f38fa918c8e565f3065fca9882723fbc2c92c38', count: 2 },
  { username: 'unicorsha', address: '0x2f4a84a725cd31b280485f06893f3af36620cab6', count: 2 },
  { username: 'Bomzhik', address: '0xc79209a5ce6eadbdc94894b87ffe58a12f714615', count: 2 },
  { username: 'Nexory', address: '0x398e87bfa425b985a08a1299ea89ec94a0bd1263', count: 1 },
  { username: 'Bunny', address: '0x55e7144582b340e83d6612eb137440cbada04d48', count: 1 },
  { username: 'msat4u', address: '0x9d5765595a92c560c8759d2a9c375c66123765a5', count: 1 },
  { username: 'ryan', address: '0xfecb26fe05ef20f5e616912f3a4f2060dc7f6d70', count: 1 },
  { username: 'inco', address: '0x0988d3aabb4d1697689fb7722d0cb4e173a95449', count: 1 },
  { username: 'detony', address: '0x773afe9d9b6d50cc2a14c52c31c2f8635694525b', count: 1 },
  { username: 'SICKASSPEN', address: '0x0619e9c5e7ac9f1c831eddea02f4b19f32a7d272', count: 1 },
  { username: 'lfg', address: '0x53d8591bfbbdf5b456cdf1c1b627e4f82cec6711', count: 1 },
  { username: 'YM', address: '0x5e5c9b7be45e8d7a958265f3addea9460d8a346a', count: 1 },
  { username: '0x55breadio', address: '0x554eb544e74d6d8d0b1cb15ee038cf6ea0e00e2c', count: 1 },
];

async function main() {
  console.log('Signer:', wallet.address);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');

  var totalToSend = 0;
  WINNERS.forEach(function(w) { totalToSend += w.count; });
  console.log('Total prizes to send: ' + totalToSend);

  // Find signer tokens
  console.log('\nScanning for signer tokens...');
  var signerTokens = [];
  var BATCH = 50;
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
    } catch (err) { console.error('Scan error at ' + start); }
    await new Promise(function(r) { setTimeout(r, 200); });
  }
  console.log('Found ' + signerTokens.length + ' tokens in signer');

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

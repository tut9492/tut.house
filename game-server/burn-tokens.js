/**
 * Burn tokens from treasury and signer wallets.
 * Usage: node burn-tokens.js [count] [--dry-run]
 * Default: 1000 burns
 */

require('dotenv').config({ path: '/home/ubuntu/.openclaw/.env' });
const { ethers } = require('ethers');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://mainnet.megaeth.com/rpc';
const SIGNER_KEY = process.env.BREADIO_PRIVATE_KEY;
const TREASURY = process.env.TREASURY_ADDRESS;
if (!TREASURY) { console.error('TREASURY_ADDRESS not set'); process.exit(1); }
const BURN_COUNT = parseInt(process.argv[2]) || 1000;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SIGNER_KEY) { console.error('BREADIO_PRIVATE_KEY not set'); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
});
const wallet = new ethers.Wallet(SIGNER_KEY, provider);
const contract = new ethers.Contract(CONTRACT, [
  'function burn(uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
], wallet);

async function main() {
  console.log('Signer:', wallet.address);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');
  console.log('Target burns:', BURN_COUNT);

  // Find treasury tokens to burn
  console.log('\nScanning for treasury tokens...');
  var treasuryTokens = [];
  var signerAddr = wallet.address.toLowerCase();
  var treasuryAddr = TREASURY.toLowerCase();

  for (var id = 4500; id <= 6969; id++) {
    if (treasuryTokens.length >= BURN_COUNT) break;
    try {
      var owner = (await contract.ownerOf(id)).toLowerCase();
      if (owner === treasuryAddr) {
        treasuryTokens.push(id);
      }
    } catch (e) {}
    if (id % 100 === 0) process.stdout.write('\r  Scanned ' + id + '/6969 — found: ' + treasuryTokens.length + '/' + BURN_COUNT);
    if (id % 10 === 0) await new Promise(function(r) { setTimeout(r, 50); });
  }
  console.log('\nFound ' + treasuryTokens.length + ' treasury tokens to burn');

  if (treasuryTokens.length === 0) {
    console.log('Nothing to burn!');
    return;
  }

  var toBurn = treasuryTokens.slice(0, BURN_COUNT);
  console.log('Will burn: ' + toBurn.length + ' tokens');
  console.log('First 10: ' + toBurn.slice(0, 10).join(', '));
  console.log('Last 10: ' + toBurn.slice(-10).join(', '));

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing burned.');
    return;
  }

  // Burn in batches with nonce management
  console.log('\n=== BURNING ===');
  var nonce = await provider.getTransactionCount(wallet.address, 'pending');
  var burned = 0;
  var failed = 0;

  for (var j = 0; j < toBurn.length; j++) {
    var tokenId = toBurn[j];
    try {
      if (j % 10 === 0) console.log('[' + (j+1) + '/' + toBurn.length + '] Burning #' + tokenId + '... (nonce: ' + nonce + ')');
      var tx = await contract.burn(tokenId, { gasLimit: 200000, nonce: nonce });
      // Don't wait for confirmation — fire and move on
      burned++;
      nonce++;

      // Log every 10th confirmation
      if (j % 10 === 0) {
        await tx.wait();
        console.log('  confirmed batch up to #' + tokenId);
      }

      // Brief pause every 5 to avoid rate limit
      if (j % 5 === 0) await new Promise(function(r) { setTimeout(r, 200); });
    } catch (err) {
      console.error('  FAILED #' + tokenId + ': ' + err.message.slice(0, 80));
      failed++;
      // Resync nonce
      nonce = await provider.getTransactionCount(wallet.address, 'pending');
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
  }

  console.log('\n=== DONE ===');
  console.log('Burned: ' + burned + '/' + toBurn.length);
  console.log('Failed: ' + failed);
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

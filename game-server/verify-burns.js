/**
 * Verify which burns from the flips table actually happened on-chain.
 */

const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

const CONTRACT = '0x015061aa806b5abab9ee453e366e18a713e8ea80';
const RPC = 'https://megaeth.drpc.org';

const provider = new ethers.JsonRpcProvider(RPC, undefined, {
  staticNetwork: ethers.Network.from(4326),
});

const db = new Database(path.join(__dirname, 'game.db'));

async function main() {
  // Get all burn flips with tx hashes
  var burnFlips = db.prepare("SELECT DISTINCT token_id, tx_hash FROM flips WHERE result = 'burn' AND tx_hash IS NOT NULL").all();
  console.log('Burn flips to verify: ' + burnFlips.length);

  var confirmed = 0;
  var stillExists = 0;
  var failed = 0;
  var existsList = [];
  var burnedList = [];

  var BATCH = 50;
  var tokenIds = burnFlips.map(function(f) { return f.token_id; });

  // Also check all token IDs that players "burned" via the player table
  // These might not be in flips table
  console.log('\nScanning all game tokens 4500-6969 for burn status...');

  var totalBurned = 0;
  var totalExists = 0;

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
        if (r.error || (r.result && r.result === '0x')) {
          totalBurned++;
        } else if (r.result && r.result.length >= 42) {
          totalExists++;
        }
      }
    } catch (err) { console.error('Scan error at ' + start); }
    process.stdout.write('\r  Scanned ' + end + '/6969');
    await new Promise(function(r) { setTimeout(r, 100); });
  }

  console.log('\n\n=== ON-CHAIN BURN RESULTS ===');
  console.log('Tokens burned (all time, IDs 4500-6969): ' + totalBurned);
  console.log('Tokens still existing (IDs 4500-6969): ' + totalExists);

  // Now verify the specific burn flips from the DB
  console.log('\n=== VERIFYING FLIPS TABLE BURNS ===');
  for (var i = 0; i < tokenIds.length; i += BATCH) {
    var batch = tokenIds.slice(i, i + BATCH);
    var calls2 = batch.map(function(id) {
      var hex = '0x' + id.toString(16).padStart(64, '0');
      return {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: CONTRACT, data: '0x6352211e' + hex.slice(2) }, 'latest'],
        id: id,
      };
    });
    try {
      var res2 = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calls2),
      });
      var results2 = await res2.json();
      for (var r2 of results2) {
        if (r2.error || (r2.result && r2.result === '0x')) {
          confirmed++;
          burnedList.push(r2.id);
        } else {
          stillExists++;
          existsList.push(r2.id);
        }
      }
    } catch (err) { console.error('Verify error'); }
    await new Promise(function(r) { setTimeout(r, 200); });
  }

  console.log('Flips table burns confirmed on-chain: ' + confirmed + '/' + burnFlips.length);
  console.log('Flips table burns that FAILED (token still exists): ' + stillExists);

  if (existsList.length > 0 && existsList.length <= 20) {
    console.log('\nFailed burn token IDs: ' + existsList.join(', '));
  }

  // Compare with pre-game state
  console.log('\n=== SUMMARY ===');
  console.log('Before today: ~404 total burns');
  console.log('Now: ' + totalBurned + ' total burns (IDs 4500-6969 range)');
  console.log('New burns from today: ' + (totalBurned - 0) + ' (need pre-game baseline to calculate exact)');
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });

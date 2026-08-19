# tut.house on-chain raise — build

Flips the raise deck from a Google Form to an on-chain contribution + soulbound receipt.
**PRE-AUDIT. Real money will flow — Fable + external audit the contract before mainnet deploy.**

## Fable audit (2026-08-18)
Round 1 = **NO-GO**, 4 findings (all PoC-proven): **H-1** tokenURI JSON injection via unescaped
`xName` (attacker hijacks receipt `image` → off-chain phish); **H-2** SVG markup injection; **M-1**
reverting treasury bricks the whole raise (push-forward, no fallback); **L-1** force-sent ETH
unrecoverable. Soulbound / reentrancy / sentinel / accounting = verified safe.
**v0.2 fixes (all applied + tested, 8 tests green):** input allowlist `_requireValidX`
([A-Za-z0-9_], 1–32) + `_requireValidDiscord` ([A-Za-z0-9_.#-], 0–40) on contribute+updateProfile
(kills H-1/H-2 + unbounded-gas); **pull-payment** `withdraw()` — funds accrue, anyone sweeps to the
FIXED treasury (kills M-1 + L-1, recovers force-sent ETH).
**RE-AUDIT: GO (2026-08-18)** — all 4 findings verified closed, no regressions, 16/16 tests incl. 8
adversarial PoCs; no must-fix. Applied the 2 cosmetic recs (dead `"anon"` branch removed, header
NatSpec updated); keeper-driven withdraw is optional. Still recommended: an external audit before real money.
**UI aligned to the real raise palette** (from `public/raise.html`): ink #1c0d2b, gold #bfeaf4 (cyan),
lapis #a879ff, carnelian #ff5cae, papyrus #e9f6fb, Arial Black display — `/founder` now matches the deck.

## CURRENCY: USDC (converted 2026-08-18)
Funds are collected in **USDC** (not ETH), so people contribute in dollars. Contract now pulls
USDC via `transferFrom` (two-step: `approve` then `contribute`).
- `contribute(uint256 amount, string xName, string discord)` — `amount` = USDC base units (6 dp;
  $100 = 100_000000). Pulls USDC + balance-delta guard. NOT payable. 8 tests green.
- Mainnet **USDC = `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`** (6 decimals). Constructor takes
  `(usdc, treasury)`.
- **Vanilla web3 constants for the real raise.html wiring** (verified byte-identical to `cast`):
  `contribute(uint256,string,string)` = **`0x6daee7c5`**; `approve(address,uint256)` = `0x095ea7b3`;
  reads `totalRaised()` `0xc5c4744c` + `founderCount()` `0x773e3309` (totalRaised is 6-dp → `/1e6` = $).
  Flow: read `allowance` → `approve(receipt, amount)` if short → `contribute(amount, x, d)` → poll receipt.
- **USDC re-audit: GO (2026-08-18).** 18 tests incl. 10 adversarial USDC PoCs. Verified: pull-transfer
  reentrancy-safe (nonReentrant + CEI, hostile-token re-entry blocked); balance-delta guard binds
  recorded amount to real USDC (rejects fee-on-transfer); 6-dec math correct (exact base units in
  metadata); prior fixes (allowlist/soulbound/pull-withdraw) hold; USDC blacklist/pause fail-safe,
  funds owner-recoverable. No must-fix. Applied the one rec: `rescueETH()` (owner) for force-sent ETH.
  Deploy note: confirm constructor `usdc_` = canonical Circle USDC on the target chain.
- NOTE: the live `raise.html` inline checkout script is still the ETH version — swap to USDC +
  fold in the approved "banger" design (v5 test artifact) + live stats in the final port, once
  design + copy (legal) are settled. Test artifact `v5-usdc` shows the USDC UX.

## What's built
- **`src/AGNTFoundersReceipt.sol`** (v0.3-USDC) — soulbound receipt. `contribute(xName, discord)` payable:
  forwards ETH to treasury, records cumulative amount + X handle + Discord on-chain, mints ONE
  non-transferable ERC-721 per wallet (accumulates on repeat), on-chain SVG badge. 6 tests green
  (isolated Foundry+OZ v5): mint+forward+record, accumulate, soulbound (no transfer/approve),
  requires value+open, updateProfile, tokenURI renders.
- **Front end — INLINE CHECKOUT on the deck (primary, 2026-08-18):** the raise deck's final slide
  (`public/raise.html`) IS the checkout. "Become a Founder" opens an in-place flow (connect →
  amount w/ 0.1/0.5/1 ETH quick-chips + X handle + optional Discord → contribute → soulbound
  receipt), styled with the deck's own tokens. **Zero-dependency vanilla web3** (window.ethereum:
  eth_requestAccounts, wallet_switchEthereumChain→0x1, hand-rolled `contribute(string,string)`
  ABI encode + eth_sendTransaction w/ value, receipt poll). **ABI encoder verified byte-identical
  to `cast calldata`.** Keydown guarded so typing doesn't trigger deck nav. Selector `0x98678e45`.
  Client-side allowlist mirrors the contract. **GO-LIVE: set `FOUNDER_CONTRACT` (one line in
  raise.html's checkout script) after deploy.**
- The React `/founder` page (`app/founder/*` + `app/lib/founderContract.ts`, mainnet+injected) still
  exists as a standalone fallback but is no longer the primary path (deck no longer links to it).

## Decisions locked (2026-08-18)
- **Chain: ETH mainnet** (matches AGNT). **Currency: ETH** (msg.value = amount).
- **One soulbound token per wallet**, accumulates. Funds **forwarded to treasury** on contribute.
- **X handle self-attested** (v1 = signed X-ownership proof).
- **Framing:** "Founder / contribution," not "investment" — securities exposure + gating is the
  caller's call (see MOBILIZE.md).

## To go live
1. **Fable audit** `AGNTFoundersReceipt.sol` (money contract).
2. Deploy on mainnet with the treasury address → `AGNTFoundersReceipt(treasury)`.
3. Set `NEXT_PUBLIC_FOUNDER_CONTRACT=<addr>` in `.env.local` + Vercel env.
4. Deploy site (Vercel, auto from main).
5. Test with one small real contribution; confirm receipt + treasury receipt of funds.

## Known gaps / v1
- **Injected-only wallet** (MetaMask/Rabby/browser). Mobile/non-injected users need WalletConnect
  (add a connector + projectId).
- **Discord is a self-attested string** — the site already has Discord OAuth (`app/api/discord/*`);
  wire real verification in v1 if desired.
- Signed X-ownership attestation (v1).

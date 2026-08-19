'use client';

import { useState } from 'react';
import {
  useAccount, useConnect, useDisconnect, useChainId, useSwitchChain,
  useWriteContract, useWaitForTransactionReceipt, useReadContract,
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet } from 'wagmi/chains';
import { parseEther, formatEther } from 'viem';
import { FOUNDER_CONTRACT, FOUNDER_ABI } from '../lib/founderContract';

const ZERO = '0x0000000000000000000000000000000000000000';

export default function FounderFlow() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: hash, isPending: signing, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [amount, setAmount] = useState('');
  const [xName, setXName] = useState('');
  const [discord, setDiscord] = useState('');

  const { data: totalRaised } = useReadContract({
    address: FOUNDER_CONTRACT, abi: FOUNDER_ABI, functionName: 'totalRaised',
    query: { enabled: FOUNDER_CONTRACT !== ZERO },
  });

  const notDeployed = FOUNDER_CONTRACT === ZERO;
  const wrongChain = isConnected && chainId !== mainnet.id;
  const xClean = xName.trim().replace(/^@/, '');
  const discordClean = discord.trim();
  // mirror the contract's on-chain allowlist so users get a hint, not a reverted tx
  const xOk = /^[A-Za-z0-9_]{1,32}$/.test(xClean);
  const discordOk = /^[A-Za-z0-9_.#-]{0,40}$/.test(discordClean);
  const valid = Number(amount) > 0 && xOk && discordOk;
  const busy = signing || confirming;

  function submit() {
    if (!valid || notDeployed) return;
    writeContract({
      address: FOUNDER_CONTRACT, abi: FOUNDER_ABI, functionName: 'contribute',
      args: [xClean, discordClean],
      value: parseEther(amount),
    });
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={s.kick}>AGNT · FOUNDER</div>
        <h1 style={s.h1}>Become a Founder</h1>
        <p style={s.sub}>
          Contribute on-chain and mint your <b style={{ color: '#bfeaf4' }}>soulbound receipt</b> — your
          handle and amount, recorded permanently on Ethereum. Non-transferable. Yours forever.
        </p>

        {totalRaised != null && (
          <div style={s.raised}>Raised so far · <b>{Number(formatEther(totalRaised as bigint)).toFixed(4)} ETH</b></div>
        )}

        {isSuccess ? (
          <div style={s.success}>
            <div style={s.checkmark}>✓</div>
            <div style={s.successT}>You&apos;re a Founder.</div>
            <p style={s.successP}>Your soulbound receipt is minted. Welcome in.</p>
            <a style={s.link} href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noopener">View transaction ↗</a>
          </div>
        ) : (
          <>
            {!isConnected ? (
              <button style={s.btn} disabled={connecting} onClick={() => connect({ connector: injected() })}>
                {connecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            ) : wrongChain ? (
              <button style={s.btnAlt} onClick={() => switchChain({ chainId: mainnet.id })}>
                Switch to Ethereum
              </button>
            ) : (
              <div style={s.form}>
                <label style={s.label}>Amount (ETH)
                  <input style={s.input} inputMode="decimal" placeholder="0.5" value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
                </label>
                <label style={s.label}>X handle
                  <input style={s.input} placeholder="@yourhandle" value={xName}
                    onChange={(e) => setXName(e.target.value)} />
                </label>
                <label style={s.label}>Discord (optional)
                  <input style={s.input} placeholder="you#0000 or username" value={discord}
                    onChange={(e) => setDiscord(e.target.value)} />
                </label>

                {xName && !xOk && <div style={s.warn}>X handle: letters, numbers, underscore only (max 32).</div>}
                {notDeployed && <div style={s.warn}>Contract not live yet — check back at launch.</div>}
                {error && <div style={s.warn}>{(error as Error).message.slice(0, 120)}</div>}

                <button style={{ ...s.btn, opacity: valid && !busy && !notDeployed ? 1 : 0.5 }}
                  disabled={!valid || busy || notDeployed} onClick={submit}>
                  {signing ? 'Confirm in wallet…' : confirming ? 'Recording on-chain…' : 'Contribute & Mint Receipt'}
                </button>
                <button style={s.ghost} onClick={() => disconnect()}>
                  {address?.slice(0, 6)}…{address?.slice(-4)} · disconnect
                </button>
              </div>
            )}
          </>
        )}

        <p style={s.legal}>
          Contributions support AGNT. This is a Founder contribution and a commemorative soulbound
          receipt — not a security, share, or promise of return. Handle is self-attested.
        </p>
      </div>
    </main>
  );
}

// tut.house raise tokens (from public/raise.html)
const DISPLAY = '"Arial Black","Arial Bold",Impact,Haettenschweiler,"Helvetica Neue",sans-serif';
const MONO = 'ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace';
const BODY = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: '#1c0d2b', backgroundImage: 'radial-gradient(120% 80% at 50% -10%, #2a1540 0%, #1c0d2b 60%)', color: '#e9f6fb', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: BODY },
  card: { width: '100%', maxWidth: 460, border: '1px solid #bfeaf4', background: '#2a1540', padding: 'clamp(22px,4vw,36px)', boxShadow: '0 24px 60px -30px rgba(168,121,255,.5)' },
  kick: { fontFamily: MONO, fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', color: '#7ea6bd', marginBottom: 14 },
  h1: { fontFamily: DISPLAY, fontSize: 'clamp(30px,7vw,44px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-.01em', margin: '0 0 12px', lineHeight: 1 },
  sub: { fontSize: 14, color: 'rgba(233,246,251,.74)', lineHeight: 1.55, margin: '0 0 18px' },
  raised: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: '#7ea6bd', marginBottom: 18 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(233,246,251,.52)' },
  input: { fontFamily: MONO, fontSize: 17, fontWeight: 700, color: '#e9f6fb', background: '#1c0d2b', border: '1px solid rgba(191,234,244,.22)', padding: '11px 12px', outline: 'none' },
  btn: { width: '100%', marginTop: 6, fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.02em', fontSize: 15, color: '#1c0d2b', background: '#bfeaf4', border: 'none', padding: '14px', cursor: 'pointer' },
  btnAlt: { width: '100%', marginTop: 6, fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.02em', fontSize: 15, color: '#ff5cae', background: 'transparent', border: '1px solid #ff5cae', padding: '14px', cursor: 'pointer' },
  ghost: { width: '100%', background: 'none', border: 'none', color: 'rgba(233,246,251,.52)', fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', cursor: 'pointer', marginTop: 4 },
  warn: { fontFamily: MONO, fontSize: 12, color: '#ff5cae', lineHeight: 1.4 },
  success: { textAlign: 'center', padding: '18px 0' },
  checkmark: { fontSize: 44, color: '#bfeaf4', lineHeight: 1 },
  successT: { fontFamily: DISPLAY, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', margin: '10px 0 6px' },
  successP: { fontSize: 14, color: 'rgba(233,246,251,.74)', margin: 0 },
  link: { display: 'inline-block', marginTop: 14, color: '#bfeaf4', fontFamily: MONO, fontSize: 12, letterSpacing: '.06em' },
  legal: { fontSize: 10.5, color: 'rgba(233,246,251,.34)', lineHeight: 1.5, marginTop: 20, marginBottom: 0 },
};

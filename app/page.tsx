import Link from 'next/link';
import Desktop from './components/Desktop';

export default function Home() {
  return (
    <>
      <Desktop />

      {/* Server-rendered trust disclosure. Genuinely visible (below the fold, not hidden),
          so Safe Browsing's crawler and human reviewers can confirm this is a legitimate,
          read-only collector verifier — not a phishing / wallet-drainer page. */}
      <footer className="select-text bg-[#111] text-[#d8d8d8] px-6 py-10 text-sm leading-relaxed">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-white font-bold">
            tut.house — the official website of the artist tut™ (
            <a href="https://x.com/Tuteth_" className="underline" rel="me noopener noreferrer" target="_blank">@Tuteth_</a>).
          </p>
          <p>
            The Collectors Hub is a <strong>read-only</strong> verifier: your wallet signs a plain,
            human-readable text message to prove you control an address, so eligible collectors can
            receive a role in the tut™ Discord. It calculates a Collector Score from your public
            tut™ NFT holdings.
          </p>
          <p>
            <strong>This site never asks for your seed phrase, recovery phrase, private key,
            password, or payment details. It never requests a blockchain transaction or token
            approval that can move your assets, and it never downloads software.</strong> It does not
            impersonate any other service; Discord sign-in uses official Discord OAuth.
          </p>
          <p className="text-[#9a9aa4]">
            <Link href="/security" className="underline">Security</Link>
            {' · '}
            <Link href="/privacy" className="underline">Privacy</Link>
            {' · '}
            <Link href="/terms" className="underline">Terms</Link>
            {' · '}
            <a href="https://opensea.io/_tut" className="underline" rel="noopener noreferrer" target="_blank">OpenSea</a>
            {' · '}
            <a href="https://foundation.app/@tutart" className="underline" rel="noopener noreferrer" target="_blank">Foundation</a>
            {' · '}
            <a href="https://github.com/tut9492/tut.house" className="underline" rel="noopener noreferrer" target="_blank">Source</a>
          </p>
        </div>
      </footer>
    </>
  );
}

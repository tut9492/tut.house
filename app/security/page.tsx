import Link from 'next/link';

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#f7f2e8] text-black px-6 py-10">
      <div className="mx-auto max-w-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#111]">
        <Link href="/" className="text-sm underline">Back to tut.house</Link>
        <h1 className="mt-6 text-4xl font-black">Security</h1>
        <p className="mt-4 text-gray-700 leading-relaxed">
          tut.house is the official website for tut™ art and collector tools. The Collectors Hub
          verifies wallet ownership and Discord identity so eligible collectors can receive roles in
          the tut™ Discord.
        </p>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">What the verifier does</h2>
          <p>It asks your wallet to sign a human-readable message proving that you control an address.</p>
          <p>It calculates your Collector Score from public tut™ NFT holdings.</p>
          <p>It can read public artwork metadata so collectors can see their score breakdown.</p>
          <p>It uses Discord OAuth with the identify scope to confirm which Discord account should receive the role.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">What it never does</h2>
          <p>It never asks for a seed phrase, recovery phrase, private key, password, or credit card.</p>
          <p>It never downloads software or browser extensions.</p>
          <p>It never requests a blockchain transaction or approval that can move assets.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Official links</h2>
          <p>Website: https://www.tut.house</p>
          <p>Source: https://github.com/tut9492/tut.house</p>
          <p>Discord verifier reference: https://github.com/tut9492/DiscordVerifyBot</p>
        </section>
      </div>
    </main>
  );
}

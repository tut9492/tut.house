import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f2e8] text-black px-6 py-10">
      <div className="mx-auto max-w-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#111]">
        <Link href="/" className="text-sm underline">Back to tut.house</Link>
        <h1 className="mt-6 text-4xl font-black">Terms</h1>
        <p className="mt-4 text-gray-700 leading-relaxed">
          tut.house provides art, collector tools, and Discord role verification for the tut™ community.
        </p>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Collector verification</h2>
          <p>Verification is based on public wallet ownership and public collector-score data.</p>
          <p>Roles may change if Discord permissions, collector data, or community policy changes.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Wallet safety</h2>
          <p>Only sign messages you understand. tut.house verification messages do not authorize transactions.</p>
          <p>Never share a seed phrase, private key, or wallet password with any website or person.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Official source</h2>
          <p>The website source is available at https://github.com/tut9492/tut.house.</p>
        </section>
      </div>
    </main>
  );
}

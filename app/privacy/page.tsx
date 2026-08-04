import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f2e8] text-black px-6 py-10">
      <div className="mx-auto max-w-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#111]">
        <Link href="/" className="text-sm underline">Back to tut.house</Link>
        <h1 className="mt-6 text-4xl font-black">Privacy</h1>
        <p className="mt-4 text-gray-700 leading-relaxed">
          The Collectors Hub uses only the information needed to verify collector status and assign
          Discord roles.
        </p>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Information used</h2>
          <p>Your public wallet address and wallet signature.</p>
          <p>Your public Collector Score read from the MegaETH leaderboard contract.</p>
          <p>Your Discord user id and username returned by Discord OAuth.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Information not requested</h2>
          <p>We do not ask for seed phrases, private keys, wallet passwords, or payment details.</p>
          <p>Discord OAuth is used only with the identify scope for role verification.</p>
        </section>
        <section className="mt-6 space-y-3 text-gray-800">
          <h2 className="text-xl font-bold">Contact</h2>
          <p>For safety or verification questions, contact tut™ through the official community channels.</p>
        </section>
      </div>
    </main>
  );
}

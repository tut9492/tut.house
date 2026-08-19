import type { Metadata } from 'next';
import FounderProviders from './providers';
import FounderFlow from './FounderFlow';

export const metadata: Metadata = {
  title: 'Become a Founder · AGNT',
  description: 'Contribute on-chain and mint your soulbound AGNT Founder receipt.',
};

export default function FounderPage() {
  return (
    <FounderProviders>
      <FounderFlow />
    </FounderProviders>
  );
}

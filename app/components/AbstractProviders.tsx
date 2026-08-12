'use client';

import { AbstractWalletProvider } from '@abstract-foundation/agw-react';
import { abstract } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Wraps the collector desktop so Abstract Global Wallet (AGW) sign-in is available. AGW is a
// smart-contract wallet accessed through its SDK (email/social/passkey), NOT window.ethereum — so
// the existing MetaMask/injected flow is untouched and both live side by side. Mainnet: `abstract`.
export default function AbstractProviders({ children }: { children: React.ReactNode }) {
  // One QueryClient per mount (avoids sharing cache across a fast-refresh remount in dev).
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AbstractWalletProvider chain={abstract}>{children}</AbstractWalletProvider>
    </QueryClientProvider>
  );
}

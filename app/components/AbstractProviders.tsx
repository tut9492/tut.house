'use client';

import { AbstractWalletProvider } from '@abstract-foundation/agw-react';
import { abstract } from 'viem/chains';

// Enables Abstract Global Wallet (AGW) sign-in for the collector Hub. AbstractWalletProvider already
// wraps its children in WagmiProvider + QueryClientProvider internally (it mints its own QueryClient),
// so no separate providers are needed here. AGW is a smart-contract wallet reached through its SDK
// (email/social/passkey) — NOT window.ethereum — so the existing injected-wallet flow is untouched.
export default function AbstractProviders({ children }: { children: React.ReactNode }) {
  return <AbstractWalletProvider chain={abstract}>{children}</AbstractWalletProvider>;
}

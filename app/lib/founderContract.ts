// AGNT Founders receipt contract (soulbound). Address set after mainnet deploy.
// Set NEXT_PUBLIC_FOUNDER_CONTRACT in .env.local once deployed.
export const FOUNDER_CONTRACT = (process.env.NEXT_PUBLIC_FOUNDER_CONTRACT ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const FOUNDER_ABI = [
  {
    type: 'function',
    name: 'contribute',
    stateMutability: 'payable',
    inputs: [
      { name: 'xName', type: 'string' },
      { name: 'discord', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'founders',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'xName', type: 'string' },
      { name: 'discord', type: 'string' },
      { name: 'firstAt', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'totalRaised',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

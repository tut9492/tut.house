import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Optimize + edge-cache external art images (arweave / ipfs / alchemy / opensea / breadio)
    // so they're served as small webp/avif from Vercel's CDN instead of slow origin gateways.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // immutable art — cache a year
    remotePatterns: [
      { protocol: 'https', hostname: 'i.seadn.io' },
      { protocol: 'https', hostname: 'i2c.seadn.io' },
      { protocol: 'https', hostname: 'openseauserdata.com' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: 'ipfs.io' },
      // Alchemy load-balances NFT images across nft-cdn / nft2-cdn / nft3-cdn … — wildcard covers all.
      { protocol: 'https', hostname: '**.alchemy.com' },
      { protocol: 'https', hostname: 'breadio.tuthopium.store' },
    ],
  },
  async rewrites() {
    return {
      // beforeFiles runs BEFORE page routes, so the host-match can override the home page for
      // raise.agnt.social/ — serving the raise at the clean domain's root (routes around the
      // X/Safe-Browsing reputation flag on tut.house). Same deployment, clean hostname.
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: 'raise.agnt.social' }], destination: '/raise.html' },
      ],
      afterFiles: [
        { source: '/raise', destination: '/raise.html' },
      ],
    };
  },
};

export default nextConfig;

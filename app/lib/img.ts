// Route an external image through Next.js Image Optimization so it's fetched once,
// converted to webp/avif, and edge-cached by Vercel. Local (/…) and data: URIs pass through.
// `w` must be one of Next's allowed widths (deviceSizes/imageSizes): 16,32,48,64,96,128,256,384,640,750,…
export function cdnImg(src: string | null | undefined, w = 640): string {
  if (!src) return src || '';
  if (src.startsWith('/') || src.startsWith('data:')) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
}
